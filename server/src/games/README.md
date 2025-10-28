# Game Modes

This directory contains the logic for all game modes in the Open Blaster Target Platform.

## Adding a New Game

To add a new game, follow these steps:

1.  **Create a New Directory:** Create a new directory for your game (e.g., `my_awesome_game`). The name of this directory will be used as the game's unique identifier.

2.  **Create the Backend Logic (`index.js`):** Inside your new directory, create an `index.js` file. This file must export a class that extends the `Game` class from `./base_game.js`. Implement the necessary methods (`onGameStart`, `onGameEnd`, `handleHit`, `handleExpired`) to define your game's logic.

3.  **Create the Frontend View (`view.html`):** Create a `view.html` file. This file contains the HTML structure for your game's UI that will be displayed on the game screen.

4.  **Create the Frontend Logic (`client.js`):** Create a `client.js` file in the same directory. This file will be served to the browser and should contain the client-side logic for your game. It must define a `window.initGame` function, which is called when the game starts. Inside `initGame`, you should also define a `window.handleGameMessage` function to receive and process updates from the server.

5.  **Automatic Registration:** The server will automatically discover your game, register it, and make the `client.js` and `view.html` files available to the frontend. No server configuration changes are needed.

6.  **Add to Lobby:** The lobby will automatically list the new game mode. If your game has configurable options, you need to:
    *   Implement the static `getOptions()` method in your game's class in `index.js`.
    *   The lobby UI will automatically generate the necessary input fields based on the options you provide.
