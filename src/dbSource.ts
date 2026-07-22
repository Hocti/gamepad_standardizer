import { gamepadInfo } from './types';
import { parseSDLText } from './sdlParse';

const DEFAULT_URL = 'https://raw.githubusercontent.com/gabomdq/SDL_GameControllerDB/master/gamecontrollerdb.txt';
const DEFAULT_CACHE_KEY = 'gamepad_standardizer:sdldb:v1';

export type DBConfig =
	| { mode: 'bundled' }
	| { mode: 'fetch'; url?: string; cacheKey?: string | false } // default url = GitHub raw, cache 落 localStorage
	| { mode: 'custom'; text: string };

let config: DBConfig = { mode: 'fetch' }; // default 保持而家行為（fetch），但加咗 cache
let loaded: gamepadInfo[] | undefined;
let loading: Promise<gamepadInfo[]> | undefined;

/**
 * Choose where the SDL controller DB comes from. Resets any cached load so the
 * next {@link ensureDB} re-loads from the new source.
 * - `bundled`: use the per-platform JSON shipped inside the package (no network).
 * - `fetch`: download the SDL text (default GitHub raw), cache to localStorage.
 * - `custom`: parse a caller-supplied SDL text blob.
 */
export function configureDB(cfg: DBConfig): void {
	config = cfg;
	loaded = undefined;
	loading = undefined;
}

/**
 * Detect the SDL platform string for the current environment.
 * Uses `navigator.userAgentData.platform` when available and falls back to the
 * deprecated `navigator.platform` (fix B17). Returns '' when unknown.
 */
export function currentPlatform(): string {
	const nav = typeof navigator !== 'undefined' ? navigator : undefined;
	if (!nav) return '';
	const userAgent = nav.userAgent ?? '';
	const platform =
		(nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? nav.platform ?? '';
	const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K', 'macOS'];
	const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
	const iosPlatforms = ['iPhone', 'iPad', 'iPod'];

	if (macosPlatforms.indexOf(platform) !== -1) return 'Mac OS X';
	if (iosPlatforms.indexOf(platform) !== -1) return 'iOS';
	if (windowsPlatforms.indexOf(platform) !== -1) return 'Windows';
	if (/Android/.test(userAgent)) return 'Android';
	if (/Linux/.test(platform)) return 'Linux';
	return '';
}

// Static loader map — vite library mode 對 variable dynamic import 支援有限，用明確 map 最穩陣。
const bundledLoaders: Record<string, () => Promise<{ default: unknown }>> = {
	Windows: () => import('./db/windows.json'),
	'Mac OS X': () => import('./db/macos.json'),
	Linux: () => import('./db/linux.json'),
	Android: () => import('./db/android.json'),
	iOS: () => import('./db/ios.json'),
};

async function load(): Promise<gamepadInfo[]> {
	const platform = currentPlatform();

	if (config.mode === 'custom') {
		return parseSDLText(config.text, platform || undefined);
	}

	if (config.mode === 'bundled') {
		const loader = bundledLoaders[platform] ?? bundledLoaders['Windows'];
		const mod = await loader();
		return mod.default as gamepadInfo[];
	}

	// fetch mode
	const cacheKey = config.cacheKey === false ? null : (config.cacheKey ?? DEFAULT_CACHE_KEY);
	if (cacheKey) {
		try {
			const cached = localStorage.getItem(cacheKey);
			if (cached) return parseSDLText(cached, platform || undefined);
		} catch {
			/* private mode 等，忽略 */
		}
	}
	const text = await (await fetch(config.url ?? DEFAULT_URL)).text();
	if (cacheKey) {
		try {
			localStorage.setItem(cacheKey, text);
		} catch {
			/* quota，忽略 */
		}
	}
	return parseSDLText(text, platform || undefined);
}

/**
 * Load (once) and return the SDL controller DB for the current platform.
 * Idempotent — concurrent callers share the same in-flight promise and result.
 *
 * IMPORTANT (lazy contract): this must only be triggered when a **non-standard**
 * controller is encountered. Standard / xinput controllers must never cause a DB
 * load (neither bundled import nor network fetch). See getGamepadInfo.
 */
export async function ensureDB(): Promise<gamepadInfo[]> {
	if (loaded) return loaded;
	if (!loading) loading = load().then((r) => (loaded = r));
	return loading;
}
