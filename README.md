# Gamepad Standardizer

Gamepad Standardizer is a JavaScript library designed to standardize the gamepad input across different browsers and devices. By referencing the 'SDL_GameControllerDB' dataset, this library enables consistent mapping for gamepads that are marked with non-standard mapping in the HTML5 Gamepad API. This makes it easier to understand and use gamepad inputs such as D-pad, left and right analog sticks, regardless of the underlying hardware.

## Features

- Standardizes gamepad mappings across different browsers and devices.
- Simplifies the use of D-pad and analog stick inputs.
- Provides a consistent interface for accessing gamepad information.

## Installation

```bash
npm install gamepad-standardizer
```
then
```html
<script src="../dist/gamepad_standardizer.js"></script>
<script>
console.log(gamepad_standardizer)
</script>
```
or
```html
<script type="module">
import * as gamepad_standardizer from "../dist/gamepad_standardizer.esm.js";
console.log(gamepad_standardizer)
</script>
```

## Usage

### Getting Gamepad Information

Retrieve information about a connected gamepad:

```javascript
const gamepadInfo = await getGamepadInfo(navigator.getGamepads()[0]);
console.log(gamepadInfo);
```

### Processing Gamepad Inputs

Get the status of directional inputs from the gamepad:

```javascript
const directionStatus = getDirectionAvailable(navigator.getGamepads()[0], gamepadInfo);
console.log(directionStatus);
```

### Handling Button Presses

Detect button presses on the gamepad:

```javascript
const buttonPresses = getButtonPress(navigator.getGamepads()[0], gamepadInfo);
console.log(buttonPresses);
```

## API Reference

- `SDLDB_setLink(link: string)`: Sets the link to the SDL database, defaul is SDL_GameControllerDB's github link
- `getGamepadInfo(gamepad: Gamepad)`: Returns information about the connected gamepad.
- `getDirectionAvailable(gamepad: Gamepad, info: gamepadInfo)`: Checks the availability of directional inputs.
- `getDirection(gamepad: Gamepad, info: gamepadInfo, threshold?: number)`: Gets the status of directional inputs, threshold default is 0.1
- `getExtraAnalog(gamepad: Gamepad, info: gamepadInfo)`: Retrieves extra analog inputs.
- `getButtonPress(gamepad: Gamepad, info: gamepadInfo, skipDpad?: boolean)`: Detects button presses.
- `getButtonValue(gamepad: Gamepad, info: gamepadInfo, skipDpad?: boolean)`: Gets the value of button presses.
- `getButtonName(info: gamepadInfo, rename?: boolean)`: Retrieves the names of gamepad buttons.

## Contributing

Contributions to improve Gamepad Standardizer are welcome. Please ensure that your code adheres to the project's coding standards and includes appropriate tests.

## License

Gamepad Standardizer is [MIT licensed](./LICENSE).