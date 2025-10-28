# Gemini Guide: Adding a New Game Mode

This document outlines the steps for Gemini to add a new game mode to the Open Blaster Target Platform.

## File Structure

For a new game named `[game_name]`, create the following directory and files:

```
server/
└── src/
    └── games/
        └── [game_name]/
            ├── index.js    // Backend game logic
            ├── client.js   // Frontend UI logic
            └── view.html   // Frontend UI structure
```

## 1. Create Backend Logic (`index.js`)

- **File:** `server/src/games/[game_name]/index.js`
- **Inherit:** The class must extend `Game` from `../base_game.js`.
- **Implement Core Methods:**
    - `constructor(clients, targets, options)`: Call `super()` and initialize game state.
    - `onGameStart()`: Contains the main game loop and logic.
    - `onGameEnd()`: Handles game cleanup.
    - `handleHit(target, value)`: Logic for when a target is successfully hit.
    - `handleExpired(target, value)`: Logic for when a target is missed (expires).
- **Options (Optional):**
    - Implement a static `getOptions()` method to expose configurable settings to the lobby.

### `index.js` Template:
```javascript
const Game = require('../base_game');
const { VisualScriptBuilder, Animations } = require('../../../target');

class MyGame extends Game {
    constructor(clients, targets, options) {
        super(clients, targets, options);
        // Initialize your game state here
        this.score = 0;
    }

    static getOptions() {
        return {
            gameLength: {
                label: 'Game Length (seconds)',
                type: 'number',
                default: 30,
            }
        };
    }

    onGameStart() {
        // Your game start logic here
        this.broadcast('updateScore', { score: this.score });
    }

    onGameEnd() {
        // Your game end logic here. This is for cleanup.
        // The base class handles broadcasting the 'gameEnd' message.
        this.broadcast('gameOver', { finalScore: this.score });
    }

    handleHit(target, { value }) {
        // Your hit handling logic here
        this.score++;
        this.broadcast('updateScore', { score: this.score });
    }

    handleExpired(target, value) {
        // Your miss handling logic here
    }
}

module.exports = MyGame;
```

## 2. Create Frontend View (`view.html`)

- **File:** `server/src/games/[game_name]/view.html`
- **Purpose:** Define the HTML elements and layout for the game's UI. Use unique IDs for elements that will be updated by the client script.

### `view.html` Template:
```html
<div class="my-game-container">
    <div class="info-box">
        <span class="info-label">Score</span>
        <span id="score" class="info-value">0</span>
    </div>
</div>
```

## 3. Create Frontend Logic (`client.js`)

- **File:** `server/src/games/[game_name]/client.js`
- **Purpose:** Handle UI updates based on messages from the server.
- **Required Functions:**
    - `window.initGame = (options, ws, aiCommentary) => { ... }`: Called on game start. Get references to DOM elements here.
    - `window.handleGameMessage = (payload) => { ... }`: Receives messages broadcasted from the server. Use a `switch` statement on `payload.updateType` to handle different messages.

### `client.js` Template:
```javascript
let scoreEl;

window.initGame = (options, ws, aiCommentary) => {
    scoreEl = document.getElementById('score');

    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'updateScore':
                scoreEl.innerText = updatePayload.score;
                break;
            case 'gameOver':
                // Handle game over display
                break;
            // Handle other message types from your server logic
        }
    };
};
```

## 4. Core Concepts & Best Practices

### State Management
**Do not use `this.state` for internal game logic.** The base `Game` class uses this property for the main game lifecycle (`pending`, `running`, `finished`). Using it in your subclass will break the game flow. For your game's specific internal state, use a differently named property (e.g., `this.myGameState`, `this.phase`).

### Game Duration & Termination
- **Finite Games:** By default, games run for 30 seconds. To specify a different duration, your game's `getOptions()` should return a `gameLength` option, and you should pass the user-provided `options` to the `super(clients, targets, options)` constructor.
- **Indefinite Games:** To create a game with no automatic time limit (e.g., a demo sequence or a level-based game), pass `{ gameLength: 0 }` in the options object to the `super()` constructor.
- **Ending the Game:** In games with no time limit, you **must** call `this.stop()` manually based on your game's logic to terminate the game correctly.

### Game End Event
The base `Game` class automatically emits the `gameOver` event when `this.stop()` is called. **Do not emit `gameOver` manually from your subclass.** This is crucial for ensuring the server properly cleans up the game instance and allows a new game to be started.

## 5. Verification

- The game will be automatically registered by the server on startup.
- The new game will automatically appear in the lobby dropdown.
- If `getOptions()` is implemented, the settings will automatically appear in the lobby when the game is selected.
