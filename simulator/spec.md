# Open Blaster Target Simulator Specification

This document outlines the communication protocol between the Open Blaster game server and a target device. The simulator must adhere to this protocol to act as a virtual target.

## 1. Connection

-   **Protocol:** TCP
-   **Server Address:** The simulator must be able to connect to the game server's IP address.
-   **Server Port:** `8888`

## 2. Core Simulator Behavior

Each simulated target should be an independent object that maintains its own state, mirroring the firmware's state machine.

-   **State Machine:** Each target instance must have an internal state. The primary states are:
    -   `IDLE`: The initial and default state. The target is inactive.
    -   `READY`: The target is active and can be "hit". Entered upon receiving an `ON` command.
    -   `DISPLAYING`: The target is playing a non-interactive animation. Entered upon receiving a `DISPLAY` command.
-   **Message Handling:** The simulator must parse incoming newline-delimited (`\n`) commands from the server.
-   **UI Interaction:**
    -   The UI should display the current state of each simulated target.
    -   The UI must provide a "Hit" button for each target. This button should only be active when the target is in the `READY` state.
    -   Pressing the "Hit" button should cause the simulator to send a `HIT` message to the server.

## 3. Commands (Server -> Simulator)

The simulator must listen for and react to the following commands sent by the server. All commands are single-line ASCII strings terminated by a newline (`\n`).

---

### `ON <timeoutMs> <value> <hitConfigId> <visual_script>`

Activates the target.

-   **Behavior:**
    1.  Change state to `READY`.
    2.  Store the `<value>` and `<hitConfigId>`.
    3.  Start a timer for `<timeoutMs>`. If the timer expires before a `HIT` is simulated, send an `EXPIRED` message.
    4.  The UI should indicate the target is active (e.g., change color, display the visual script).
-   **Example:** `ON 5000 some_game_value default_hit 5000 SOLID 0 255 0`

---

### `OFF`

Deactivates the target.

-   **Behavior:**
    1.  Change state to `IDLE`.
    2.  Cancel any pending timeout timers.
    3.  The UI should indicate the target is inactive.
-   **Example:** `OFF`

---

### `DISPLAY <loopCount> <visual_script>`

Plays a non-interactive visual sequence.

-   **Behavior:**
    1.  Change state to `DISPLAYING`.
    2.  The UI should reflect the visual script being played.
    3.  After the script finishes, change state back to `IDLE`.
-   **Example:** `DISPLAY 1 500 SOLID 255 0 0 | 500 SOLID 0 0 255`

---

### `CONFIG_HIT <id> <hitsRequired> <healthBarMode> <visual_script>`

Defines a reusable hit configuration.

-   **Behavior:**
    1.  The simulator must store these configurations. When a target is activated with a `<hitConfigId>`, it should use the corresponding `<hitsRequired>` value.
-   **Example:** `CONFIG_HIT multi_hit 3 DECREMENTAL 1000 ANIM PULSE 255 255 0`

---

### `CONFIG_INTERIM_HIT <id> <visual_script>`

Defines the visual feedback for a non-final hit.

-   **Behavior:**
    1.  The simulator should store this to know what to display on non-final hits if it were to simulate the visuals accurately. For the basic simulator, this can be ignored, but the command must be accepted.
-   **Example:** `CONFIG_INTERIM_HIT multi_hit 250 SOLID 255 165 0`

---

### `CONFIG_THRESHOLD [threshold]`

Configures the hit sensitivity.

-   **Behavior:** This command can be safely ignored by the simulator, as hits are triggered by a UI button, not a physical sensor. The command must be accepted without error.
-   **Example:** `CONFIG_THRESHOLD 2000`

---

### `PING`

Checks for connectivity.

-   **Behavior:** The simulator must immediately respond with a `PONG` message.
-   **Example:** `PING`

## 4. Messages (Simulator -> Server)

The simulator will send the following messages to the server, terminated by a newline (`\n`).

---

### `HIT <reaction_ms> <value>`

Sent when the "Hit" button is pressed for a target in the `READY` state.

-   **`<reaction_ms>`:** The time elapsed since the `ON` command was received. The simulator must calculate this.
-   **`<value>`:** The `<value>` that was provided in the corresponding `ON` command.
-   **Example:** `HIT 342 some_game_value`

---

### `EXPIRED <value>`

Sent when a `READY` target's timer runs out.

-   **`<value>`:** The `<value>` that was provided in the corresponding `ON` command.
-   **Example:** `EXPIRED some_game_value`

---

### `PONG`

Sent in response to a `PING` command.

-   **Example:** `PONG`

---

### `LOG: <message>`

The simulator can send log messages for debugging purposes. This is optional.

-   **Example:** `LOG: Simulated target 1 connected.`

## 5. Visual Script Format

A `<visual_script>` is a string composed of one or more steps, delimited by a pipe (`|`). Each step defines a visual effect and its duration.

-   **Step Format:** `<durationMs> <type> [parameters...]`
-   **Types:**
    -   `SOLID <r> <g> <b>`: A solid color.
    -   `ANIM <name> <r> <g> <b>`: A pre-defined animation.
-   **Example:** `500 SOLID 255 0 0 | 1000 ANIM PULSE 0 0 255`
