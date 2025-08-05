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

const DISTRACTION_ANIMATIONS = [
    'PULSE',
    'THEATER_CHASE',
    'RAINBOW_CYCLE',
    'COMET',
    'WIPE',
    'CYLON',
    'SPARKLE',
    'FIRE',
    'CONVERGE'
];

class DistractionAlley extends Game {
    constructor(clients, targets, options) {
        super(clients, targets);
        this.score = 0;
        this.gameLength = (options.gameLength || 30);
        this.timeLeft = this.gameLength;
        this.gameInterval = null;
        this.goodTargetChance = 0.2; // 20% chance for a good target
    }

    async start() {
        console.log("LOG: Starting Distraction Alley");
        this.broadcast('gameStart', { message: 'Hit the green targets, avoid the others!' });

        if (this.targets.length === 0) {
            this.broadcast('gameOver', { message: 'No targets connected!' });
            this.emit('gameOver');
            return;
        }

        // Configure hits
        this.targets.forEach(target => {
            target.configureHit('game_hit', 1, 'NONE', '0 SOLID 0 0 0');
        });

        // Initial spawn for all targets
        this.targets.forEach(target => this.spawnTarget(target));

        // Set a timeout to end the game
        this.gameInterval = setInterval(() => this.tick(), 1000);
    }

    tick() {
        this.timeLeft--;
        this.broadcast('updateTimer', { timeLeft: this.timeLeft });

        if (this.timeLeft <= 0) {
            this.broadcast('gameOver', { message: `Time's up! Final Score: ${this.score}` });
            this.stop();
        }
    }

    stop() {
        console.log("LOG: Stopping Distraction Alley");
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
        }
        this.targets.forEach(target => target.off());
        this.emit('gameOver');
    }

    spawnTarget(target) {
        const isGood = Math.random() < this.goodTargetChance;
        const timeout = Math.random() * 1500 + 500; // .5 - 2 second activation time

        if (isGood) {
            target.activate(timeout, 'positive', 'game_hit', '0 SOLID 0 255 0');
        } else {
            const anim = DISTRACTION_ANIMATIONS[Math.floor(Math.random() * DISTRACTION_ANIMATIONS.length)];
            const r = Math.floor(Math.random() * 256);
            const g = Math.floor(Math.random() * 256);
            const b = Math.floor(Math.random() * 256);
            target.activate(timeout, 'negative', 'game_hit', `0 ANIM ${anim} ${r} ${g} ${b}`);
        }
    }

    handleHit(target, { value }) {
        if (value === 'positive') {
            this.score++;
            target.display(1, '250 SOLID 0 255 0'); // Flash green for good hit
        } else if (value === 'negative') {
            this.score--;
            target.display(1, '250 SOLID 255 0 0'); // Flash red for bad hit
        }
        this.broadcast('updateScore', { score: this.score });

        // Respawn the target after a random delay
        const respawnDelay = Math.random() * 1000 + 500; // 0.5-1.5 second delay
        setTimeout(() => this.spawnTarget(target), respawnDelay);
    }

    handleExpired(target, value) {
        // When a target expires, just spawn a new one on the same target
        const respawnDelay = Math.random() * 1000; // 0-1 second delay
        setTimeout(() => this.spawnTarget(target), respawnDelay);
    }
}

module.exports = DistractionAlley;
