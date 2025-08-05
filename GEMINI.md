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

## Working on a Roadmap Feature

When working on a feature from the [roadmap](docs/roadmap.md), please follow these steps:

1.  **Create a new branch:** Always start by creating a new branch from the `main` branch. Name your branch something descriptive (e.g., `feat/simon-says-game-mode`).
2.  **Commit incrementally:** Make small, incremental commits to your feature branch. This makes it easier to review your changes and track your progress.
3.  **Reference the roadmap:** When you are finished, open a pull request and reference the roadmap item you are addressing.

## AI Integration

To enable the AI features, you will need to create a `.env` file in the `server` directory with the following content:

```
GEMINI_API_KEY=your_api_key
```

Replace `your_api_key` with your actual Gemini API key.

## Commit Messages

All commit messages should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This ensures a consistent and readable commit history.

### Common Pitfalls

- **Missing Frontend File:** Forgetting to create the frontend JavaScript file in `server/assets/` will result in a 404 error when you try to start the game.
- **`async` `start()` Method:** The `start()` method in your game logic file is asynchronous. Ensure that you are using `await` correctly when calling other asynchronous functions within it.
- **Base Game `await`:** The `setupAndStart` function in `server/games/base.js` must `await this.start()` to ensure the game logic is fully executed.

## Game Mode Best Practices

When developing new game modes, please adhere to the following best practices to ensure consistency, robustness, and a high-quality user experience.

### Always Define Game Length

All games should have a finite duration. This prevents games from running indefinitely and provides a clear end-point for the player.

- **Implementation:** In your game's constructor, accept an `options` object and set a `gameLength` property. Default to a reasonable duration (e.g., 30 seconds) if no option is provided.
- **Example:**
  ```javascript
  constructor(clients, targets, options) {
      super(clients, targets);
      this.gameLength = (options.gameLength || 30) * 1000; // In milliseconds
      this.gameTimeout = null;
  }
  ```
- **Termination:** In your `start()` method, use `setTimeout` to call your `stop()` method after the `gameLength` has elapsed.

### Visual Script Syntax

The firmware requires a placeholder duration at the beginning of a visual script for `activate` commands. While this value is ignored by the firmware for `activate`, it is still required.

- **Correct:** `target.activate(5000, 'my_value', 'my_hit_id', '0 SOLID 255 0 0');`
- **Incorrect:** `target.activate(5000, 'my_value', 'my_hit_id', 'SOLID 255 0 0');`

### Use Animations for Visual Effects

The firmware supports a variety of animations that can be used to make games more visually appealing and to provide feedback to the player. Use these to create a more engaging experience.

- **Available Animations:** `PULSE`, `THEATER_CHASE`, `RAINBOW_CYCLE`, `COMET`, `WIPE`, `CYLON`, `SPARKLE`, `FIRE`, `CONVERGE`.
- **Example:** `target.display(1, '1000 ANIM THEATER_CHASE 0 255 0');`

### Adding a Configurable Option to the Lobby

To add a configurable option (like game length) to the lobby, you need to modify both `lobby.html` and `lobby.js`.

1.  **`server/assets/lobby.html`:** Add the HTML for your new setting. Create a new `div` with a unique ID and the `game-settings` class.

    ```html
    <div id="my-game-settings" class="game-settings">
        <label for="my-game-length">Game Length (seconds)</label>
        <input type="number" id="my-game-length" value="30">
    </div>
    ```

2.  **`server/assets/lobby.js`:**
    -   Get a reference to your new settings elements.
    -   In the `gameModeSelect` event listener, add logic to show your settings `div` when your game is selected.
    -   In the `startGameButton` event listener, add logic to read the value from your input and add it to the URL parameters.

### Using the Scoreboard

The main game UI (`game.html`) provides a `scoreboard` div for displaying real-time game information like score, round, or time.

-   **Element ID:** The element to target is `document.getElementById('scoreboard')`.
-   **Implementation:** In your game's frontend JavaScript file (e.g., `server/assets/my_game.js`), get a reference to this element in your `initGame` function. Create a function (e.g., `updateScoreboard`) that is called by your WebSocket message handler to update the `innerHTML` of the scoreboard element.
-   **Example:**
    ```javascript
    // In your game's .js file
    let scoreboardEl;

    window.initGame = (options, ws) => {
        scoreboardEl = document.getElementById('scoreboard');
        // ... your other init logic
    };

    function updateScoreboard(score) {
        if (scoreboardEl) {
            scoreboardEl.innerHTML = `<h2>Score: ${score}</h2>`;
        }
    }
    ```
