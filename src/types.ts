import { dpad, directionWrap, dpadPress, xy } from './direction';

export type gamepadInfo = {
	name: string;
	buttonNames: (string | null)[];
	analogNames: string[];
	standard: boolean;
	defaultSwapAB?: boolean;
	guid?: string;
	vendor?: string;
	product?: string;
	hatDpad?: Record<dpad, number>;
	analogPlusNames?: string[];
	analogMinusNames?: string[];
	keyMapping?: (number | null)[];

	platform?: string;
	browser?: string;

	originInfo?: {
		id: string;
		buttons: number;
		axes: number;
		index: number;
		mapping: string;
	};
};

export type gamePadProfile = {
	vendorName?: string;
	vendor: string;
	productName?: string;
	product?: string;
	buttonNames: (string | null)[];
	defaultSwapAB?: boolean;
};
export enum directSource {
	dpad = 'dpad',
	leftAnalog = 'leftAnalog',
	rightAnalog = 'rightAnalog',
}

// PascalCase aliases (preferred going forward). Legacy lowerCamelCase names kept as-is.
export type GamepadInfo = gamepadInfo;
export type GamePadProfile = gamePadProfile;
export type DirectionWrap = directionWrap;
export type DpadPress = dpadPress;
export type XY = xy;
