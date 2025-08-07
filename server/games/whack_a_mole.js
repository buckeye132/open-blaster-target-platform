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

const Game = require('./base');
const { VisualScriptBuilder, Animations } = require('../target');

class WhackAMole extends Game {
    constructor(clients, targets, options) {
        super(clients, targets);
        this.score = 0;
        this.gameLength = options.gameLength || 30000; // Default to 30 seconds
        this.targetTimeout = options.targetTimeout || 2000; // Default to 2 seconds
        this.activeTarget = null;
        this.gameTimeout = null;
    }

    start() {
        console.log("LOG: Starting Whack-a-Mole");
        this.broadcast('gameStart', { message: 'Whack-a-Mole!' });

        if (this.targets.length === 0) {
            this.broadcast('gameOver', { message: 'No targets connected!' });
            this.emit('gameOver');
            return;
        }

        this.targets.forEach(target => {
            // Use the WIPE animation for a satisfying hit effect.
            let animationTime = Math.min(500, this.targetTimeout);
            target.configureHit('standard', 1, 'NONE', new VisualScriptBuilder().animation(animationTime, Animations.THEATER_CHASE, 255, 165, 0));
        });

        this.pickAndActivateTarget();

        this.gameTimeout = setTimeout(() => {
            this.stop();
        }, this.gameLength);
    }

    stop() {
        console.log("LOG: Stopping Whack-a-Mole");
        if (this.gameTimeout) {
            clearTimeout(this.gameTimeout);
        }
        if (this.activeTarget) {
            this.activeTarget.off();
        }
        this.broadcast('gameOver', { finalScore: this.score });
        this.emit('gameOver', this.score);
    }

    pickAndActivateTarget() {
        let availableTargets = this.targets.filter(t => t !== this.activeTarget);
        if (availableTargets.length === 0) {
            availableTargets = this.targets;
        }

        this.activeTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
        this.activeTarget.activate(this.targetTimeout, 'positive', 'standard', new VisualScriptBuilder().solid(this.targetTimeout, 0, 255, 0));
    }

    handleHit(target, { value }) {
        console.log(`[WhackAMole] handleHit: target=${target.id}, value=${value}`);
        if (target === this.activeTarget) {
            this.score++;
            this.broadcast('updateScore', { score: this.score });
            this.pickAndActivateTarget();
        }
    }

    handleExpired(target, value) {
        console.log(`[WhackAMole] handleExpired: target=${target.id}, value=${value}`);
        if (target === this.activeTarget) {
            this.pickAndActivateTarget();
        }
    }
}

module.exports = WhackAMole;
