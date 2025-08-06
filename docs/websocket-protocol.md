# Open Blaster WebSocket Protocol

This document defines the WebSocket communication protocol between the game server and the web browser client. All communication over the WebSocket is expected to adhere to this specification to ensure reliability and maintainability.

## Core Concept: The Message Envelope

All messages, regardless of direction, are sent as a JSON object conforming to the "Message Envelope" structure. This provides a consistent and predictable format for all communication.

The envelope has two properties:

-   `type` (String, Required): A unique identifier for the message's purpose. This MUST be one of the values from the `MessageType` enum defined in `server/assets/protocol.mjs`.
-   `payload` (Object, Optional): An object containing the data relevant to the message type. If a message requires no data, this property can be omitted.

**Example Envelope:**

```json
{
  "type": "S2C_GAME_UPDATE",
  "payload": {
    "updateType": "updateScore",
    "score": 1500
  }
}
```

## Protocol Definition File

The single source of truth for this protocol is the `server/assets/protocol.mjs` file. This file contains:

-   `MessageType`: An enum-like object containing all valid message type strings.
-   `Message`: A class with static builder methods for creating valid message objects for every message type.

**All new WebSocket message functionality MUST be added to this file.**

## Client-to-Server (C2S) Messages

These messages are sent from the web browser client to the server.

### `C2S_START_GAME`

-   **Purpose:** Initiates a new game.
-   **Payload:**
    -   `gameMode` (String): The identifier for the game to be started (e.g., `whack_a_mole`).
    -   `options` (Object): Game-specific settings (e.g., `{ "gameLength": 45 }`).
    -   `aiCommentary` (Boolean): Whether to enable the AI commentator.

### `C2S_STOP_GAME`

-   **Purpose:** Sent by the client to prematurely end the currently active game.
-   **Payload:** None.

### `C2S_GET_AI_AVAILABILITY`

-   **Purpose:** Sent by the lobby to check if the AI commentator is configured and available on the server.
-   **Payload:** None.

### `C2S_TARGET_COMMAND`

-   **Purpose:** A unified message for sending diagnostic commands to a specific target from the lobby.
-   **Payload:**
    -   `targetId` (String): The ID of the target to command.
    -   `command` (String): The specific command to execute (e.g., `test-leds`, `calibrate-piezo`, `test-hit`).
    -   `options` (Object, Optional): Any additional options for the command.

## Server-to-Client (S2C) Messages

These messages are sent from the server to the web browser client.

### `S2C_AI_AVAILABILITY`

-   **Purpose:** The server's response to `C2S_GET_AI_AVAILABILITY`.
-   **Payload:**
    -   `available` (Boolean): `true` if the AI commentator is available, `false` otherwise.

### `S2C_TARGET_LIST_UPDATE`

-   **Purpose:** Sent whenever a target connects or disconnects, providing the client with the current list of available targets.
-   **Payload:**
    -   `targetList` (Array<String>): An array of the IDs of all currently connected targets.

### `S2C_TARGET_LOG_MESSAGE`

-   **Purpose:** Forwards a log message from a target to the client for display in the lobby.
-   **Payload:**
    -   `from` (String): The ID of the target that sent the message.
    -   `message` (String): The log message content.

### `S2C_GAME_START`

-   **Purpose:** Informs the client that the game has officially started.
-   **Payload:** Contains any initial state the game UI needs. The structure is game-dependent.

### `S2C_GAME_UPDATE`

-   **Purpose:** A generic wrapper for all real-time, in-game events (e.g., score changes, timer ticks).
-   **Payload:**
    -   `updateType` (String): The specific type of game event (e.g., `updateScore`, `updateTimer`, `hitFlurryStart`).
    -   `...` (any): The rest of the payload contains the data for that specific `updateType`.

### `S2C_GAME_OVER`

-   **Purpose:** Informs the client that the game has ended.
-   **Payload:** Contains the final game results (e.g., `{ "finalScore": 5000 }`). The structure is game-dependent.
