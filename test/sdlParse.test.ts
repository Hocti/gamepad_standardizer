import { describe, it, expect } from 'vitest';
import { parseSDLLine, parseSDLText } from '../src/sdlParse';

// 真實 SDL DB 行（8BitDo Zero 2, Windows）
const LINE =
	'03000000c82d00001890000000000000,8BitDo Zero 2,a:b0,b:b1,x:b3,y:b4,back:b10,start:b11,leftshoulder:b6,rightshoulder:b7,leftx:a0,lefty:a1,platform:Windows,';

describe('parseSDLLine', () => {
	it('extracts guid/vendor/product/name', () => {
		const info = parseSDLLine(LINE)!;
		expect(info.name).toBe('8BitDo Zero 2');
		expect(info.vendor).toBe('2dc8'); // guid[10..12]+guid[8..10] byte-swap
		expect(info.guid).toHaveLength(32);
	});
	it('maps buttons and builds keyMapping for shifted indices', () => {
		const info = parseSDLLine(LINE)!;
		expect(info.buttonNames[0]).toBe('a');
		expect(info.buttonNames[3]).toBe('x'); // x:b3 但標準 index 係 2
		expect(info.keyMapping![3]).toBe(2);
		expect(info.buttonNames[10]).toBe('back');
		expect(info.keyMapping![10]).toBe(8);
	});
	it('respects platformFilter', () => {
		expect(parseSDLLine(LINE, 'Mac OS X')).toBeNull();
		expect(parseSDLLine(LINE, 'Windows')).not.toBeNull();
	});
	it('rejects comment lines and bad guid', () => {
		expect(parseSDLLine('# comment')).toBeNull();
		expect(parseSDLLine('deadbeef,Bad,a:b0,platform:Windows,')).toBeNull();
	});
});

describe('parseSDLText', () => {
	it('parses multi-line text and keeps only matching platform', () => {
		const text = `# header\n${LINE}\n${LINE.replace('platform:Windows', 'platform:Mac OS X')}`;
		expect(parseSDLText(text, 'Windows')).toHaveLength(1);
		expect(parseSDLText(text)).toHaveLength(2); // 無 filter → 全收
	});
});
