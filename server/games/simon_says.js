
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

class SimonSays extends Game {
    constructor(clients, targets) {
        super(clients, targets);
        this.sequence = [];
        this.playerSequence = [];
        this.round = 1;
        this.gameTimeout = null;
    }

    async start() {
        console.log("LOG: Starting Simon Says");
        this.broadcast('gameStart', { message: 'Watch the sequence...' });

        if (this.targets.length === 0) {
            this.broadcast('gameOver', { message: 'No targets connected!' });
            this.emit('gameOver');
            return;
        }

        // Configure all targets for the game
        this.targets.forEach(target => {
            target.configureHit('simon_says_hit', 1, 'NONE', '500 SOLID 0 255 0');
        });

        await this.nextRound();
    }

    stop() {
        console.log("LOG: Stopping Simon Says");
        if (this.gameTimeout) {
            clearTimeout(this.gameTimeout);
        }
        this.targets.forEach(target => target.off());
        this.emit('gameOver'); // Signal to the server that the game is done
    }

    async nextRound() {
        this.playerSequence = [];
        this.broadcast('updateScore', { score: `Round: ${this.round}` });
        this.sequence.push(this.targets[Math.floor(Math.random() * this.targets.length)]);

        // Display Phase
        this.broadcast('gameUpdate', { message: 'Watch carefully...' });
        await this.playSequence();

        // Player Phase
        this.broadcast('gameUpdate', { message: 'Your turn!' });
        this.activateTargets();
    }

    async playSequence() {
        for (const target of this.sequence) {
            // Turn the target on with a solid color for 1 second
            target.display(1, '1000 SOLID 255 0 0');
            await new Promise(resolve => setTimeout(resolve, 1200)); // Wait for display to finish + a small gap
        }
    }

    activateTargets() {
        this.targets.forEach(target => {
            target.activate(15000, target.id, 'simon_says_hit', 'SOLID 100 100 100');
        });
    }

    handleHit(target, value) {
        this.playerSequence.push(target);
        const correctTarget = this.sequence[this.playerSequence.length - 1];

        if (target !== correctTarget) {
            this.broadcast('gameOver', { message: `Wrong hit! You made it to round ${this.round}.` });
            this.stop();
        } else if (this.playerSequence.length === this.sequence.length) {
            // Round complete
            this.round++;
            this.targets.forEach(t => t.off()); // Turn off all targets before next round
            this.gameTimeout = setTimeout(() => this.nextRound(), 1000);
        }
    }

    handleExpired(target, value) {
        this.broadcast('gameOver', { message: `Too slow! You made it to round ${this.round}.` });
        this.stop();
    }
}

module.exports = SimonSays;
