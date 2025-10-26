# Game Modes

This directory contains the logic for all game modes in the Open Blaster Target Platform.

## Adding a New Game

To add a new game, follow these steps:

1.  **Create a New Directory:** Create a new directory for your game (e.g., `my_awesome_game`). The name of this directory will be used as the game's unique identifier.

2.  **Create the Backend Logic:** Inside your new directory, create an `index.js` file. This file must export a class that extends the `Game` class from `../game.js`. Implement the necessary methods (`onGameStart`, `onGameEnd`, `handleHit`, `handleExpired`) to define your game's logic.

3.  **Create the Frontend Logic:** Create a `client.js` file in the same directory. This file will be served to the browser and should contain the client-side logic for your game. It must define a `window.initGame` function.

4.  **Automatic Registration:** The server will automatically detect and register your new game mode at startup. No further changes to the server code are needed.

5.  **Add to Lobby:** Add your new game to the dropdown list in `server/assets/lobby.html` and handle any game-specific settings in `server/assets/lobby.mjs`.
