/**
 * Button-glyph layer: maps a standardised gamepad onto {@link gamepad_fonts}.
 *
 * The standard W3C button order (index 0..16) lines up 1:1 with the neutral
 * font slots, so a button is just a character in the right family. Which family
 * (system) comes from the vendor id; Xbox additionally has a One vs 360 look.
 */
import {
	type FontId,
	type PadSlot,
	type Direction8,
	type DirectionSource,
	glyphChar,
	fontFamily,
	directionGlyphChar,
	numpadDirection,
	COMMON_FONT_FAMILY,
} from 'gamepad_fonts';
import type { DirectionWrap } from './direction';
import type { GamepadInfo } from './types';

const SONY_VENDOR_ID = '054c';
const NINTENDO_VENDOR_ID = '057e';

export type PadSystem = 'xbox' | 'playstation' | 'switch';

/** Xbox has two looks: `one` (grey chip, coloured glyph) or `360` (coloured chip). */
export type XboxStyle = 'one' | '360';

export interface GlyphOptions {
	/** Only affects pads that resolve to the xbox family. Default `'one'`. */
	xboxStyle?: XboxStyle;
}

/**
 * Which font a controller is *drawn* with. This replaces the old per-vendor
 * `buttonNames` tables: the names are now one shared set, so a vendor only has to
 * say which artwork it wants — one line instead of eighteen strings.
 */
export interface PadFontProfile {
	vendorName?: string;
	vendor: string;
	productName?: string;
	/** Omit to match every product from this vendor. */
	product?: string;
	system: PadSystem;
    defaultSwapAB?: boolean;
}

const padFontProfiles: PadFontProfile[] = [
	{ vendorName: 'Sony', vendor: SONY_VENDOR_ID, system: 'playstation' },
	{ vendorName: 'Nintendo', vendor: NINTENDO_VENDOR_ID, system: 'switch' },
];

/**
 * Teach the library which artwork a controller should use — e.g. an 8BitDo SF30
 * that should be drawn with Nintendo glyphs. Anything unregistered falls back to
 * the xbox family, which is also the standard/XInput layout.
 */
export function addPadFontProfile(profile: PadFontProfile): void {
	padFontProfiles.push(profile);
}

/** Standard button index (0..16) -> neutral font slot. */
const INDEX_TO_SLOT: (PadSlot | null)[] = [
	'a', 'b', 'x', 'y',
	'lb', 'rb', 'lt', 'rt',
	'back', 'start', 'ls', 'rs',
	'up', 'down', 'left', 'right',
	'guide',
];

/** Which controller family this gamepad is drawn as. Unregistered vendors are xbox. */
export function padSystem(info: GamepadInfo): PadSystem {
	//most specific match wins: a vendor+product entry beats a vendor-wide one
	let match: PadFontProfile | undefined;
	for (const profile of padFontProfiles) {
		if (profile.vendor !== info.vendor) continue;
		if (profile.product) {
			if (profile.product === info.product) return profile.system;
		} else if (!match) {
			match = profile;
		}
	}
	return match?.system ?? 'xbox';
}

/** The gamepad_fonts font id to render this gamepad's glyphs with. */
export function padFontId(info: GamepadInfo, opts: GlyphOptions = {}): FontId {
	switch (padSystem(info)) {
		case 'playstation':
			return 'playstation';
		case 'switch':
			return 'switch';
		default:
			return opts.xboxStyle === '360' ? 'xbox-360' : 'xbox-one';
	}
}

/** CSS font-family for this gamepad's glyphs. */
export function padFontFamily(info: GamepadInfo, opts: GlyphOptions = {}): string {
	return fontFamily(padFontId(info, opts));
}

/** Neutral slot for a standard button index, or `null` if the index is unused. */
export function buttonSlot(index: number): PadSlot | null {
	return INDEX_TO_SLOT[index] ?? null;
}

/**
 * A direction looks the same on every pad, so the four d-pad buttons come from
 * the common sheet rather than the vendor one — the artwork there actually shows
 * a d-pad with one arm lit, instead of a bare arrow on a vendor-coloured chip.
 */
const DPAD_SLOT_DIRECTION: Partial<Record<PadSlot, Direction8>> = {
	up: 'up',
	down: 'down',
	left: 'left',
	right: 'right',
};

export interface ButtonGlyph {
	/** Standard button index. */
	index: number;
	/** Neutral slot name, or `null` for indices with no glyph. */
	slot: PadSlot | null;
	/** The character to render, or `null`. */
	char: string | null;
	/** CSS font-family to render `char` in. */
	fontFamily: string;
}

/**
 * One {@link ButtonGlyph} per standard button index (0..16), ready to render:
 * `el.style.fontFamily = g.fontFamily; el.textContent = g.char`.
 */
export function getButtonGlyphs(info: GamepadInfo, opts: GlyphOptions = {}): ButtonGlyph[] {
	const family = padFontFamily(info, opts);
	return INDEX_TO_SLOT.map((slot, index) => {
		const direction = slot ? DPAD_SLOT_DIRECTION[slot] : undefined;
		if (direction) {
			return {
				index,
				slot,
				char: directionGlyphChar('dpad', direction),
				fontFamily: COMMON_FONT_FAMILY,
			};
		}
		return {
			index,
			slot,
			char: slot ? glyphChar(slot) : null,
			fontFamily: family,
		};
	});
}

/**
 * The common-sheet character for a live {@link DirectionWrap} — the d-pad sheet for
 * a d-pad reading, the matching stick sheet otherwise. `double` lights the `>>`
 * double-tap marker (dash input).
 */
export function directionGlyph(
	direction: DirectionWrap,
	source: DirectionSource = direction.type === 'dpad' ? 'dpad' : 'lstick',
	double = false
): { char: string; fontFamily: string } {
	return {
		char: directionGlyphChar(source, numpadDirection(direction.numpad), double),
		fontFamily: COMMON_FONT_FAMILY,
	};
}

// Re-export the font runtime so consumers can install fonts without a second import.
export { installPadFonts, glyphChar, fontFamily, SLOTS, GLYPH_CHAR } from 'gamepad_fonts';
export type { FontId, PadSlot } from 'gamepad_fonts';

// `installPadFonts` also injects the keyboard and common @font-face rules, so a consumer
// that mixes pad, keyboard and direction hints (controlwrap) gets them all from one install.
export { KEYBOARD_FONT_FAMILY, KB_GLYPH, KB_CODES, kbGlyphChar } from 'gamepad_fonts';
export {
	COMMON_FONT_FAMILY,
	COMMON_GLYPH,
	COMMON_SLOTS,
	commonGlyphChar,
	directionGlyphChar,
	stickPressGlyphChar,
	numpadDirection,
} from 'gamepad_fonts';
export type { CommonSlot, Direction8, DirectionSource } from 'gamepad_fonts';
