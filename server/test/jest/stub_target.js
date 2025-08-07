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
 * A stub implementation of the Target class for use in unit tests.
 * It records all commands sent to it and can be configured to simulate
 * hits and misses.
 */
class StubTarget extends EventEmitter {
    constructor(id) {
        super();
        this.id = id;
        this.eventLog = [];
        this.hitQueue = [];
        this.missQueue = [];
    }

    // --- Test Configuration Methods ---

    /**
     * Queues up a hit event to be fired when this target is next activated.
     * @param {number} reactionTime The simulated reaction time in milliseconds.
     * @param {string} value The value that should be returned with the hit.
     */
    queueHit(reactionTime, value) {
        this.hitQueue.push({ reactionTime, value });
    }

    /**
     * Queues up a miss (expired) event to be fired when this target is next activated.
     * @param {string} value The value that should be returned with the miss.
     */
    queueMiss(value) {
        this.missQueue.push({ value });
    }

    /**
     * Returns the serialized event log.
     * @returns {string[]} The event log.
     */
    getEventLog() {
        return this.eventLog;
    }

    // --- Stubbed Target Methods ---

    configureThreshold(threshold) {
        this.eventLog.push(`configureThreshold(${threshold || ''})`);
    }

    configureHit(id, hitsRequired, healthBarMode, visualScript) {
        const script = typeof visualScript === 'string' ? visualScript : visualScript.build();
        this.eventLog.push(`configureHit(${id}, ${hitsRequired}, ${healthBarMode}, ${script})`);
    }

    configureInterimHit(id, visualScript) {
        const script = typeof visualScript === 'string' ? visualScript : visualScript.build();
        this.eventLog.push(`configureInterimHit(${id}, ${script})`);
    }


    activate(timeoutMs, value, hitConfigId, visualScript) {
        this.isActive = true;
        const script = typeof visualScript === 'string' ? visualScript : visualScript.build();
        this.eventLog.push(`activate(${timeoutMs}, ${value}, ${hitConfigId}, ${script})`);
        console.log(`[StubTarget ${this.id}] activated with value: ${value}`);

        if (this.hitQueue.length > 0) {
            const hit = this.hitQueue.shift();
            console.log(`[StubTarget ${this.id}] Queued hit will fire in ${hit.reactionTime}ms for value: ${hit.value}`);
            setTimeout(() => {
                console.log(`[StubTarget ${this.id}] Firing hit: ${hit.value}`);
                this.emit('hit', { reactionTime: hit.reactionTime, value: hit.value });
            }, hit.reactionTime);
        } else if (this.missQueue.length > 0) {
            const miss = this.missQueue.shift();
            console.log(`[StubTarget ${this.id}] Queued miss will fire in ${timeoutMs}ms for value: ${miss.value}`);
            setTimeout(() => {
                console.log(`[StubTarget ${this.id}] Firing miss: ${miss.value}`);
                this.emit('expired', { value: miss.value });
            }, timeoutMs);
        }
    }

    queueHit(reactionTime, value) {
        if (this.isActive) {
            console.log(`[StubTarget ${this.id}] Firing hit immediately: ${value}`);
            this.emit('hit', { reactionTime, value });
        } else {
            this.hitQueue.push({ reactionTime, value });
        }
    }

    queueMiss(value) {
        if (this.isActive) {
            console.log(`[StubTarget ${this.id}] Firing miss immediately: ${value}`);
            this.emit('expired', value);
        } else {
            this.missQueue.push({ value });
        }
    }

    display(loopCount, visualScript) {
        const script = typeof visualScript === 'string' ? visualScript : visualScript.build();
        this.eventLog.push(`display(${loopCount}, ${script})`);
    }

    off() {
        this.eventLog.push('off()');
    }

    ping() {
        this.eventLog.push('ping()');
        this.emit('pong');
    }
}

module.exports = StubTarget;
