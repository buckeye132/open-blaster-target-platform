# Open Blaster Target Platform (OBTP) Command Protocol

This document outlines the official command and messaging interface between the central game server and the smart targets. The protocol is designed to be text-based, extensible, and resilient to network latency.

---

## Core Concept: The `<visual_script>`

The foundation of this protocol is the **`<visual_script>`**, a standardized string format for describing a sequence of visual events. It allows the server to define and send complex animations and color patterns to the targets.

* **Structure:** A `<visual_script>` consists of one or more `<steps>`, separated by a pipe character (`|`).
* **`<step>` Format:** Each step is defined by its duration and the visual state to display.
    * Syntax: `<duration_ms> <visual_state>`
* **`<visual_state>` Format:** A visual state can be one of two types:
    * `SOLID <R> <G> <B>`: A solid color (e.g., `SOLID 0 255 0`).
    * `ANIM <name> <R> <G> <B>`: A looping, pre-programmed animation (e.g., `ANIM PULSE 255 0 255`).

**Example `<visual_script>`:**
`250 SOLID 255 0 0 | 250 SOLID 0 0 0 | 1000 ANIM THEATER_CHASE 255 165 0`
* **Translation:** Show solid red for 250ms, turn off for 250ms, then play an orange theater chase for 1000ms.

---

## Server-to-Target Commands

These commands are sent from the server to the targets. All commands are terminated with a newline character (`\n`).

### 1. Configuration Commands
These are sent once at the beginning of a game to set up the targets' local behaviors.

* **`CONFIG_THRESHOLD <threshold_value>`**
    * **Purpose:** Sets the sensitivity of the piezo hit sensor.
    * **Example:** `CONFIG_THRESHOLD 200`

* **`CONFIG_HIT <hit_config_id> <hits_required> <health_bar_mode> <visual_script>`**
    * **Purpose:** Defines a reusable, named reaction that a target will execute locally upon a successful hit.
    * **Parameters:**
        * `<hit_config_id>`: A unique string identifier (e.g., "standard", "boss_final").
        * `<hits_required>`: The number of physical hits needed to trigger this reaction.
        * `<health_bar_mode>`: Can be `NONE` or `DECREMENTAL`.
        * `<visual_script>`: The visual sequence to play when the *final* hit is successful.
    * **Example:** `CONFIG_HIT boss_final 3 DECREMENTAL 3000 ANIM THEATER_CHASE 255 0 0`

* **`CONFIG_INTERIM_HIT <hit_config_id> <visual_script>`**
    * **Purpose:** Defines the brief visual feedback for a non-final hit when a target requires multiple hits.
    * **Example:** `CONFIG_INTERIM_HIT boss_final 150 SOLID 255 255 255`

### 2. Action Commands
These commands make a target "live" and able to be scored upon.

* **`ON <timeout_ms> <value> <hit_config_id> <visual_script>`**
    * **Purpose:** Activates the target. The provided `<visual_script>` will loop continuously until the `timeout_ms` expires or the target is hit.
    * **Example:** `ON 5000 positive_point standard 100 ANIM PULSE 0 255 0 | 900 SOLID 0 0 0`

### 3. Display-Only Commands
These commands are for visual effects where the target should not be scorable.

* **`DISPLAY <loop_count> <visual_script>`**
    * **Purpose:** Plays a `<visual_script>` a set number of times with the hit sensor disabled.
    * **Parameters:**
        * `<loop_count>`: The number of times to repeat the entire visual script. Use `0` to loop indefinitely until an `OFF` command is received.
    * **Example:** `DISPLAY 1 500 SOLID 255 0 0 | 1000 ANIM CYLON 255 0 0`

### 4. Utility Commands

* **`OFF`**
    * **Purpose:** A universal command to stop any current action (`ON` or `DISPLAY`) and turn the LEDs off, returning the target to an idle state.

* **`STATUS_REQUEST`**
    * **Purpose:** Asks the target to immediately report its current internal state.

---

## Target-to-Server Messages

These messages are sent from the targets back to the server.

* **`HIT <reaction_ms> <value>`**
    * **Purpose:** Sent the instant a target registers a successful hit.
    * **Parameters:**
        * `<reaction_ms>`: The time in milliseconds from when the `ON` command was received to when the final hit was detected.
        * `<value>`: The identifier that was provided in the `ON` command.

* **`EXPIRED <value>`**
    * **Purpose:** Sent if a target's `timeout_ms` from an `ON` command expires before it is successfully hit.

* **`STATUS_REPORT <state> [<details>]`**
    * **Purpose:** The target's response to a `STATUS_REQUEST` command.
    * **Parameters:**
        * `<state>`: The target's current high-level state (e.g., `IDLE`, `READY`, `DISPLAYING`).
        * `[<details>]`: An optional string containing the full command the target is currently executing.
    * **Example:** `STATUS_REPORT READY ON 20000 boss_value boss_final 1000 SOLID 0 255 0`