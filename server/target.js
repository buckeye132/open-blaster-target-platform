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

/**
 * Represents a single connected target, abstracting the raw TCP socket
 * and providing a clean API for sending and receiving protocol messages.
 */
class Target extends EventEmitter {
    constructor(socket) {
        super();
        this.socket = socket;
        this.id = socket.id;
        this.inputBuffer = '';

        // Set up listeners for the raw socket events
        this.socket.on('data', (data) => this._handleData(data));
        this.socket.on('close', () => this.emit('close'));
        this.socket.on('error', (err) => this.emit('error', err));
    }

    // --- Incoming Data Handling ---

    /**
     * Handles raw data from the TCP socket, parsing it into complete messages.
     * @param {Buffer} data - The raw data buffer.
     */
    _handleData(data) {
        this.inputBuffer += data.toString();
        let newlineIndex;
        while ((newlineIndex = this.inputBuffer.indexOf('\n')) !== -1) {
            const message = this.inputBuffer.substring(0, newlineIndex).trim();
            this.inputBuffer = this.inputBuffer.substring(newlineIndex + 1);
            if (message) {
                this._parseAndEmit(message);
            }
        }
    }

    /**
     * Parses a complete message from the target and emits a typed event.
     * @param {string} message - The message string from the target.
     */
    _parseAndEmit(message) {
        //console.log(`< [${this.id}] ${message}`);
        if (message.startsWith('HIT')) {
            const parts = message.split(' '); // HIT <reaction_ms> <value>
            const reactionTime = parseInt(parts[1], 10);
            const value = parts.length > 2 ? parts[2] : '';
            this.emit('hit', { reactionTime, value });
        } else if (message.startsWith('EXPIRED')) {
            const parts = message.split(' '); // EXPIRED <value>
            const value = parts.length > 1 ? parts[1] : '';
            this.emit('expired', { value });
        } else if (message === 'PONG') {
            this.emit('pong');
        } else {
            // For any other message, emit it as a generic log.
            this.emit('log', message);
        }
    }

    // --- Outgoing Command Methods ---

    /**
     * Sends a raw command string to the target.
     * @param {string} command The command string to send (e.g., "OFF").
     */
    _sendCommand(command) {
        if (this.socket.destroyed) {
            console.log(`WARN: Attempted to send command to destroyed socket: ${this.id}`);
            return;
        }
        //console.log(`> [${this.id}] ${command}`);
        this.socket.write(`${command}\n`);
    }

    /**
     * Configures the hit sensitivity, either manually or via auto-calibration.
     * @param {number} [threshold] - Optional manual threshold value.
     */
    configureThreshold(threshold) {
        if (threshold) {
            this._sendCommand(`CONFIG_THRESHOLD ${threshold}`);
        } else {
            this._sendCommand('CONFIG_THRESHOLD');
        }
    }

    /**
     * Defines a reusable, named reaction for a successful hit.
     * @param {string} id - A unique string identifier for the configuration.
     * @param {number} hitsRequired - The number of hits needed.
     * @param {'NONE' | 'DECREMENTAL'} healthBarMode - The health bar behavior.
     * @param {string|VisualScriptBuilder} visualScript - The visual sequence to play on the final hit.
     */
    configureHit(id, hitsRequired, healthBarMode, visualScript) {
        const script = typeof visualScript === 'string' ? visualScript : visualScript.build();
        this._sendCommand(`CONFIG_HIT ${id} ${hitsRequired} ${healthBarMode} ${script}`);
    }

    /**
     * Defines the visual feedback for a non-final hit when multiple hits are required.
     * @param {string} id - The ID of the multi-hit configuration this applies to.
     * @param {string|VisualScriptBuilder} visualScript - The visual script to play.
     */
    configureInterimHit(id, visualScript) {
        const script = typeof visualScript === 'string' ? visualScript : visualScript.build();
        this._sendCommand(`CONFIG_INTERIM_HIT ${id} ${script}`);
    }

    /**
     * Activates the target, making it "live" and scorable.
     * @param {number} timeoutMs - The duration the target remains active.
     * @param {string} value - The value to be returned in the HIT or EXPIRED message.
     * @param {string} hitConfigId - The ID of the hit configuration to use.
     * @param {string|VisualScriptBuilder} visualScript - The looping visual script to display.
     */
    activate(timeoutMs, value, hitConfigId, visualScript) {
        const script = typeof visualScript === 'string' ? visualScript : visualScript.build();
        this._sendCommand(`ON ${timeoutMs} ${value} ${hitConfigId} ${script}`);
    }

    /**
     * Plays a visual script a set number of times with the hit sensor disabled.
     * @param {number} loopCount - The number of times to repeat the script (0 for infinite).
     * @param {string|VisualScriptBuilder} visualScript - The visual script to play.
     */
    display(loopCount, visualScript) {
        const script = typeof visualScript === 'string' ? visualScript : visualScript.build();
        this._sendCommand(`DISPLAY ${loopCount} ${script}`);
    }

    /**
     * Deactivates the target and turns off its LEDs.
     */
    off() {
        this._sendCommand('OFF');
    }

    /**
     * Pings the target to check for responsiveness.
     */
    ping() {
        this._sendCommand('PING');
    }
}

const Animations = {
    PULSE: 'PULSE',
    THEATER_CHASE: 'THEATER_CHASE',
    RAINBOW_CYCLE: 'RAINBOW_CYCLE',
    COMET: 'COMET',
    WIPE: 'WIPE',
    CYLON: 'CYLON',
    SPARKLE: 'SPARKLE',
    FIRE: 'FIRE',
    CONVERGE: 'CONVERGE'
};

/**
 * Builder class for creating valid <visual_script> strings.
 * This helps prevent syntax errors and ensures compliance with the command protocol.
 */
class VisualScriptBuilder {
    constructor() {
        this.steps = [];
    }

    /**
     * Adds a solid color step to the visual script.
     * @param {number} durationMs - The duration to display the color.
     * @param {number} r - Red value (0-255).
     * @param {number} g - Green value (0-255).
     * @param {number} b - Blue value (0-255).
     * @returns {VisualScriptBuilder} The builder instance for chaining.
     */
    solid(durationMs, r, g, b) {
        if (typeof durationMs !== 'number' || durationMs < 0) {
            throw new Error('durationMs must be a non-negative number.');
        }
        if (typeof r !== 'number' || r < 0 || r > 255) {
            throw new Error('r must be a number between 0 and 255.');
        }
        if (typeof g !== 'number' || g < 0 || g > 255) {
            throw new Error('g must be a number between 0 and 255.');
        }
        if (typeof b !== 'number' || b < 0 || b > 255) {
            throw new Error('b must be a number between 0 and 255.');
        }
        this.steps.push(`${durationMs} SOLID ${r} ${g} ${b}`);
        return this;
    }

    /**
     * Adds a pre-programmed animation step to the visual script.
     * @param {number} durationMs - The duration to play the animation.
     * @param {string} name - The name of the animation (e.g., 'PULSE').
     * @param {number} r - Red value (0-255).
     * @param {number} g - Green value (0-255).
     * @param {number} b - Blue value (0-255).
     * @returns {VisualScriptBuilder} The builder instance for chaining.
     */
    animation(durationMs, name, r, g, b) {
        if (typeof durationMs !== 'number' || durationMs < 0) {
            throw new Error('durationMs must be a non-negative number.');
        }
        if (typeof name !== 'string' || !Object.values(Animations).includes(name)) {
            throw new Error(`Invalid animation name: ${name}`);
        }
        if (typeof r !== 'number' || r < 0 || r > 255) {
            throw new Error('r must be a number between 0 and 255.');
        }
        if (typeof g !== 'number' || g < 0 || g > 255) {
            throw new Error('g must be a number between 0 and 255.');
        }
        if (typeof b !== 'number' || b < 0 || b > 255) {
            throw new Error('b must be a number between 0 and 255.');
        }
        this.steps.push(`${durationMs} ANIM ${name} ${r} ${g} ${b}`);
        return this;
    }

    /**
     * Builds the final visual script string.
     * @returns {string} The complete, pipe-delimited visual script.
     */
    build() {
        return this.steps.join(' | ');
    }
}

module.exports = { Target, VisualScriptBuilder, Animations };