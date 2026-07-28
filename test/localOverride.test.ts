// Pins the hand-edited override format in db/local_override.txt. The whole point of that
// file is to rescue a pad the browser maps wrongly, so a typo silently parsing to nothing
// would be the worst failure mode — these tests make the format executable documentation.
import { describe, it, expect } from 'vitest';
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

	it('ships with no active entries until one is added', async () => {
		// Guards the shipped default: the file must contain only comments, so nobody
		// inherits a stray mapping. Delete/adjust this when a real entry is committed.
		const { LOCAL_OVERRIDE_TEXT } = await import('../src/db/local_override');
		expect(parseLocalOverrides(LOCAL_OVERRIDE_TEXT, 'Linux')).toHaveLength(0);
	});
});

// The reason this feature exists: a pad the browser reports as `mapping: "standard"` while
// decoding it wrongly. The SDL DB is unreachable for such a pad, so unless the override is
// consulted *before* that check it can never take effect — the exact silent no-op this
// guards against.
describe('override beats a wrong "standard" claim', () => {
	const fakePad = (id: string): Gamepad =>
		({
			id,
			index: 0,
			mapping: 'standard',
			connected: true,
			timestamp: 0,
			axes: [0, 0, 0, 0],
			buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
		}) as unknown as Gamepad;

	it('uses the override for a pad claiming the standard mapping', async () => {
		const { addLocalOverrides } = await import('../src/localOverride');
		const { getGamepadInfo } = await import('../src/gamepad_standardizer');

		addLocalOverrides('name:Probe,vendor:2dc8,product:310b,start:b7,dpup:b12,dpdown:b13');
		const info = await getGamepadInfo(fakePad('Probe Pad (STANDARD GAMEPAD Vendor: 2dc8 Product: 310b)'));

		expect(info.name).toBe('Probe');
		expect(info.buttonNames[7]).toBe('start');
		expect(info.buttonNames[12]).toBe('dpup');
		expect(info.buttonNames[13]).toBe('dpdown');
		expect(info.originInfo?.mapping).toBe('standard');
	});

	it('leaves an unlisted standard pad on the normal path', async () => {
		const { getGamepadInfo } = await import('../src/gamepad_standardizer');
		const info = await getGamepadInfo(fakePad('Other Pad (STANDARD GAMEPAD Vendor: 045e Product: 028e)'));
		expect(info.standard).toBe(true);
		expect(info.name).toBe('Other Pad');
	});
});
