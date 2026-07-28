// Pins the hand-edited override format in src/db/local_override.txt. The whole point of that
// file is to rescue a pad the browser maps wrongly, so a typo silently parsing to nothing
// would be the worst failure mode — these tests make the format executable documentation.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLocalOverrides } from '../src/localOverride';
import { SYSTEM_BUTTON_NAME } from '../src/config';

const LINE =
	'name:8BitDo Ultimate 2 Wireless,platform:Linux,vendor:2dc8,product:310b,' +
	'a:b0,b:b1,start:b7,dpup:b12,dpdown:b13,dpleft:b14,dpright:b15,leftx:a0,lefty:a1';

describe('local controller overrides', () => {
	it('parses an entry and keeps its identity fields', () => {
		const [e] = parseLocalOverrides(LINE, 'Linux');
		expect(e.vendor).toBe('2dc8');
		expect(e.product).toBe('310b');
		expect(e.name).toBe('8BitDo Ultimate 2 Wireless');
	});

	it('maps buttons by the browser index they are written against', () => {
		const [e] = parseLocalOverrides(LINE, 'Linux');
		expect(e.buttonNames[0]).toBe('a');
		expect(e.buttonNames[7]).toBe('start');
		expect(e.buttonNames[12]).toBe('dpup');
		expect(e.buttonNames[13]).toBe('dpdown');
		expect(e.buttonNames[15]).toBe('dpright');
		expect(e.analogNames[0]).toBe('leftx');
		expect(e.analogNames[1]).toBe('lefty');
	});

	it('records a keyMapping only where the index differs from the standard order', () => {
		const [e] = parseLocalOverrides(LINE, 'Linux');
		// 'start' is index 7 here but sits elsewhere in the standard name order.
		const standardStart = SYSTEM_BUTTON_NAME.indexOf('start');
		if (standardStart !== 7) expect(e.keyMapping[7]).toBe(standardStart);
		expect(e.keyMapping[0]).toBeUndefined(); // 'a' is index 0 in both
	});

	it('honours a platform pin', () => {
		expect(parseLocalOverrides(LINE, 'Windows')).toHaveLength(0);
		expect(parseLocalOverrides(LINE, 'Linux')).toHaveLength(1);
	});

	it('applies an unpinned entry on every platform', () => {
		const line = 'vendor:2dc8,product:310b,dpup:b12';
		expect(parseLocalOverrides(line, 'Windows')).toHaveLength(1);
		expect(parseLocalOverrides(line, 'Mac OS X')).toHaveLength(1);
	});

	it('ignores comments, blank lines and entries with no vendor/product', () => {
		const text = ['# a comment', '', '   ', 'name:nope,dpup:b12', 'vendor:2dc8,product:310b,dpup:b12'].join('\n');
		expect(parseLocalOverrides(text, 'Linux')).toHaveLength(1);
	});

	it('reads hat mappings', () => {
		const [e] = parseLocalOverrides('vendor:1234,product:5678,dpup:h0.1,dpdown:h0.4', 'Linux');
		expect(e.hatDpad).toBeDefined();
		expect(e.hatDpad!.up).toBe(1);
		expect(e.hatDpad!.down).toBe(4);
	});
});

// The shipped .txt is an external file users edit by hand, so it is not type-checked by anything.
// Parsing it here is the only guard against a committed typo becoming a silent no-op.
describe('the shipped default .txt', () => {
	// Read off cwd (the package root): under happy-dom, import.meta.url is an http: URL.
	const text = readFileSync(resolve(process.cwd(), 'src/db/local_override.txt'), 'utf8');

	it('parses without dropping its entries', () => {
		const linux = parseLocalOverrides(text, 'Linux');
		// Every non-comment, non-blank line must survive the parser.
		const lines = text.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
		const pinnedElsewhere = lines.filter((l) => /(^|,)\s*platform:(?!Linux\b)/.test(l));
		expect(linux).toHaveLength(lines.length - pinnedElsewhere.length);
	});

	it('ships the 8BitDo Ultimate 2 Wireless Linux entry', () => {
		const e = parseLocalOverrides(text, 'Linux').find((x) => x.vendor === '2dc8' && x.product === '310b');
		expect(e).toBeDefined();
		expect(e!.buttonNames[7]).toBe('start');
		expect(e!.analogMinusNames?.[7]).toBe('dpup');
		expect(e!.analogPlusNames?.[7]).toBe('dpdown');
	});

	it('is not applied on a platform the entry is not pinned to', () => {
		expect(parseLocalOverrides(text, 'Windows').find((x) => x.product === '310b')).toBeUndefined();
	});
});

// The lazy contract, which is the reason overrides live in a fetched .txt at all: a pad the
// browser calls "standard" must not cost a network request. Overrides therefore only apply on
// the non-standard path — checked there before the SDL DB, so they still beat every DB source.
describe('lazy contract + priority', () => {
	const fakePad = (id: string, mapping: string): Gamepad =>
		({
			id,
			index: 0,
			mapping,
			connected: true,
			timestamp: 0,
			axes: [0, 0, 0, 0],
			buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
		}) as unknown as Gamepad;

	beforeEach(async () => {
		const { configureLocalOverrides } = await import('../src/localOverride');
		configureLocalOverrides({ includeDefault: false });
	});

	it('fetches no .txt for a pad claiming the standard mapping', async () => {
		const { configureLocalOverrides } = await import('../src/localOverride');
		const { getGamepadInfo } = await import('../src/gamepad_standardizer');

		const fetched: string[] = [];
		const realFetch = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			fetched.push(String(input));
			return new Response('');
		}) as typeof fetch;

		try {
			configureLocalOverrides({ urls: ['./extra-pads.txt'] }); // default + an app file
			const info = await getGamepadInfo(
				fakePad('Probe Pad (STANDARD GAMEPAD Vendor: 2dc8 Product: 310b)', 'standard')
			);
			expect(info.standard).toBe(true);
			expect(fetched).toEqual([]);
		} finally {
			globalThis.fetch = realFetch;
		}
	});

	it('fetches every source once for a non-standard pad', async () => {
		const { configureLocalOverrides, ensureLocalOverrides } = await import('../src/localOverride');

		const fetched: string[] = [];
		const realFetch = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			fetched.push(String(input));
			return new Response('');
		}) as typeof fetch;

		try {
			configureLocalOverrides({ includeDefault: false, urls: ['./a.txt', './b.txt'] });
			await ensureLocalOverrides();
			await ensureLocalOverrides(); // idempotent — must not re-fetch
			expect(fetched).toEqual(['./a.txt', './b.txt']);
		} finally {
			globalThis.fetch = realFetch;
		}
	});

	it('applies the override for a non-standard pad, ahead of the SDL DB', async () => {
		const { addLocalOverrides } = await import('../src/localOverride');
		const { configureDB } = await import('../src/dbSource');
		const { getGamepadInfo } = await import('../src/gamepad_standardizer');

		// An SDL line for the same pad — the override must win over it.
		configureDB({ mode: 'custom', text: '03000000c82d00000b31000000000000,From SDL,platform:Linux,a:b1,\n' });
		addLocalOverrides('name:Probe,vendor:2dc8,product:310b,start:b7,dpup:b12,dpdown:b13');

		const info = await getGamepadInfo(fakePad('Probe Pad (Vendor: 2dc8 Product: 310b)', ''));
		expect(info.name).toBe('Probe');
		expect(info.buttonNames[7]).toBe('start');
		expect(info.buttonNames[12]).toBe('dpup');
		expect(info.buttonNames[13]).toBe('dpdown');
		expect(info.originInfo?.mapping).toBe('');
	});

	it('lets a later source win over an earlier one', async () => {
		const { addLocalOverrides, localOverrideFor } = await import('../src/localOverride');

		addLocalOverrides('name:First,vendor:2dc8,product:310b,a:b0');
		addLocalOverrides('name:Second,vendor:2dc8,product:310b,a:b0');

		expect((await localOverrideFor('2dc8', '310b'))?.name).toBe('Second');
	});

	it('reports an unreachable .txt as "no overrides" instead of throwing', async () => {
		const { configureLocalOverrides, localOverrideCount } = await import('../src/localOverride');

		const realFetch = globalThis.fetch;
		const realWarn = console.warn;
		globalThis.fetch = (async () => {
			throw new Error('offline');
		}) as typeof fetch;
		console.warn = () => {}; // the warning is the expected behaviour, not test output

		try {
			configureLocalOverrides({ includeDefault: false, urls: ['./nope.txt'] });
			await expect(localOverrideCount()).resolves.toBe(0);
		} finally {
			globalThis.fetch = realFetch;
			console.warn = realWarn;
		}
	});

	it('reports a 404 .txt as "no overrides" instead of throwing', async () => {
		const { configureLocalOverrides, localOverrideCount } = await import('../src/localOverride');

		const realFetch = globalThis.fetch;
		const realWarn = console.warn;
		globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as typeof fetch;
		console.warn = () => {};

		try {
			configureLocalOverrides({ includeDefault: false, urls: ['./nope.txt'] });
			await expect(localOverrideCount()).resolves.toBe(0);
		} finally {
			globalThis.fetch = realFetch;
			console.warn = realWarn;
		}
	});
});
