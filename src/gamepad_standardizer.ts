import { GamepadInfo, DirectSource } from './types';
import { addPadFontProfile } from './glyphs';
import { HDpadMapping, SYSTEM_BUTTON_NAME } from './config';
import { Dpad, XY, DpadPress, DirectionWrap, getAnalogDirection, getDpadDirection } from './direction';
import { parseSDLDict, parseSDLText } from './sdlParse';
import { configureDB, ensureDB, currentPlatform } from './dbSource';
import { localOverrideFor } from './localOverride';

//from SDL DB================================================================

const OS: string = currentPlatform();

// Manual additions merged into the DB search on top of the lazily-loaded source
// (see ensureDB). Populated by the back-compat SDLDB_processText below.
let gamepadDB: GamepadInfo[] = [];

/**
 * @deprecated use `configureDB({ mode: 'fetch', url })` instead.
 * Kept for back-compat: sets the fetch URL for the runtime SDL DB source.
 */
export function SDLDB_setLink(link: string): void {
	configureDB({ mode: 'fetch', url: link });
}

/**
 * @deprecated use `configureDB(...)` + rely on lazy `ensureDB()` (triggered when a
 * non-standard controller connects). Kept for back-compat: eagerly loads the DB now.
 */
export async function SDLDB_fetch(link?: string) {
	if (link) configureDB({ mode: 'fetch', url: link });
	await ensureDB();
}

/**
 * Manually add SDL DB entries on top of the lazily-loaded source ("加料").
 * The lazily-loaded DB (see {@link ensureDB}) is the primary source; entries added
 * here are merged into the search in {@link getGamepadInfo}.
 */
export function SDLDB_processText(text: string): void {
	for (const info of parseSDLText(text, OS !== '' ? OS : undefined)) {
		gamepadDB.push({ ...info, defaultSwapAB: getSwapAB(info.vendor, info.product) });
	}
}

const extraGamepadDB: GamepadInfo[] = [];
//platform:asdf,browser:asdf,name:asdf,vendor:asdf,product:asdf,font:switch,a:b0...
//`font` is optional and picks the glyph artwork (xbox|playstation|switch); it replaces
//the old `buttonNames:A|B|C` field, since button *names* no longer vary by vendor.
export function SDLDB_procesExtraText(text: string): void {
	let lines = text.split('\n');
	for (let line of lines) {
		let arr = line.split(',');
		const data: Record<string, string> = {};
		for (let i = 2, t = arr.length - 1; i < t; i++) {
			const [key, value] = arr[i].split(':');
			data[key] = value;
		}

		const platform = data['platform'];
		const browser = data['browser'];
		const name = data['name'];
		const vendor = data['vendor'];
		const product = data['product'];

		const defaultSwapAB = data['defaultSwapAB'] ? true : false;

		const result = parseSDLDict(data);

		extraGamepadDB.push({
			platform,
			browser,
			name,
			vendor,
			product,
			...result,
			defaultSwapAB: defaultSwapAB || getSwapAB(vendor, product),
		});

		const font = data['font'];
		if (font === 'xbox' || font === 'playstation' || font === 'switch') {
			addPadFontProfile({ vendor, product, productName: name, system: font });
		}
	}
}

//vendor================================================================

// Buttons have ONE name set across every vendor — the SDL standard names returned by
// `getButtonName`. What differs per vendor is only how the button is *drawn*, and that
// is a webfont choice, not a naming one: see `./glyphs` (`padFontId`) + `gamepad_fonts`.
const NINTENDO_VENDOR_ID = '057e';

function getSwapAB(vendor: string | undefined, product: string | undefined): boolean {
	if (vendor === NINTENDO_VENDOR_ID) {
		return true;
	}
	/* temp off
	const profile = getGamepadProfile(vendor, product);
	if (profile?.defaultSwapAB) {
		return true;
	}
		*/
	return false;
}
export const getGamepadProfile = (vendor: string | undefined, product: string | undefined) => {
	let sameVendor: GamepadInfo[] = [];
	for (let info of extraGamepadDB) {
		if (info.vendor === vendor) {
			if (!product || info.product === product) {
				return info;
			}
			sameVendor.push(info);
		}
	}
	//
	if (sameVendor.length === 0 || !product) {
		return undefined;
	}
	// B3: proper 2-arg comparator — entries on the current platform sort first.
	const newSort = sameVendor.sort((a, b) => (b.platform === OS ? 1 : 0) - (a.platform === OS ? 1 : 0));
	return newSort[0];
};

//================================================================

function parseGamepadId(input: string): {
	name: string;
	vendor: string;
	product: string;
} {
	//type: string
	// Regular expressions to extract the relevant parts
	const nameRegex = /^(.*?) \(/;
	const vendorRegex = /Vendor: ([\w]+)/;
	const productRegex = /Product: ([\w]+)/;
	//const typeRegex = /\((.*?)(Vendor:(.*?)?)?\)/;

	const ffRegex = /^([\w]{1,4})-([\w]{1,4})-(.*?)$/;
	const ffMatch = input.match(ffRegex);
	if (ffMatch?.length == 4) {
		return {
			name: ffMatch![3],
			vendor: ffMatch![1].padStart(4, '0'),
			product: ffMatch![2].padStart(4, '0'),
		};
	}

	// Extracting the parts using the regular expressions
	const nameMatch = input.match(nameRegex);
	const vendorMatch = input.match(vendorRegex);
	const productMatch = input.match(productRegex);
	//const typeMatch = input.match(typeRegex);

	//"8BitDo Zero 2 gamepad (Vendor: 2dc8 Product: 9018)"
	//"2dc8-9018-8BitDo Zero 2 gamepad"

	// Return the parsed object, handling cases where a match might not be found
	return {
		name: nameMatch ? nameMatch[1] : '',
		vendor: vendorMatch ? vendorMatch[1] : '',
		product: productMatch ? productMatch[1] : '',
		//type: typeMatch ? typeMatch[1] : ''
	};
}

export async function getGamepadInfo(gamepad: Gamepad): Promise<GamepadInfo> {
	const baseInfo: GamepadInfo = {
		...parseGamepadId(gamepad.id),
		standard: gamepad.mapping === 'standard',
		buttonNames: SYSTEM_BUTTON_NAME,
		analogNames: ['leftx', 'lefty', 'rightx', 'righty'],
	};
	const originInfo = {
		id: gamepad.id,
		buttons: gamepad.buttons.length,
		axes: gamepad.axes.length,
		index: gamepad.index,
		mapping: gamepad.mapping,
	};

	//unstandard
	if (gamepad.mapping !== 'standard') {
		if (baseInfo.vendor !== '' && baseInfo.product !== '') {
			// Hand-written overrides win over every DB source. Lazy, like the SDL DB below: only a
			// non-standard controller reaches here, so a standard pad never fetches the .txt files.
			const override = await localOverrideFor(baseInfo.vendor, baseInfo.product);
			if (override) return { ...override, originInfo };

			// Lazy: only non-standard controllers reach here → DB loads on demand.
			const db = gamepadDB.length ? [...(await ensureDB()), ...gamepadDB] : await ensureDB();
			for (let info of extraGamepadDB) {
				if (info.vendor === baseInfo.vendor && info.product === baseInfo.product) {
					//} && info.platform===OS && info.browser===BROWSER){
					return { ...info, originInfo };
				}
			}

			for (let info of db) {
				if (info.vendor === baseInfo.vendor && info.product === baseInfo.product) {
					//unstandard and DB data
					if (OS != 'Windows') {
						let analogNames: string[] = ['leftx', 'lefty', 'rightx', 'righty'];
						let analogPlusNames: string[] = [];
						let analogMinusNames: string[] = [];
						const buttonNames: string[] = [...SYSTEM_BUTTON_NAME];
						const keyMapping: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
						return {
							...info,
							buttonNames,
							keyMapping,
							analogNames,
							analogPlusNames,
							analogMinusNames,
							originInfo,
						};
					}
					return { ...info, originInfo };
				}
			}
		}

		//unstandard and no DB data
		const buttonNames: string[] = [];
		const analogNames: string[] = [];
		for (let i = 0; i < gamepad.buttons.length; i++) {
			buttonNames[i] = 'button' + (1 + i);
		}
		for (let i = 0; i < gamepad.axes.length; i++) {
			analogNames[i] = 'axes' + (1 + i);
		}
		return {
			...baseInfo,
			analogNames,
			buttonNames,
			defaultSwapAB: getSwapAB(baseInfo.vendor, baseInfo.product),
			originInfo,
		};
	}

	let result: GamepadInfo = {
		...baseInfo,
		originInfo,
	};

	if (result.buttonNames.length < gamepad.buttons.length) {
		for (let i = result.buttonNames.length; i < gamepad.buttons.length; i++) {
			result.buttonNames[i] = 'button' + i;
		}
	}

	return result;
}

//Dpad and Analog================================================================

const lrxyReg = /^([+|-])?(left|right)(x|y|trigger)$/;

//hardcode..

function makeDirection(
	threshold: number,
	dpad?: DpadPress,
	leftA?: XY,
	rightA?: XY
): Record<DirectSource, DirectionWrap | null> {
	return {
		leftAnalog: leftA ? getAnalogDirection(leftA, threshold) : null,
		rightAnalog: rightA ? getAnalogDirection(rightA, threshold) : null,
		dpad: dpad ? getDpadDirection(dpad) : null,
	};
}

export function getDirectionAvailable(info: GamepadInfo): Record<DirectSource, boolean> {
	//standard
	if (info.originInfo!.mapping == 'standard') {
		return {
			dpad: info.originInfo!.buttons >= 15,
			leftAnalog: info.originInfo!.axes >= 2,
			rightAnalog: info.originInfo!.axes >= 4,
		};
	}

	//non standard
	let haveTypeSet = new Set<string>();
	if (info.hatDpad) haveTypeSet.add('dpad');
	//button
	for (let i = 0; i < info.originInfo!.buttons; i++) {
		if (info.buttonNames[i]) {
			if (info.buttonNames[i]!.substring(0, 2) === 'dp') {
				haveTypeSet.add('dpad');
			} else {
				const valArr = info.buttonNames[i]!.match(lrxyReg);
				if (valArr) {
					const [, dir, lr, xy] = valArr;
					haveTypeSet.add(lr);
				}
			}
		}
	}
	//analog
	for (let i = 0; i < info.originInfo!.axes; i++) {
		let analogType = 0;
		let name = '';
		if (info.analogNames[i] != null) {
			analogType = 0;
			name = info.analogNames[i];
		} else if (info.analogPlusNames && info.analogPlusNames[i]) {
			analogType = 1;
			name = info.analogPlusNames[i];
		} else if (info.analogMinusNames && info.analogMinusNames[i]) {
			analogType = -1;
			name = info.analogMinusNames[i];
		} else {
			continue;
		}
		if (name.substring(0, 2) === 'dp') {
			haveTypeSet.add('dpad');
		} else {
			const valArr = name.match(lrxyReg);
			//const valArr=info.buttonNames[i]!.match(lrxyReg)
			if (valArr) {
				const [, dir, lr, xy] = valArr;
				haveTypeSet.add(lr);
			}
		}
	}

	//result
	return {
		dpad: haveTypeSet.has('dpad'),
		leftAnalog: haveTypeSet.has('left'),
		rightAnalog: haveTypeSet.has('right'),
	};
}

export function getDirection(
	gamepad: Gamepad,
	info: GamepadInfo,
	threshold: number = 0.15
): Record<DirectSource, DirectionWrap | null> {
	//standard
	if (gamepad.mapping == 'standard') {
		return makeDirection(
			threshold,
			gamepad.buttons.length >= 16
				? {
						up: gamepad.buttons[12].pressed,
						down: gamepad.buttons[13].pressed,
						left: gamepad.buttons[14].pressed,
						right: gamepad.buttons[15].pressed,
					}
				: undefined,
			gamepad.axes.length >= 2
				? {
						x: gamepad.axes[0],
						y: gamepad.axes[1],
					}
				: undefined,
			gamepad.axes.length >= 4
				? {
						x: gamepad.axes[2],
						y: gamepad.axes[3],
					}
				: undefined
		);
	}

	//non standard
	let dpad: DpadPress = {
		up: false,
		down: false,
		left: false,
		right: false,
	};
	let analogRaw: { left: XY; right: XY } = {
		left: { x: 0, y: 0 },
		right: { x: 0, y: 0 },
	};
	let haveTypeSet = new Set<string>();
	//button
	for (let i = 0; i < gamepad.buttons.length; i++) {
		if (info.buttonNames[i]) {
			if (info.buttonNames[i]!.substring(0, 2) === 'dp') {
				haveTypeSet.add('dpad');
				if (gamepad.buttons[i].pressed) {
					dpad[info.buttonNames[i]!.substring(2) as 'up' | 'down' | 'left' | 'right'] = true;
				}
			} else {
				const valArr = info.buttonNames[i]!.match(lrxyReg);
				if (valArr) {
					const [, dir, lr, xy] = valArr;
					haveTypeSet.add(lr);
					if (gamepad.buttons[i].pressed) {
						analogRaw[lr as 'left' | 'right'][xy as 'x' | 'y'] = dir === '-' ? -1 : dir === '+' ? 1 : 0;
					} else {
						const v = gamepad.buttons[i].value;
						analogRaw[lr as 'left' | 'right'][xy as 'x' | 'y'] = dir === '-' ? -v : v;
					}
				}
			}
		}
	}
	//analog
	for (let i = 0; i < gamepad.axes.length; i++) {
		let analogType = 0;
		let name = '';
		if (info.analogNames[i] != null) {
			analogType = 0;
			name = info.analogNames[i];
		} else if (info.analogPlusNames && info.analogPlusNames[i] && gamepad.axes[i] > 0) {
			analogType = 1;
			name = info.analogPlusNames[i];
		} else if (info.analogMinusNames && info.analogMinusNames[i] && gamepad.axes[i] < 0) {
			analogType = -1;
			name = info.analogMinusNames[i];
		} else {
			if (info.hatDpad) {
				haveTypeSet.add('dpad');
				const HNum = Math.round(gamepad.axes[i] * 7);
				if (Math.abs(gamepad.axes[i] * 7 - HNum) < 0.000001 && HDpadMapping[HNum.toString()]) {
					const v = HDpadMapping[HNum.toString()];
					for (let key in dpad) {
						dpad[key as Dpad] = (v & info.hatDpad[key as Dpad]) > 0;
					}
				}
			}

			continue;
		}
		if (name.substring(0, 2) === 'dp') {
			haveTypeSet.add('dpad');
			if (
				Math.abs(gamepad.axes[i]) > threshold &&
				(analogType === 0 ||
					(gamepad.axes[i] > 0 && analogType === 1) ||
					(gamepad.axes[i] < 0 && analogType === -1))
			) {
				dpad[name.substring(2) as 'up' | 'down' | 'left' | 'right'] = true;
			}
		} else {
			const valArr = name.match(lrxyReg);
			if (valArr) {
				const [, dir, lr, atype] = valArr;
				haveTypeSet.add(lr);
				//if(Math.abs(gamepad.axes[i])<threshold )continue;
				if (atype == 'x' || atype == 'y') {
					analogRaw[lr as 'left' | 'right'][atype as 'x' | 'y'] = gamepad.axes[i];
					//*(dir==='-'?-1:(dir==='+'?1:0))
				} else if (atype == 'trigger') {
					//*
				}
			}
		}
	}
	//result
	return makeDirection(
		threshold,
		haveTypeSet.has('dpad') ? dpad : undefined,
		haveTypeSet.has('left') ? analogRaw.left : undefined,
		haveTypeSet.has('right') ? analogRaw.right : undefined
	);
}

export function getExtraAnalog(gamepad: Gamepad, info: GamepadInfo): Record<string, number> {
	const result: Record<string, number> = {};
	for (let i = 0; i < gamepad.axes.length; i++) {
		let analogType = 0;
		let name = '';
		if (info.analogNames[i] != null) {
			analogType = 0;
			name = info.analogNames[i];
		} else if (info.analogPlusNames && info.analogPlusNames[i] && gamepad.axes[i] > 0) {
			analogType = 1;
			name = info.analogPlusNames[i];
		} else if (info.analogMinusNames && info.analogMinusNames[i] && gamepad.axes[i] < 0) {
			analogType = -1;
			name = info.analogMinusNames[i];
		} else {
			continue;
		}
		if (name.substring(0, 2) === 'dp') {
			continue;
		} else {
			const valArr = name.match(lrxyReg);
			if (valArr) {
				const [, dir, lr, atype] = valArr;
				if (atype == 'x' || atype == 'y') {
					continue;
				}
			}
			result[name] = gamepad.axes[i];
		}
	}
	return result;
}

//Button================================================================

/*
export function getRawButtonPress(gamepad:Gamepad):boolean[]{
	const result:boolean[]=[];
	for(let i=0;i<gamepad.buttons.length;i++){
		result[i]=gamepad.buttons[i].pressed;
	}
	return result;
}
*/

export function getButtonPress(gamepad: Gamepad, info: GamepadInfo, skipDpad: boolean = false): (boolean | null)[] {
	const result: (boolean | null)[] = [];
	for (let i = 0; i < gamepad.buttons.length; i++) {
		if (gamepad.mapping === 'standard') {
			if (!info.buttonNames[i]) {
				result[i] = null;
				continue;
			}
			if (skipDpad && i >= 12 && i <= 15) {
				result[i] = null;
				continue;
			}
			result[i] = gamepad.buttons[i].pressed;
		} else {
			const converToStandKey: number = info.keyMapping?.[i] ?? i;
			if (!info.buttonNames[i]) {
				// special case for some SDL mapping not counting trigger as button but analog
				if (info.buttonNames[5] == 'rightshoulder' && info.buttonNames[8] == 'back') {
					if (
						(i == 6 && info.analogNames.indexOf('lefttrigger') >= 0) ||
						(i == 7 && info.analogNames.indexOf('righttrigger') >= 0)
					) {
						result[i] = gamepad.buttons[i].pressed;
						continue;
					}
				}
				result[converToStandKey] = null;
				continue;
			}
			if (skipDpad) {
				if (info.buttonNames[i]!.substring(0, 2) === 'dp') {
					result[converToStandKey] = null;
					continue;
				} else {
					const valArr = info.buttonNames[i]!.match(lrxyReg);
					if (valArr) {
						result[converToStandKey] = null;
						continue;
					}
				}
			}

			result[converToStandKey] = gamepad.buttons[i].pressed;
		}
	}
	return result;
}

export function getButtonValue(gamepad: Gamepad, info: GamepadInfo, skipDpad: boolean = false): (number | null)[] {
	const result: (number | null)[] = [];
	for (let i = 0; i < gamepad.buttons.length; i++) {
		if (gamepad.mapping === 'standard') {
			if (!info.buttonNames[i]) {
				result[i] = null;
				continue;
			}
			if (skipDpad && i >= 12 && i <= 15) {
				result[i] = null;
				continue;
			}
			result[i] = gamepad.buttons[i].value;
		} else {
			const converToStandKey: number = info.keyMapping?.[i] ?? i;
			if (!info.buttonNames[i]) {
				// special case for some SDL mapping not counting trigger as button but analog
				if (info.buttonNames[5] == 'rightshoulder' && info.buttonNames[8] == 'back') {
					if (
						(i == 6 && info.analogNames.indexOf('lefttrigger') >= 0) ||
						(i == 7 && info.analogNames.indexOf('righttrigger') >= 0)
					) {
						result[i] = gamepad.buttons[i].value;
						continue;
					}
				}
				result[converToStandKey] = null;
				continue;
			}
			if (skipDpad) {
				if (info.buttonNames[i]!.substring(0, 2) === 'dp') {
					result[converToStandKey] = null;
					continue;
				} else {
					const valArr = info.buttonNames[i]!.match(lrxyReg);
					if (valArr) {
						result[converToStandKey] = null;
						continue;
					}
				}
			}

			result[converToStandKey] = gamepad.buttons[i].value;
		}
	}
	return result;
}

/**
 * Standard button names by standard index — the same set for every vendor.
 * For the vendor's own *look*, render {@link getButtonGlyphs} instead of renaming.
 */
export function getButtonName(info: GamepadInfo): (string | null)[] {
	const result: (string | null)[] = [];

	//get original name
	for (let i = 0; i < info.buttonNames.length; i++) {
		if (info.buttonNames[i]) {
			const converToStandKey: number = info.keyMapping?.[i] ?? i;
			result[converToStandKey] = info.buttonNames[i];

			// special case for some SDL mapping not counting trigger as button but analog
		} else if (info.buttonNames[5] == 'rightshoulder' && info.buttonNames[8] == 'back') {
			if (i == 6 && info.analogNames.indexOf('lefttrigger') >= 0) {
				result[6] = 'lefttrigger';
			}
			if (i == 7 && info.analogNames.indexOf('righttrigger') >= 0) {
				result[7] = 'righttrigger';
			}
		}
	}

	return result;
}
