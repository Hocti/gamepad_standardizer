// pnpm --filter gamepad_standardizer build:db
// 下載 SDL_GameControllerDB 並 pre-parse 成 per-platform json，commit 入 src/db/。
import { writeFile, mkdir } from 'node:fs/promises';
import { parseSDLText } from '../src/sdlParse';

const DB_URL = 'https://raw.githubusercontent.com/gabomdq/SDL_GameControllerDB/master/gamecontrollerdb.txt';
const PLATFORMS: Record<string, string> = {
	windows: 'Windows',
	macos: 'Mac OS X',
	linux: 'Linux',
	android: 'Android',
	ios: 'iOS',
};

const text = await (await fetch(DB_URL)).text();
await mkdir(new URL('../src/db/', import.meta.url), { recursive: true });
for (const [file, platform] of Object.entries(PLATFORMS)) {
	const infos = parseSDLText(text, platform);
	await writeFile(new URL(`../src/db/${file}.json`, import.meta.url), JSON.stringify(infos));
	console.log(`${file}.json: ${infos.length} entries`);
}
