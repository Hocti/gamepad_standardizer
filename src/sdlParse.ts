import { GamepadInfo } from './types';
import { SYSTEM_BUTTON_NAME } from './config';
import { Dpad } from './direction';

const lineReg = /^([^a-z0-9]{0,1})([a-z]{1})([\d.]{1,3})([^a-z0-9]{0,1})$/;

type parseSDLDict_result = {
	standard: boolean;
	buttonNames: string[];
	keyMapping: number[];
	hatDpad: Record<Dpad, number> | undefined;
	analogNames: string[];
	analogPlusNames: string[];
	analogMinusNames: string[];
};

/**
 * Parse an SDL mapping dict (already split into key→value pairs) into normalised
 * button/analog/hat structures. Pure — no module state.
 */
export function parseSDLDict(data: Record<string, string>): parseSDLDict_result {
	const buttonNames: string[] = [];
	const analogNames: string[] = [];
	const analogPlusNames: string[] = [];
	const analogMinusNames: string[] = [];
	const keyMapping: number[] = [];
	let hatDpad: Record<Dpad, number> | undefined;

	for (const key in data) {
		if (key === 'platform') continue;
		const value = data[key];

		const valArr = value.match(lineReg);
		if (!valArr || valArr.length < 5) {
			continue;
		}
		const [, start, type, , end] = valArr;
		//  +/-,a/b/h,0~n/0.2~0.8,~
		const num = parseInt(valArr[3]);

		if (type === 'b') {
			//button
			buttonNames[num] = key;
			const defautIndex = SYSTEM_BUTTON_NAME.indexOf(key);
			if (defautIndex !== -1 && defautIndex !== num) {
				keyMapping[num] = defautIndex;
			}
		} else if (type === 'a') {
			//analog
			if (start == '') {
				analogNames[num] = key;
			} else if (start !== '') {
				if (start == '+') {
					analogPlusNames[num] = key;
				} else {
					analogMinusNames[num] = key;
				}
			}
		} else if (type === 'h') {
			//SDL hat to Dpad
			if (!hatDpad) {
				hatDpad = { up: 0, down: 0, left: 0, right: 0 };
			}
			const [hat, hatval] = valArr[3].split('.');
			if (hatval) {
				if (key.substring(0, 2) === 'dp') {
					hatDpad[key.substring(2) as Dpad] = parseInt(hatval);
				} else {
					//*
				}
			}
		}
	}

	return {
		standard: false,
		buttonNames,
		keyMapping,
		hatDpad,
		analogNames,
		analogPlusNames,
		analogMinusNames,
	};
}

/**
 * Parse a single SDL_GameControllerDB line into a {@link GamepadInfo}.
 * Returns `null` for comment lines, malformed guids, or lines whose `platform`
 * does not match `platformFilter` (when given).
 *
 * Note: `defaultSwapAB` is intentionally NOT set here — it depends on the vendor
 * table and is applied by the caller in gamepad_standardizer.ts.
 */
export function parseSDLLine(line: string, platformFilter?: string): GamepadInfo | null {
	if (line.startsWith('#')) return null;
	const arr = line.split(',');

	const guid = arr[0];
	if (guid.length !== 32) return null;
	const vendor = guid.substring(10, 12) + guid.substring(8, 10);
	const product = guid.substring(18, 20) + guid.substring(16, 18);
	const name = arr[1];

	const data: Record<string, string> = {};
	for (let i = 2, t = arr.length - 1; i < t; i++) {
		const [key, value] = arr[i].split(':');
		data[key] = value;
	}

	if (platformFilter && data['platform'] !== platformFilter) return null;

	return { name, guid, vendor, product, ...parseSDLDict(data) };
}

/**
 * Parse a full SDL_GameControllerDB text blob into {@link GamepadInfo} entries,
 * keeping only lines that match `platformFilter` when provided.
 */
export function parseSDLText(text: string, platformFilter?: string): GamepadInfo[] {
	const result: GamepadInfo[] = [];
	for (const line of text.split('\n')) {
		const info = parseSDLLine(line, platformFilter);
		if (info) result.push(info);
	}
	return result;
}
