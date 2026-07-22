import { describe, it, expect } from 'vitest';
import { getAnalogDirection, getDpadDirection } from '../src/direction';

describe('getDpadDirection', () => {
	it('neutral → numpad 5, distance 0', () => {
		const r = getDpadDirection({ up: false, down: false, left: false, right: false });
		expect(r.numpad).toBe(5);
		expect(r.distance).toBe(0);
		expect(r.type).toBe('dpad');
	});
	it('up → numpad 8, degree 0', () => {
		const r = getDpadDirection({ up: true, down: false, left: false, right: false });
		expect(r.numpad).toBe(8);
		expect(r.degree).toBe(0);
		expect(r.y).toBe(-1);
	});
	it('down-right → numpad 3, degree 135', () => {
		const r = getDpadDirection({ up: false, down: true, left: false, right: true });
		expect(r.numpad).toBe(3);
		expect(r.degree).toBe(135);
	});
});

describe('getAnalogDirection', () => {
	it('inside deadzone → all false, distance 0', () => {
		const r = getAnalogDirection({ x: 0.05, y: -0.05 }, 0.15);
		expect(r.numpad).toBe(5);
		expect(r.distance).toBe(0);
		expect(r.x).toBe(0);
	});
	it('full right → right true, numpad 6, degree 90', () => {
		const r = getAnalogDirection({ x: 1, y: 0 }, 0.15);
		expect(r.right).toBe(true);
		expect(r.numpad).toBe(6);
		expect(r.degree).toBe(90);
		expect(r.distance).toBe(1);
	});
	it('diagonal threshold uses tan(pi/8)', () => {
		// x=0.5,y=0.5 → down+right (y>0 係 down)
		const r = getAnalogDirection({ x: 0.5, y: 0.5 }, 0.15);
		expect(r.down).toBe(true);
		expect(r.right).toBe(true);
		expect(r.numpad).toBe(3);
	});
});
