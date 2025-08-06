# Firmware
* Firmware crashes when invalid commands are received
* Debounce needs to be tuned to be more aggressive - our goal should be to support 20 hits per second so debounce is ok if less than 50ms. Current implementation ends up around 12ms

# New Game Modes

### "Armored Takedown"

* **Concept:** A cooperative or competitive "boss battle." One target is designated as the "boss" and requires multiple hits to defeat, while smaller "minion" targets with single hits pop up to distract players.
* **Objective:** Defeat the "boss" target by landing the required number of hits before the time runs out. Hitting minions can add to the score or extend the time limit.
* **Technical Implementation:**
    1.  **Setup:** The server defines multiple hit configurations.
        * For the boss: `CONFIG_HIT boss_final 3 DECREMENTAL 3000 ANIM THEATER_CHASE 255 0 0` (requires 3 hits, uses a health bar, and has a long final animation).
        * It also defines an interim hit: `CONFIG_INTERIM_HIT boss_final 150 SOLID 255 255 255` (a quick white flash for non-final hits).
        * For minions: `CONFIG_HIT minion 1 NONE 500 SOLID 0 255 0` (a simple, single-hit config).
    2.  **Gameplay:**
        * The server activates the "boss" target: `ON 30000 boss_value boss_final SOLID 255 0 255` (a solid magenta health bar).
        * Simultaneously, it activates single-hit "minion" targets around the field: `ON 5000 minion_value minion SOLID 0 255 255`.
    3.  **Target Logic:** The "boss" target will locally count hits, display the health bar depleting, and play its interim flash animation. It will only send the final `HIT` message to the server after the third hit is registered.

### "Defuse the Bomb" (Co-op or Solo)

* **Concept:** A high-pressure, time-based challenge. One target is designated as the "bomb" and displays a persistent, ominous animation. A sequence of other targets light up one by one in a specific pattern. Players must hit the sequence targets in the correct order to "defuse" the bomb.
* **Objective:** Successfully hit the entire defusal sequence before the main timer runs out.
* **Rules:**
    * Hitting a correct sequence target adds time back to the main clock.
    * Hitting an incorrect target or the bomb itself subtracts a large chunk of time.
* **Technical Implementation:**
    1.  **Setup:** The server designates one target as the "bomb" and sends it a looping display command: `DISPLAY 0 500 SOLID 255 0 0 | 500 SOLID 255 165 0` (an indefinite red/orange pulse). This target is not made "live" with an `ON` command.
    2.  **Gameplay:** The server activates the sequence targets one at a time: `ON 5000 sequence_1 standard_hit SOLID 0 255 255`.
    3.  **Server Logic:** The server manages the master game timer. When it receives a `HIT ... sequence_1`, it adds time to the clock and activates the next target in the sequence (`sequence_2`). If it receives a `HIT` from any other "live" target, it subtracts time.

# AI modes

### "Live Color Commentator"

* **Concept:** An AI provides real-time, energetic, and context-aware commentary on the player's performance during a game, much like a sports announcer.
* **High-Level Architecture:**
    1.  **Stateful Session:** At the start of a game, the Node.js server initiates a single, persistent "live" or streaming session with the Gemini API.
    2.  **Initial Context:** The server sends a detailed initial prompt that establishes the AI's persona ("You are an excited, over-the-top sports commentator..."), the rules of the game mode being played, and the starting conditions.
    3.  **Real-Time Updates:** As game events occur (e.g., a target is hit, a bonus is achieved, the timer runs low), the server sends very short, concise updates down the open stream (e.g., `EVENT: HIT, TIME: 287ms, STREAK: 4`).
    4.  **Streaming Audio Response:** The Gemini API generates the commentary and streams the audio response back to the server in real-time.
    5.  **Audio Playback:** The Node.js server receives the incoming audio stream and pipes it directly to the host computer's speakers.
* **Key Advantages:**
    * **Low Latency:** By using a stateful session and streaming audio directly, the delay between a player's action and the AI's comment is minimized, making the experience feel instantaneous.
    * **Context-Awareness:** Because the AI maintains the context of the entire game session, its commentary can be more intelligent and relevant, referencing previous hits, streaks, or changes in player performance.
    * **Efficiency:** Sending small event "deltas" is far more efficient than sending the entire game state with every API call.

### "Arcade Antagonist"

* **Concept:** The AI acts as a vocal and humorous antagonist, directly controlling the targets to create a short-form, arcade-style game. It will taunt the player, react to their performance with witty remarks, and dynamically change the challenge based on how well the player is doing.
* **High-Level Architecture:** This mode is a hybrid of the Commentator and DM modes. The AI generates both the game logic (commands) and its own personality (dialogue) in a single response.
    1.  **Initial Prompt:** The server starts a stateful session with a prompt that defines the AI's persona: "You are a witty, slightly arrogant AI who thinks no human can beat your target challenges. You will create a series of fast-paced rounds. After each round, I will tell you if the player succeeded or failed. You will respond with a taunt or comment, and the JSON commands for the next round."
    2.  **AI-Generated Rounds (JSON):** The AI's response contains both dialogue and commands.
    3.  **Server Execution:** The server plays the `dialogue_text` via TTS and sends the commands to the targets.
    4.  **Player Action & Reporting:** The player attempts the challenge. The server reports the simple outcome back to the AI: `RESULT: SUCCESS, REACTION: 450ms` or `RESULT: FAILURE, REASON: EXPIRED`.
    5.  **AI Reaction:** The AI receives the result and generates the next round, this time with new dialogue based on the player's performance.
* **Key Advantages:**
    * **High Engagement:** The antagonistic personality creates a fun and compelling reason for the player to keep trying to "beat the AI."
    * **Dynamic Difficulty:** The AI can be instructed to make the challenges harder (more distractions, shorter timeouts) after a success and easier after a failure, creating a naturally balanced difficulty curve.
    * **Emergent Gameplay:** The combination of the AI's creative round design and its personality-driven reactions makes every game feel unique and personal.

### "Dungeon Master" (DM)

* **Concept:** The AI acts as a "Game Master" or "Dungeon Master," creating a dynamic, narrative-driven challenge for the player. Instead of a fixed game loop, the AI decides what happens next based on the player's actions, effectively creating a unique, interactive story.
* **High-Level Architecture:**
    1.  **The Server as a "Narrative Engine":** The Node.js server's primary role is to manage the game state (like player health) and translate the AI's high-level narrative decisions into low-level target commands.
    2.  **Initial Prompt:** The server starts a stateful session with a prompt that defines the AI's role as a DM, the rules of the world, the available targets, and the required JSON output format for its commands.
    3.  **AI-Generated Scenarios (JSON):** The AI responds not with plain text, but with a structured JSON object containing two key parts: `narrator_text` and `commands`.
    4.  **Server Execution:** The server parses the JSON. It sends the `narrator_text` to a Text-to-Speech service and sends the `commands` to the appropriate targets.
    5.  **Player Action & Reporting:** The player interacts with the targets. The server reports the outcome (e.g., `HIT 560 drone_core`) back to the AI as a simple update in the ongoing conversation.
    6.  **The Loop Continues:** The AI processes the player's action and generates the next JSON response, creating a continuous, interactive gameplay loop.
* **Key Advantages:**
    * **Infinite Replayability:** No two playthroughs are the same. The AI can generate an endless variety of challenges, puzzles, and story beats.
    * **Emergent Gameplay:** The interaction between the AI's creative scenarios and the player's real-time actions can lead to unexpected and exciting gameplay moments.
    * **Maximum Flexibility:** This mode fully leverages the power of the OBTP protocol. The server can create any scenario imaginable simply by prompting the AI, which in turn uses the full palette of commands (`CONFIG_HIT`, `ON`, `DISPLAY`, etc.) to bring its story to life.