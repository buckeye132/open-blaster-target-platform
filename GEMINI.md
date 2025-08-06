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

## Server-Side Unit Testing

To ensure the stability and quality of the game logic, all server-side code must be accompanied by unit tests. This is not optional.

### Mandatory Testing Policy

1.  **New Logic Requires New Tests:** All new features, game modes, or bug fixes in the `server/` directory **MUST** include corresponding unit tests.
2.  **All Tests Must Pass:** Before submitting any changes, you **MUST** run the entire test suite and ensure that all tests pass. No work is considered complete until it is covered by passing tests.

### How to Write Tests

We use the [Jest](https://jestjs.io/) framework for testing. Tests are located in the `server/test/` directory.

-   **Test File Naming:** Test files should be named `[name_of_file_to_test].test.js`.
-   **`StubTarget`:** To test game logic in isolation, use the `StubTarget` class from `server/test/stub_target.js`. This provides a deterministic, in-memory mock of a real target.
    -   **Queuing Events:** Use `stub.queueHit(reactionTime, value)` or `stub.queueMiss(value)` to pre-program how the stub should respond when activated.
    -   **Verifying Behavior:** Use `stub.getEventLog()` to retrieve a serialized log of all commands sent to the stub. You can then use Jest's `expect` assertions to verify the game logic behaved as expected.
-   **Fake Timers:** Use `jest.useFakeTimers()` at the top of your test file to mock `setTimeout` and other timer functions. This allows your tests to run instantly. Use `jest.runAllTimers()` to advance time and execute pending timers.

### Running Tests

To run all server-side unit tests, execute the following command from the project root:

```bash
npm test --prefix server
```

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

### WebSocket Communication

**All new client-server communication over WebSockets MUST adhere to the defined protocol.** Manual or one-off message formats are not permitted. All message types and their structures MUST be defined in `server/assets/protocol.mjs`.

- **Protocol Documentation:** For a complete overview of the WebSocket protocol, including message types and payload structures, please consult the [WebSocket Protocol Documentation](docs/websocket-protocol.md).
- **Using the Protocol:** The `Message` class in `protocol.mjs` provides builder methods for creating all valid messages. Use these builders to ensure your messages are compliant.

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

**All new code MUST use the `VisualScriptBuilder` to construct valid `<visual_script>` strings.** This avoids manual string manipulation, which is error-prone. Legacy code should be updated to use the builder when it is modified.

- **Location:** The `VisualScriptBuilder` is located in `server/target.js`.
- **Import:** `const { VisualScriptBuilder, Animations } = require('./target');`
- **Example:**
  ```javascript
  const script = new VisualScriptBuilder()
      .solid(500, 255, 0, 0) // Red for 500ms
      .animation(1000, Animations.PULSE, 0, 0, 255) // Blue pulse for 1000ms
      .build();
  target.activate(5000, 'my_value', 'my_hit_id', script);
  ```

### Use Animations for Visual Effects

The firmware supports a variety of animations that can be used to make games more visually appealing and to provide feedback to the player. Use these to create a more engaging experience.

- **`Animations` Enum:** Use the `Animations` enum from `server/target.js` to specify which animation to use. This ensures you are using a valid animation name.
- **Adding New Animations:** If you add a new animation to the firmware, you **must** also add it to the `Animations` enum in `server/target.js`.
- **Available Animations:** `PULSE`, `THEATER_CHASE`, `RAINBOW_CYCLE`, `COMET`, `WIPE`, `CYLON`, `SPARKLE`, `FIRE`, `CONVERGE`.
- **Example:** `target.display(1, new VisualScriptBuilder().animation(1000, Animations.THEATER_CHASE, 0, 255, 0).build());`

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
