// Per-device controller overrides, written in the *browser's* index space rather than SDL's
// (see db/local_override.txt for the format and the reasoning). They are consulted before the
// SDL DB, so an entry here wins for that vendor/product.
//
// The data lives in external .txt files fetched at runtime — the shipped one is only a default.
// An app can point at more files with addLocalOverrideUrl / configureLocalOverrides.
//
// LAZY CONTRACT: exactly the same rule as the SDL DB — nothing is fetched until a controller the
// browser reports as **non-standard** connects. See getGamepadInfo.
import { parseSDLDict } from './sdlParse';
import { addPadFontProfile } from './glyphs';
import { currentPlatform } from './dbSource';
import type { GamepadInfo } from './types';

/** Keys that describe the entry itself rather than a button/axis mapping. */
const META_KEYS = new Set(['vendor', 'product', 'name', 'platform', 'font', 'defaultSwapAB']);

/** One place to read overrides from: a fetchable `.txt` path, or text supplied inline. */
export type LocalOverrideSource = { url: string } | { text: string };

// Resolved against this module rather than the page, so it works both from `dist/` (built) and
// from `src/` (the "development" export condition) without the app configuring anything.
//
// The path is built from a variable on purpose: a literal `new URL('./x.txt', import.meta.url)`
// would be swallowed by Vite's asset pipeline and re-emitted under a content-hashed name, which
// defeats the point of a file users can find and hand-edit. Keep it non-literal.
const DEFAULT_FILE = 'db/local_override.txt';

/**
 * Where this module was loaded from, so the default `.txt` can be found next to it.
 * Must run at module-init time: `document.currentScript` is only set while a classic script
 * is executing, and that is the one case where `import.meta.url` is unavailable.
 */
function moduleBase(): string | undefined {
	// ESM build. In the IIFE build `import.meta` is compiled to `{}`, hence the guard.
	const url = (import.meta as ImportMeta | undefined)?.url;
	if (url) return url;
	// IIFE build loaded by <script src="…/dist/gamepadStandardizer.js"> (jsdelivr/unpkg).
	const script = typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null) : null;
	return script?.src || undefined;
}

function resolveDefaultUrl(): string {
	const base = moduleBase();
	try {
		return base ? new URL(DEFAULT_FILE, base).href : './' + DEFAULT_FILE;
	} catch {
		// Last resort: page-relative. An app in this position should pass an explicit url.
		return './' + DEFAULT_FILE;
	}
}

/** URL of the `.txt` shipped with the package. Exported so an app can re-add it after replacing the list. */
export const DEFAULT_LOCAL_OVERRIDE_URL: string = resolveDefaultUrl();

function parseLine(line: string, platform: string): GamepadInfo | null {
	const trimmed = line.trim();
	if (trimmed === '' || trimmed.startsWith('#')) return null;

	const data: Record<string, string> = {};
	for (const pair of trimmed.split(',')) {
		const at = pair.indexOf(':');
		if (at < 0) continue;
		const key = pair.slice(0, at).trim();
		if (key !== '') data[key] = pair.slice(at + 1).trim();
	}

	const vendor = data['vendor'];
	const product = data['product'];
	if (!vendor || !product) return null;
	// An entry may pin itself to one platform; unpinned entries apply everywhere.
	if (data['platform'] && data['platform'] !== platform) return null;

	const mappings: Record<string, string> = {};
	for (const key in data) if (!META_KEYS.has(key)) mappings[key] = data[key];

	const font = data['font'];
	if (font === 'xbox' || font === 'playstation' || font === 'switch') {
		addPadFontProfile({ vendor, product, productName: data['name'], system: font });
	}

	return {
		name: data['name'] ?? '',
		vendor,
		product,
		platform: data['platform'],
		defaultSwapAB: data['defaultSwapAB'] === 'true',
		...parseSDLDict(mappings),
	};
}

/** Exported for tests — parses override text without touching module state or the network. */
export function parseLocalOverrides(text: string, platform: string): GamepadInfo[] {
	const out: GamepadInfo[] = [];
	for (const line of text.split('\n')) {
		const entry = parseLine(line, platform);
		if (entry) out.push(entry);
	}
	return out;
}

// Sources in load order. Later sources win, so lookups scan this backwards.
let sources: LocalOverrideSource[] = [{ url: DEFAULT_LOCAL_OVERRIDE_URL }];
let loaded: GamepadInfo[][] | undefined;
let loading: Promise<GamepadInfo[][]> | undefined;

function reset(): void {
	loaded = undefined;
	loading = undefined;
}

/**
 * Replace the whole override source list.
 * - `urls`: `.txt` paths, loaded in order — a later file wins over an earlier one.
 * - `includeDefault`: keep the `.txt` shipped with the package at the head of the list (default `true`).
 *
 * Resets any completed load, so the next lookup re-reads from the new sources.
 */
export function configureLocalOverrides(cfg: { urls?: string[]; includeDefault?: boolean }): void {
	const head: LocalOverrideSource[] = cfg.includeDefault === false ? [] : [{ url: DEFAULT_LOCAL_OVERRIDE_URL }];
	sources = [...head, ...(cfg.urls ?? []).map((url) => ({ url }))];
	reset();
}

/**
 * Add one more `.txt` path on top of the current list — the common way to ship your own pad data
 * alongside the default. Loaded last, so its entries win over everything already registered.
 *
 * Nothing is fetched here; the file is read on the first non-standard controller (see the lazy contract).
 */
export function addLocalOverrideUrl(url: string): void {
	sources = [...sources, { url }];
	reset();
}

/**
 * Add overrides as inline text, in the same format as the `.txt` files. Loaded last, so these win.
 * Useful for a settings-screen escape hatch that lets a player fix their own pad, and for tests.
 */
export function addLocalOverrides(text: string): void {
	sources = [...sources, { text }];
	reset();
}

/** The sources that will be read on the next load, in load order. */
export function localOverrideSources(): readonly LocalOverrideSource[] {
	return sources;
}

async function readSource(source: LocalOverrideSource, platform: string): Promise<GamepadInfo[]> {
	if ('text' in source) return parseLocalOverrides(source.text, platform);
	try {
		const res = await fetch(source.url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return parseLocalOverrides(await res.text(), platform);
	} catch (err) {
		// A missing override file must never break controller support — it only means "no overrides".
		console.warn(`[gamepad_standardizer] could not load overrides from ${source.url}:`, err);
		return [];
	}
}

async function load(): Promise<GamepadInfo[][]> {
	const platform = currentPlatform();
	return Promise.all(sources.map((s) => readSource(s, platform)));
}

/**
 * Load (once) and return the parsed overrides, grouped per source in load order.
 * Idempotent — concurrent callers share the same in-flight promise.
 *
 * IMPORTANT (lazy contract): only call this once a **non-standard** controller has been seen.
 * A pad claiming `mapping: "standard"` must never trigger a fetch. See getGamepadInfo.
 */
export async function ensureLocalOverrides(): Promise<GamepadInfo[][]> {
	if (loaded) return loaded;
	if (!loading) loading = load().then((r) => (loaded = r));
	return loading;
}

/** The override for this vendor/product, or undefined when none is declared. */
export async function localOverrideFor(
	vendor: string | undefined,
	product: string | undefined
): Promise<GamepadInfo | undefined> {
	if (!vendor || !product) return undefined;
	const groups = await ensureLocalOverrides();
	// Backwards: the last source to declare a pad wins.
	for (let i = groups.length - 1; i >= 0; i--) {
		const hit = groups[i].find((e) => e.vendor === vendor && e.product === product);
		if (hit) return hit;
	}
	return undefined;
}

/** How many overrides are active — handy to confirm the files were picked up at all. */
export async function localOverrideCount(): Promise<number> {
	const groups = await ensureLocalOverrides();
	return groups.reduce((n, g) => n + g.length, 0);
}
