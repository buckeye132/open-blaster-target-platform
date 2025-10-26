# Open Blaster Target Simulator

This application is a desktop tool built with Electron to simulate multiple Open Blaster target devices. It is designed for testing the Open Blaster game server without needing physical hardware.

## Features

- **Simulate Multiple Targets:** Create any number of virtual targets.
- **Persistent Identity:** Each target has a stable ID, allowing for testing disconnect and reconnect scenarios.
- **Full State Machine:** Implements the complete target state machine (`IDLE`, `READY`, `DISPLAYING`, `HIT_ANIMATION`).
- **Multi-Hit Support:** Correctly handles game modes that require multiple hits to score.
- **Visual Script Display:** Shows the current color and animation name being executed by the target.
- **Command Logging:** Each target features a collapsable, real-time log of all TCP commands sent to and received from the server.

## How to Run

1.  Navigate to this directory (`simulator/`) in your terminal.
2.  Install the required dependencies:
    ```bash
    npm install
    ```
3.  Start the application:
    ```bash
    npm start
    ```

## How to Use

1.  **Start the Game Server:** Ensure the main game server (`server/server.js`) is running.
2.  **Enter Server IP:** In the simulator UI, enter the IP address of the machine running the game server (use `127.0.0.1` if it's on the same machine).
3.  **Add Targets:** Click the "Add Target" button to create new simulated targets.
4.  **Manage Connections:** Use the "Connect" / "Disconnect" button on each target to manage its connection to the server.
5.  **Simulate Hits:** When a game is running and a target is active (indicated by the `READY` state and a green border), click the "Hit" button to simulate a hit.
6.  **View Logs:** Expand the "Logs" section on any target to see a detailed history of the protocol messages for that specific target.
7.  **Delete Targets:** Click the small "X" button to permanently remove a target from the simulator.
