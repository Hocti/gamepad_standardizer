# Gamepad Standardizer

Gamepad Standardizer is a JavaScript library designed to standardize the gamepad input across different browsers and devices. By referencing the 'SDL_GameControllerDB' dataset, this library enables consistent mapping for gamepads that are marked with non-standard mapping in the HTML5 Gamepad API. This makes it easier to understand and use gamepad inputs such as D-pad, left and right analog sticks, regardless of the underlying hardware.

## Features

- Standardizes gamepad mappings across different browsers and devices.
- Simplifies the use of D-pad and analog stick inputs.
- Provides a consistent interface for accessing gamepad information.

## before

 I connected my PS5 controller and 8bitdo's SN30 to my computer using a USB cable and tested them on [hardwaretester](https://hardwaretester.com/gamepad) in both Firefox and Chrome. Neither of them had standard mapping.
Here are the results:

### ps5 @firefox
![img](https://github.com/Hocti/gamepad_standardizer/blob/main/doc/ps5.png?raw=true)
- FireFox don't ecognize PS5 controller as a standard mapping, everything became a mash
- Normally, B0 is the button on the right side, but now it has become the bottom button (X), which is B1.
- Usually, buttons 12 to 15 are the D-pad, but now buttons 12 and 13 have become the "PS" and "touchpad" buttons.
- The right analog stick is now using axes 2 and 5 (it usually uses axes 2 and 3), and the analog values for L2 and R2 have become axes 3 and 4.
- The D-pad results are combined into a single number at axis 9.

### 8bitdo SNES/SFC 30
![img](https://github.com/Hocti/gamepad_standardizer/blob/main/doc/sfc30.png?raw=true)
- Physically, it has 8 buttons and a D-pad, but the browser detects 13 buttons and 10 axes, with 5 buttons and 8 axes being non-functional (indicated by blue circles).
- Also, there are no actual D-pad buttons; the D-pad is registered as 2 axes.

## after

After using the Gamepad Standardizer from [my demo](https://hocti-demo.s3.ap-southeast-1.amazonaws.com/gamepad_standardizer/demo/demo.html) , here are the results:

### PS5 @firefox
![img](https://github.com/Hocti/gamepad_standardizer/blob/main/doc/ps5_ff.png?raw=true)
- The mapped button index now follows the [W3C standard](https://www.w3.org/TR/gamepad/#remapping), as returned by `getButtonPress` / `getButtonValue`.
- Unused buttons will return null.
- Buttons have one name set — the SDL_GameControllerDB standard names, as returned by `getButtonName`. What differs per vendor is the *artwork*, drawn from the `gamepad_fonts` colour webfont via `getButtonGlyphs` / `padFontId`.
- All D-pad and analog inputs are grouped into single Object, returned by `getDirection`.
- Extra analog values (triggers) are returned by `getExtraAnalog`.

### 8bitdo SFC30
![img](https://github.com/Hocti/gamepad_standardizer/blob/main/doc/sfc30_after.png?raw=true)
- `getDirection` now returns one d-pad only, not analog.
- By using `addPadFontProfile`, I told it to draw this pad with Nintendo glyphs, by providing controller's vender and product code.
- unused buttons would return null

### PS5 @ Chrome
![img](https://github.com/Hocti/gamepad_standardizer/blob/main/doc/ps5_chrome.png?raw=true)
- Chrome can recognize the PS5 controller as having standard mapping, so all inputs return normally.
- However, you can still benefit from the D-Pad/Analog result categorization.
- By running all the gamepads through the Gamepad Standardizer, you eliminate the need to worry about whether the mapping is standard or not.
- ✌️


## Installation

```bash
npm install gamepad-standardizer
```
or using jsdelivr
```html
<script src="https://cdn.jsdelivr.net/npm/gamepad_standardizer/dist/gamepad_standardizer.js"></script>
<script>
console.log(gamepad_standardizer)
</script>
```
or
```html
<script type="module">
import * as gamepad_standardizer from "https://cdn.jsdelivr.net/npm/gamepad_standardizer/dist/gamepad_standardizer.esm.js";
console.log(gamepad_standardizer)
</script>
```

## Usage

### Configuring the SDL DB source (optional)

The SDL controller DB is only loaded **lazily** — the very first time a *non-standard* controller
connects. Standard / xinput controllers never trigger a DB load. Choose where the DB comes from
with `configureDB`:

```javascript
import { configureDB } from 'gamepad_standardizer';

// Default (no call needed): fetch from GitHub raw, cached in localStorage.
configureDB({ mode: 'fetch' });

// Fetch from your own mirror, optionally disable the cache:
configureDB({ mode: 'fetch', url: './gamecontrollerdb.txt', cacheKey: false });

// No runtime network request — use the per-platform DB bundled inside the package:
configureDB({ mode: 'bundled' });

// Provide your own SDL text directly:
configureDB({ mode: 'custom', text: mySDLText });
```

> `SDLDB_setLink()` / `SDLDB_fetch()` still work but are **deprecated** — prefer `configureDB`.

### Per-device overrides (`local_override.txt`)

Some pads are mapped wrongly by the *browser*, so an SDL line cannot describe them — SDL numbers
buttons the way the OS reports them, while the browser hands you its own mapper's output. Those
pads are fixed with override entries written against **the indices the browser reports**.

They live in plain `.txt` files fetched at runtime, **not** compiled into the bundle. The package
ships one at `dist/db/local_override.txt` as the default — edit it in place, or point at your own:

```javascript
import { addLocalOverrideUrl, configureLocalOverrides, addLocalOverrides } from 'gamepad_standardizer';

// Add your own file on top of the shipped default. Later files win.
addLocalOverrideUrl('./my-pads.txt');

// Or replace the list outright:
configureLocalOverrides({ urls: ['./my-pads.txt'], includeDefault: false });

// Or hand over the text directly — e.g. inlined at build time, or from a settings screen.
// Needed for `file://` builds (Electron), where fetch() from an opaque origin is blocked:
import padOverrides from 'gamepad_standardizer/local_override.txt?raw';
configureLocalOverrides({ includeDefault: false });
addLocalOverrides(padOverrides);
```

Same lazy contract as the SDL DB: **nothing is fetched until a non-standard controller connects**,
and overrides are consulted *before* the SDL DB, so they win for that vendor/product. A missing or
unreachable file logs a warning and is treated as "no overrides" — it never breaks pad support.

The file's own header documents the entry format; see [`src/db/local_override.txt`](./src/db/local_override.txt).

### Getting Gamepad Information

Retrieve information about a connected gamepad:

```javascript
const gamepadInfo = await getGamepadInfo(navigator.getGamepads()[0]);
console.log(gamepadInfo);
```

### Processing Gamepad Inputs

Get the status of directional inputs from the gamepad:

```javascript
const directionStatus = getDirection(navigator.getGamepads()[0], gamepadInfo);
console.log(directionStatus);
```

### Handling Button Presses

Detect button presses on the gamepad:

```javascript
const buttonPresses = getButtonPress(navigator.getGamepads()[0], gamepadInfo);
console.log(buttonPresses);
```

## API Reference

- `configureDB(config)`: Choose the SDL DB source — `{ mode: 'fetch' | 'bundled' | 'custom', … }` (see Usage above). Preferred over `SDLDB_setLink`.
- `configureLocalOverrides({ urls?, includeDefault? })`: Replace the per-device override `.txt` list.
- `addLocalOverrideUrl(url: string)`: Add one more override `.txt` path; loaded last, so it wins.
- `addLocalOverrides(text: string)`: Add overrides as inline text, in the same format.
- `localOverrideFor(vendor, product)` / `localOverrideCount()` / `ensureLocalOverrides()`: async — trigger the lazy load.
- `DEFAULT_LOCAL_OVERRIDE_URL`: URL of the `.txt` shipped with the package.
- `SDLDB_setLink(link: string)`: **@deprecated** — sets the fetch link for the SDL database (now forwards to `configureDB({ mode: 'fetch', url })`).
- `getGamepadInfo(gamepad: Gamepad)`: Returns information about the connected gamepad.
- `getDirectionAvailable(gamepad: Gamepad, info: gamepadInfo)`: Checks the availability of directional inputs.
- `getDirection(gamepad: Gamepad, info: gamepadInfo, threshold?: number)`: Gets the status of directional inputs, threshold default is 0.1
- `getExtraAnalog(gamepad: Gamepad, info: gamepadInfo)`: Retrieves extra analog inputs.
- `getButtonPress(gamepad: Gamepad, info: gamepadInfo, skipDpad?: boolean)`: Detects button presses.
- `getButtonValue(gamepad: Gamepad, info: gamepadInfo, skipDpad?: boolean)`: Gets the value of button presses.
- `getButtonName(info: gamepadInfo)`: Retrieves the standard names of gamepad buttons (same set for every vendor).
- `getButtonGlyphs(info: gamepadInfo, opts?: GlyphOptions)`: Per-button glyph character + CSS font-family, drawn from the `gamepad_fonts` webfont.
- `padFontId(info: gamepadInfo, opts?: GlyphOptions)` / `padFontFamily(...)`: Which font family this controller should be drawn with.
- `installPadFonts(root?: Document | ShadowRoot)`: Injects the `@font-face` rules once.
- `addPadFontProfile(profile: PadFontProfile)`: Maps a vendor/product to the glyph artwork it should use.

## Contributing

Contributions to improve Gamepad Standardizer are welcome. Please ensure that your code adheres to the project's coding standards and includes appropriate tests.

## License

Gamepad Standardizer is [MIT licensed](./LICENSE).