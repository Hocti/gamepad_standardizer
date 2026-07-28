// Hand-maintained per-device overrides, compiled into the bundle (see db/local_override.ts
// for the format and the reasoning). They exist for pads the *browser* maps wrongly, so they
// are written in the browser's index space and take priority over everything else —
// including a `mapping: "standard"` claim, which for such pads is precisely what is false.
//
// Parsed eagerly: the file is bundled and tiny, so this costs nothing and, unlike the SDL DB,
// does not break the "a standard controller must never trigger a DB load" contract.
import { LOCAL_OVERRIDE_TEXT } from './db/local_override';
import { parseSDLDict } from './sdlParse';
import { addPadFontProfile } from './glyphs';
import { currentPlatform } from './dbSource';
import type { gamepadInfo } from './types';

/** Keys that describe the entry itself rather than a button/axis mapping. */
const META_KEYS = new Set(['vendor', 'product', 'name', 'platform', 'font', 'defaultSwapAB']);

function parseLine(line: string, platform: string): gamepadInfo | null {
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

/** Exported for tests — parses override text without touching module state. */
export function parseLocalOverrides(text: string, platform: string): gamepadInfo[] {
	const out: gamepadInfo[] = [];
	for (const line of text.split('\n')) {
		const entry = parseLine(line, platform);
		if (entry) out.push(entry);
	}
	return out;
}

let entries: gamepadInfo[] | undefined;

function all(): gamepadInfo[] {
	if (!entries) entries = parseLocalOverrides(LOCAL_OVERRIDE_TEXT, currentPlatform());
	return entries;
}

/**
 * Add overrides at runtime, in the same text format as the bundled file. Later additions
 * win over earlier ones and over the bundled entries, so an app can let a player fix their
 * own pad without a rebuild. Mostly useful for testing and for a settings-screen escape hatch.
 */
export function addLocalOverrides(text: string): void {
	entries = [...parseLocalOverrides(text, currentPlatform()), ...all()];
}

/** The override for this vendor/product, or undefined when none is declared. */
export function localOverrideFor(vendor: string | undefined, product: string | undefined): gamepadInfo | undefined {
	if (!vendor || !product) return undefined;
	return all().find((e) => e.vendor === vendor && e.product === product);
}

/** How many overrides are active — handy to confirm the file was picked up at all. */
export function localOverrideCount(): number {
	return all().length;
}
