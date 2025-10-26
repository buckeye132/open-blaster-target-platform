# Gemini Development Guide - Target Simulator

This document outlines the architecture of the Electron-based target simulator and provides guidance for making future changes.

## Architecture Overview

The application follows a standard Electron architecture with a **Main Process** and a **Renderer Process**.

### 1. Main Process (`main.js`)

-   **Role:** This is the backend of the application. It manages the application window, handles all TCP socket connections to the game server, and maintains the authoritative state of each simulated target.
-   **State Management:** The state of all targets is held in the `targetStates` Map. Each target has a comprehensive state object that includes its current gameplay state (`IDLE`, `READY`, etc.), hit counts, and stored hit configurations. This process is the single source of truth.
-   **Communication:**
    -   **TCP:** It directly creates and manages `net.Socket` objects for all communication with the game server.
    -   **IPC (Inter-Process Communication):** It uses `ipcMain` to listen for commands from the UI (e.g., `hit`, `connect-target`).

### 2. Renderer Process (`renderer.js`)

-   **Role:** This script manages the User Interface (the `index.html` window). It is responsible for all DOM manipulation, such as creating target elements, updating styles, and changing text.
-   **State:** The renderer is **stateless**. It simply reflects the state information it receives from the Main Process. It does not make gameplay decisions.
-   **Communication:** It communicates with the Main Process exclusively through the `window.electronAPI` object exposed by the preload script.

### 3. Preload Script (`preload.js`)

-   **Role:** This script acts as a secure bridge between the Main and Renderer processes.
-   **Mechanism:** It uses `contextBridge.exposeInMainWorld` to expose a specific, secure API to the renderer. It defines all the channels for sending commands to the Main process (e.g., `api.hit()`) and for receiving events from the Main process (e.g., `api.onStateChange()`).

## Change Guidance

Follow these patterns when modifying the code.

### How to Add a New UI Interaction (e.g., a New Button)

1.  **UI Element:** Add the button or element to the `innerHTML` template in `renderer.js`.
2.  **Send Command:** Add an event listener in `renderer.js` that calls a new function on the `window.electronAPI` object (e.g., `window.electronAPI.myNewAction(targetId)`).
3.  **Expose Channel:** In `preload.js`, add the new function to the `electronAPI` object, which sends a message over a new IPC channel (e.g., `myNewAction: (targetId) => ipcRenderer.send('my-new-action', targetId)`).
4.  **Handle Command:** In `main.js`, add an `ipcMain.on('my-new-action', ...)` handler to execute the backend logic for the action.

### How to Display New State Information

1.  **Track State:** The new piece of information must first be added to and tracked within the appropriate target's state object in the `targetStates` Map in `main.js`.
2.  **Update Payload:** In `main.js`, find the `updateTargetState` function. Modify the `payload` object inside it to include the new state property.
3.  **Update Preload (If Needed):** The `onStateChange` channel in `preload.js` already passes the entire state payload. You should not need to change it.
4.  **Update UI:** In `renderer.js`, modify the `onStateChange` handler. Destructure the new property from the `state` object it receives and use it to update the DOM (e.g., `myElement.textContent = state.myNewProperty`).
