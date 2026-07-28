import { Dpad } from './direction';

export type GamepadInfo = {
	name: string;
	buttonNames: (string | null)[];
	analogNames: string[];
	standard: boolean;
	defaultSwapAB?: boolean;
	guid?: string;
	vendor?: string;
	product?: string;
	hatDpad?: Record<Dpad, number>;
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

export enum DirectSource {
	dpad = 'dpad',
	leftAnalog = 'leftAnalog',
	rightAnalog = 'rightAnalog',
}
