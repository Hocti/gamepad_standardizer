import { describe, it, expect } from 'vitest';
import { fixhatDpad, fixAnalog } from '../src/fixMapping';

describe('fixhatDpad', () => {
	it('uses left_HNum for left, not up_HNum (B1)', () => {
		// up=-7 (0b0001), left=7 (HDpadMapping['7']=0b1001)
		const r = fixhatDpad(-7, 7);
		expect(r.up).toBe(0b0001);
		expect(r.left).toBe(0b1001); // 有 bug 時 left === up 對應值
		expect(r.down).not.toBe(r.up);
	});
});

describe('fixAnalog', () => {
	it('puts plus-direction dpad into analogPlusNames (B2)', () => {
		const r = fixAnalog(undefined, undefined, {
			up: { axes_index: 1, Operation: '-' },
			down: { axes_index: 1, Operation: '+' },
			left: { axes_index: 0, Operation: '-' },
			right: { axes_index: 0, Operation: '+' },
		});
		expect(r.analogMinusNames![1]).toBe('dpup');
		expect(r.analogPlusNames![1]).toBe('dpdown'); // bug 時呢度會係 minus array 的內容
		expect(r.analogPlusNames![0]).toBe('dpright');
	});
});
