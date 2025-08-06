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

class QuickDraw extends Game {
    constructor(clients, targets, options) {
        super(clients, targets);
        this.activeTarget = null;
        this.gameTimeout = null;
    }

    start() {
        console.log("LOG: Starting Quick Draw");
        this.broadcast('gameStart', { message: 'Get ready...' });

        if (this.targets.length === 0) {
            this.broadcast('gameOver', { message: 'No targets connected!' });
            this.emit('gameOver');
            return;
        }

        // Configure all targets for the game
        this.targets.forEach(target => {
            // Use the celebratory RAINBOW_CYCLE animation for the winning hit.
            target.configureHit('quick_draw_hit', 1, 'NONE', new VisualScriptBuilder().animation(1500, Animations.RAINBOW_CYCLE, 0, 0, 0));
        });

        const delay = Math.random() * 3000 + 2000; // 2-5 second delay
        this.gameTimeout = setTimeout(() => {
            this.activeTarget = this.targets[Math.floor(Math.random() * this.targets.length)];
            this.broadcast('gameUpdate', { message: 'GO!' });
            this.activeTarget.activate(10000, this.activeTarget.id, 'quick_draw_hit', new VisualScriptBuilder().animation(1000, Animations.PULSE, 255, 0, 0));
        }, delay);
    }

    stop(score = 'N/A') {
        console.log("LOG: Stopping Quick Draw");
        if (this.gameTimeout) {
            clearTimeout(this.gameTimeout);
        }
        // Do not send OFF command, to allow the hit animation to complete.
        this.emit('gameOver', score); // Signal to the server that the game is done
    }

    onHit(target, { reactionTime, value }) {
        if (target !== this.activeTarget) return; // Wrong target hit

        const score = `${reactionTime} ms`;
        this.broadcast('gameOver', {
            winner: target.id,
            score: score
        });
        this.stop(score);
    }

    onExpired(target, value) {
        if (target !== this.activeTarget) return;

        this.broadcast('gameOver', { message: 'Missed! You were too slow.' });
        this.stop('Missed');
    }
}

module.exports = QuickDraw;
