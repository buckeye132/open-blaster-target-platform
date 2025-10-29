/*
 * Copyright 2025 The Gemini Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { EventEmitter } = require('events');
const { VisualScriptBuilder } = require('../../target');
let Message;
import('./protocol.mjs').then(protocol => {
    Message = protocol.Message;
});

/**
 * @class Game
 * @description Base class for all game modes. Provides a common interface and shared
 * functionality like a game timer, state management, and client broadcasting.
 * @fires Game#finished - Emitted when the game has finished.
 */
class Game extends EventEmitter {
    /**
     * @param {Set<WebSocket>} clients - A set of WebSocket clients for broadcasting game state.
     * @param {Target[]} targets - An array of Target objects available for the game.
     * @param {object} options - Game-specific options.
     * @param {number} [options.gameLength=30] - The duration of the game in seconds.
     */
    constructor(clients, targets, options = {}) {
        super();
        this.clients = clients;
        this.targets = targets;
        this.gameLength = parseFloat(options.gameLength ?? 30) * 1000; // In milliseconds
        this.gameTimeout = null;
        this.gameInterval = null;
        this.state = 'pending'; // 'pending', 'running', 'finished'
        this.timeRemaining = this.gameLength;
        this.isPaused = true;
        this.lastTick = 0;
    }

    /**
     * Returns a description of the configurable options for this game.
     * Subclasses should override this to provide their own options.
     * @returns {object} A description of the configurable options for this game.
     */
    static getOptions() {
        return {};
    }

    /**
     * Performs common pre-game setup (e.g., calibration, countdown) and then starts the game.
     */
    async setupAndStart() {
        console.log("LOG: Starting game setup...");

        // 1. Calibrate all targets (optional, can be overridden)
        this.broadcast('gameSetup', { stage: 'calibration', message: 'Calibrating targets...' });
        // In a real scenario, you might await confirmation from targets.
        // For now, we'll simulate a delay.
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log("LOG: Calibration complete.");

        // 2. Countdown
        this.broadcast('gameSetup', { stage: 'countdown', message: 'Get ready!' });
        for (let i = 5; i > 0; i--) {
            this.broadcast('countdown', { count: i });
            const script = new VisualScriptBuilder().solid(500, 255, 255, 0).build();
            this.targets.forEach(target => target.display(1, script));
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 3. Start the actual game
        console.log("LOG: Starting core game logic.");
        await this.start();
    }

    /**
     * Starts the game timer and transitions the game state to 'running'.
     * This method should not be overridden by subclasses. Instead, implement the
     * `onGameStart` method to define game-specific startup logic.
     */
    async start() {
        if (this.state !== 'pending') {
            return;
        }
        this.state = 'running';
        this.broadcast('gameStart', {});

        if (this.gameLength > 0 && isFinite(this.gameLength)) {
            console.log(`LOG: Game starting. Will run for ${this.gameLength / 1000} seconds.`);
            this.resumeTimer();
        } else {
            console.log('LOG: Game starting with no time limit.');
        }

        if (typeof this.onGameStart === 'function') {
            await this.onGameStart();
        }
    }

    /**
     * Stops the game, clears the timer, and transitions the game state to 'finished'.
     * This method should not be overridden by subclasses. Instead, implement the
     * `onGameEnd` method to define game-specific cleanup logic.
     */
    stop() {
        if (this.state !== 'running') {
            return;
        }
        console.log("LOG: Game stopping.");

        this.pauseTimer();
        this.state = 'finished';

        // Turn off all targets
        this.targets.forEach(target => target.off());

        this.broadcast('gameEnd', { message: 'Game Over!' });

        if (typeof this.onGameEnd === 'function') {
            this.onGameEnd();
        }
        this.emit('gameOver');
    }

    /**
     * Handles a 'HIT' message from a target. This is the entry point for hit events.
     * It checks if the game is running and then calls the subclass's `handleHit` method.
     * @param {Target} target - The target that was hit.
     * @param {object} value - The value associated with the hit.
     */
    onHit(target, value) {
        if (this.state !== 'running') return;
        if (typeof this.handleHit === 'function') {
            this.handleHit(target, value);
        }
    }

    /**
     * Handles an 'EXPIRED' message from a target. This is the entry point for miss events.
     * It checks if the game is running and then calls the subclass's `handleExpired` method.
     * @param {Target} target - The target that timed out.
     * @param {string} value - The value associated with the expiration.
     */
    onExpired(target, value) {
        if (this.state !== 'running') return;
        if (typeof this.handleExpired === 'function') {
            this.handleExpired(target, value);
        }
    }

    pauseTimer() {
        if (this.isPaused || this.state !== 'running') return;
        this.isPaused = true;
        if (this.gameTimeout) clearTimeout(this.gameTimeout);
        if (this.gameInterval) clearInterval(this.gameInterval);
        this.timeRemaining -= (Date.now() - this.lastTick);
    }

    resumeTimer() {
        if (!this.isPaused || this.state !== 'running') {
            // If it's the start of the game, isPaused is true, but we should proceed.
            if (this.timeRemaining !== this.gameLength) return;
        }

        this.isPaused = false;
        this.lastTick = Date.now();
        this.broadcast('gameTick', { remainingTime: Math.ceil(this.timeRemaining / 1000) });

        this.gameInterval = setInterval(() => {
            if (!this.isPaused) {
                this.broadcast('gameTick', { remainingTime: Math.ceil((this.timeRemaining - (Date.now() - this.lastTick)) / 1000) });
            }
        }, 1000);

        this.gameTimeout = setTimeout(() => this.stop(), this.timeRemaining);
    }

    /**
     * Broadcasts a message to all connected web clients.
     * @param {string} type - The message type.
     * @param {object} payload - The message payload.
     */
    broadcast(type, payload) {
        if (!Message) {
            console.error("Protocol message builder not initialized yet.");
            return;
        }
        const message = Message.gameUpdate(type, payload);
        const jsonMessage = JSON.stringify(message);
        for (const client of this.clients) {
            client.send(jsonMessage);
        }
    }

    // --- Abstract methods for subclasses to implement ---

    /**
     * @abstract
     * Called when the game's main logic should start.
     */
    onGameStart() {
        // To be implemented by subclasses
    }

    /**
     * @abstract
     * Called when the game ends, for cleanup.
     */
    onGameEnd() {
        // To be implemented by subclasses
    }

    /**
     * @abstract
     * Handles a hit on a target.
     * @param {Target} target - The target that was hit.
     * @param {object} value - The value associated with the hit.
     */
    handleHit(target, value) {
        // To be implemented by subclasses
    }

    /**
     * @abstract
     * Handles a target timing out (a miss).
     * @param {Target} target - The target that timed out.
     * @param {string} value - The value associated with the expiration.
     */
    handleExpired(target, value) {
        // To be implemented by subclasses
    }
}

module.exports = Game;
