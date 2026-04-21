# gamepad_standardizer

A browser JavaScript/TypeScript library that normalizes gamepad input across different browsers and devices.

## Why this exists

The HTML5 Gamepad API behaves differently in Chrome vs Firefox, and many gamepads report as "non-standard" mapping. For example:
- Firefox does not mark PS5 controllers as standard — button indices shift, D-pad becomes a single axis value.
- Some gamepads expose a D-pad as two analog axes instead of four buttons.

This library fixes all of that by using the [SDL_GameControllerDB](https://github.com/gabomdq/SDL_GameControllerDB) database to remap inputs into a consistent format.

## Package info

- **npm name**: `gamepad_standardizer`
- **version**: 2.0.1
- **entry**: `dist/gamepadStandardizer.mjs` (ESM) / `dist/gamepadStandardizer.js` (UMD)
- **source**: `src/`
- **build tool**: Vite

## Source files

| File | Purpose |
|------|---------|
| `src/index.ts` | Re-exports everything |
| `src/types.ts` | TypeScript types: `gamepadInfo`, `gamePadProfile`, `directSource` |
| `src/config.ts` | Button name constants (`SYSTEM_BUTTON_NAME`), hat D-pad mappings |
| `src/direction.ts` | Direction math — converts raw x/y or D-pad presses into a `directionWrap` object |
| `src/gamepad_standardizer.ts` | Main logic — all exported functions |
| `src/fixMapping.ts` | Helper functions to manually build `gamepadInfo` for custom mappings |

## Main API

All functions are exported from the package root.

### Setup (call once)

```ts
// Optional: point to a local copy of gamecontrollerdb.txt
SDLDB_setLink(link: string)

// Load extra mappings for gamepads not in SDL DB
// Format: platform:X,browser:X,name:X,vendor:X,product:X,buttonNames:A|B|C,...,a:b0,...
SDLDB_procesExtraText(text: string)

// Add a friendly button name profile for a specific controller
addbtnNameProfile(profile: gamePadProfile)
```

### Per-gamepad (call on gamepadconnected, then each frame)

```ts
// Step 1: get gamepad info (async — fetches SDL DB on first call if needed)
const info = await getGamepadInfo(gamepad: Gamepad): Promise<gamepadInfo>

// Step 2 (each frame): read inputs using the info object
getDirection(gamepad, info, threshold?)     // D-pad + analog sticks
getDirectionAvailable(info)                 // which direction sources exist
getExtraAnalog(gamepad, info)               // triggers and other non-stick axes
getButtonPress(gamepad, info, skipDpad?)    // button pressed state (boolean | null)[]
getButtonValue(gamepad, info, skipDpad?)    // button analog value (number | null)[]
getButtonName(info, rename?)               // button labels (SDL names or friendly names)
```

### Return types

**`gamepadInfo`** — describes the controller:
- `standard: boolean` — whether browser already reports it as standard
- `buttonNames` — raw SDL button names at each index
- `analogNames` / `analogPlusNames` / `analogMinusNames` — axis labels
- `keyMapping` — remaps non-standard button indices to W3C standard indices
- `hatDpad` — how to read D-pad from a single hat axis value
- `originInfo` — raw browser gamepad metadata

**`directionWrap`** — result of `getDirection()` per source (`dpad`, `leftAnalog`, `rightAnalog`):
- `up / down / left / right: boolean`
- `x / y: number` (normalized, dead-zone applied)
- `numpad: number` (1–9, numpad layout)
- `degree: number` (0–359)
- `radian: number`
- `distance: number` (0–1)
- `type: 'analog' | 'dpad'`

## Typical usage pattern

```ts
import { getGamepadInfo, getDirection, getButtonPress, getButtonName } from 'gamepad_standardizer'

const infos = {}

window.addEventListener('gamepadconnected', async (e) => {
  infos[e.gamepad.index] = await getGamepadInfo(e.gamepad)
})

function loop() {
  for (const gp of navigator.getGamepads()) {
    if (!gp || !infos[gp.index]) continue
    const info = infos[gp.index]

    const dir = getDirection(gp, info)       // dir.dpad, dir.leftAnalog, dir.rightAnalog
    const btns = getButtonPress(gp, info)    // btns[0..16], null = unused
  }
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
```

## Button index reference (W3C standard order)

Index 0–3: face buttons (a, b, x, y), 4–5: shoulders, 6–7: triggers, 8–9: back/start, 10–11: stick clicks, 12–15: D-pad, 16: guide.

Built-in friendly name profiles: **Sony** (vendor `054c`) and **Nintendo** (vendor `057e`, A/B swapped by default).

## Build

```sh
pnpm build   # outputs to dist/
pnpm dev     # starts demo dev server
```
