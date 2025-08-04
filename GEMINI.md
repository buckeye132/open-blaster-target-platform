# Gemini Development Guidelines

When adding or changing any commands in the server or firmware code, please consult the [command protocol documentation](docs/command-protocol.md) to ensure that the changes are compatible with the existing system.

## Adding a New Game Mode

Adding a new game mode to the Open Blaster Target Platform involves several steps, touching both the backend server and the frontend UI. This guide will walk you through the process, highlighting critical steps to ensure your new game integrates smoothly.

### 1. Create the Backend Game Logic

First, create a new JavaScript file for your game in the `server/games/` directory. This file will contain the core logic for your game mode.

- **Create the File:** Create a new file named `your_game_mode.js` in `server/games/`.
- **Inherit from BaseGame:** Your game class should extend the `Game` class from `server/games/base.js`. This provides a consistent interface for all game modes.
- **Implement Core Methods:** You must implement the `start()`, `stop()`, `onHit()`, and `onExpired()` methods. The `start()` method is `async` and will be awaited by the base class.

### 2. Integrate the New Game into the Server

Next, you need to make the server aware of your new game mode.

- **Edit `server/server.js`:**
    - **Import Your Game:** Add a `require` statement to import your new game file (e.g., `const YourGameMode = require('./games/your_game_mode');`).
    - **Add to `gameModes`:** Add your new game to the `gameModes` object (e.g., `'your_game_mode': YourGameMode,`).

### 3. Create the Frontend Game File

Now, create the corresponding frontend file in the `server/assets/` directory. This file will handle the UI updates for your game.

- **Create the File:** Create a new file named `your_game_mode.js` in `server/assets/`.
- **Implement `initGame`:** This file must contain a `window.initGame` function. This function is called by `game.js` when your game is selected.
- **Handle WebSocket Messages:** Inside `initGame`, set up a WebSocket connection and handle messages from the server to update the UI.

### 4. Update the Lobby UI

Finally, add your new game mode to the lobby so that it can be selected by the user.

- **Edit `server/assets/lobby.html`:**
    - **Add to Dropdown:** Add a new `<option>` to the `game-mode-select` dropdown (e.g., `<option value="your_game_mode">Your Game Mode</option>`).
- **Edit `server/assets/lobby.js`:**
    - **Handle Game Settings:** If your game has custom settings, you'll need to add logic to the `gameModeSelect` event listener to show/hide the settings UI.

### Common Pitfalls

- **Missing Frontend File:** Forgetting to create the frontend JavaScript file in `server/assets/` will result in a 404 error when you try to start the game.
- **`async` `start()` Method:** The `start()` method in your game logic file is asynchronous. Ensure that you are using `await` correctly when calling other asynchronous functions within it.
- **Base Game `await`:** The `setupAndStart` function in `server/games/base.js` must `await this.start()` to ensure the game logic is fully executed.
