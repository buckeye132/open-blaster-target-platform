/*
 * Copyright 2025 https://github.com/buckeye132
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
const { VisualScriptBuilder } = require('../target');
let Message;
import('../assets/protocol.mjs').then(protocol => {
    Message = protocol.Message;
});

/**
 * Base class for all game modes, defining a common interface.
 */
class Game extends EventEmitter {
    constructor(clients, targets) {
        super();
        this.clients = clients; // Set of WebSocket clients for broadcasting
        this.targets = targets; // Array of Target objects
    }

    /**
     * Performs common pre-game setup (calibration, countdown) and then starts the game.
     */
    async setupAndStart() {
        console.log("LOG: Starting game setup...");

        // 1. Calibrate all targets
        this.broadcast('gameSetup', { stage: 'calibration', message: 'Calibrating all targets...' });
        const calibrationPromises = this.targets.map(target => {
            return new Promise(resolve => {
                target.configureThreshold();
                // A more robust solution would wait for a confirmation message from the target.
                // For now, we'll use a timeout.
                setTimeout(resolve, 1500); // Assume calibration takes ~1.5s
            });
        });
        await Promise.all(calibrationPromises);
        console.log("LOG: Calibration complete.");

        // 2. 5-second countdown with flashing targets
        this.broadcast('gameSetup', { stage: 'countdown', message: 'Get ready!' });
        const redFlash = new VisualScriptBuilder().solid(250, 255, 0, 0);
        const yellowFlash = new VisualScriptBuilder().solid(250, 255, 255, 0);
        const greenFlash = new VisualScriptBuilder().solid(250, 0, 255, 0);

        for (let i = 5; i > 0; i--) {
            this.broadcast('countdown', { count: i });
            let scriptToPlay;

            if (i === 5) {
                scriptToPlay = redFlash;
            } else if (i > 1) {
                scriptToPlay = yellowFlash;
            } else { // i === 1
                scriptToPlay = greenFlash;
            }

            this.targets.forEach(target => {
                target.display(1, scriptToPlay);
            });

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 3. Start the actual game logic
        console.log("LOG: Starting core game logic.");
        await this.start();
    }

    /**
     * Starts the core game logic. Must be implemented by subclasses.
     */
    start() {
        throw new Error("Game.start() must be implemented by a subclass");
    }

    /**
     * Stops the game and cleans up. Must be implemented by subclasses.
     */
    stop() {
        throw new Error("Game.stop() must be implemented by a subclass");
    }

        /**
     * Handles a 'HIT' message from a target. This is the final method.
     * It emits the 'hit' event for global listeners and then calls the
     * overridable handleHit method for subclass-specific logic.
     * @param {Target} target The target that was hit.
     * @param {object} value The value associated with the hit.
     */
    onHit(target, value) {
        this.emit('hit', target, value);
        this.handleHit(target, value);
    }

    /**
     * Handles an 'EXPIRED' message from a target. This is the final method.
     * It emits the 'miss' event for global listeners and then calls the
     * overridable handleExpired method for subclass-specific logic.
     * @param {Target} target The target that timed out.
     * @param {string} value The value associated with the expiration.
     */
    onExpired(target, value) {
        this.emit('miss', target, value);
        this.handleExpired(target, value);
    }

    /**
     * Overridable method for subclass-specific hit logic.
     * @param {Target} target The target that was hit.
     * @param {object} value The value associated with the hit.
     */
    handleHit(target, value) {
        // Meant to be overridden by subclasses
    }

    /**
     * Overridable method for subclass-specific expiration logic.
     * @param {Target} target The target that timed out.
     * @param {string} value The value associated with the expiration.
     */
    handleExpired(target, value) {
        // Meant to be overridden by subclasses
    }""

    /**
     * Broadcasts a message to all connected web clients.
     * @param {string} type The message type.
     * @param {object} payload The message payload.
     */
    broadcast(type, payload) {
        const message = Message.gameUpdate(type, payload);
        const jsonMessage = JSON.stringify(message);
        for (const client of this.clients) {
            client.send(jsonMessage);
        }
    }
}

module.exports = Game;
