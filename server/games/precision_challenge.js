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

class PrecisionChallenge extends Game {
    constructor(clients, targets, options) {
        super(clients, targets);
        this.score = 0;
        this.timeLeft = options.gameLength || 30;
        this.targetTimeout = 3000;
        this.consecutiveFastHits = 0;
        this.hitFlurryActive = false;
        this.gameInterval = null;
        this.activeTargets = new Map();
    }

    start() {
        console.log("LOG: Starting Precision Challenge");
        this.broadcast('gameStart', { timeLeft: this.timeLeft });

        this.targets.forEach(target => {
            target.configureHit('positive', 1, 'NONE', '500 SOLID 0 255 0');
            target.configureHit('negative', 1, 'NONE', '500 SOLID 255 0 0');
            target.configureHit('flurry_hit', 3, 'DECREMENTAL', '1000 ANIM THEATER_CHASE 0 0 255');
            target.configureInterimHit('flurry_hit', '150 SOLID 255 255 255');
        });

        this.gameInterval = setInterval(() => this.tick(), 1000);
        this.activateRandomTarget();
    }

    stop() {
        console.log("LOG: Stopping Precision Challenge");
        clearInterval(this.gameInterval);
        this.activeTargets.forEach((_state, target) => {
            target.off();
        });
        this.activeTargets.clear();
        this.broadcast('gameOver', { finalScore: this.score });
        this.emit('gameOver', this.score);
    }

    tick() {
        if (this.hitFlurryActive) return;

        this.timeLeft--;
        this.broadcast('updateTimer', { timeLeft: this.timeLeft });
        this.emit('timeUpdate', this.timeLeft);

        if (this.timeLeft <= 0) {
            this.stop();
        }
    }

    activateRandomTarget() {
        if (this.hitFlurryActive || this.targets.length === 0) return;

        if (this.activeTargets.size > 0) {
            const [target] = this.activeTargets.keys();
            target.off();
            this.activeTargets.delete(target);
        }

        const target = this.targets[Math.floor(Math.random() * this.targets.length)];
        const isNegative = Math.random() < 0.2;
        const value = isNegative ? 'negative' : 'positive';
        const hitConfigId = isNegative ? 'negative' : 'positive';
        const visualScript = isNegative ? '1000 SOLID 255 0 0' : '1000 SOLID 0 255 0';

        target.activate(this.targetTimeout, value, hitConfigId, visualScript);
        this.activeTargets.set(target, { value, activationTime: Date.now() });
    }

    handleHit(target, { reactionTime, value }) {
        if (!this.activeTargets.has(target)) return;

        if (this.hitFlurryActive) {
            this.score += 1000;
            this.activeTargets.delete(target);
            if (this.activeTargets.size === 0) {
                this.endHitFlurry();
            }
        } else {
            if (value === 'positive') {
                const points = Math.max(100, 1500 - reactionTime);
                this.score += points;
                this.targetTimeout = Math.max(500, this.targetTimeout - (reactionTime < 800 ? 150 : -200));
                this.consecutiveFastHits = reactionTime < 800 ? this.consecutiveFastHits + 1 : 0;
                console.log(`Consecutive fast: ${this.consecutiveFastHits}`);
            } else if (value === 'negative') {
                this.score -= 500;
                this.targetTimeout += 500;
                this.consecutiveFastHits = 0;
            }

            if (this.consecutiveFastHits >= 4) {
                this.triggerHitFlurry();
            } else {
                this.activateRandomTarget();
            }
        }
        this.broadcast('updateScore', { score: this.score });
    }

    handleExpired(target, value) {
        if (!this.activeTargets.has(target)) return;

        if (this.hitFlurryActive) return;

        if (value === 'positive') {
            this.targetTimeout += 1000;
            this.consecutiveFastHits = 0;
        } else if (value === 'negative') {
            this.score += 100;
        }

        this.broadcast('updateScore', { score: this.score });
        this.activateRandomTarget();
    }

    triggerHitFlurry() {
        console.log("LOG: Triggering Hit Flurry!");
        this.hitFlurryActive = true;
        this.consecutiveFastHits = 0;
        this.broadcast('hitFlurryStart');

        if (this.activeTargets.size > 0) {
            const [target] = this.activeTargets.keys();
            target.off();
            this.activeTargets.delete(target);
        }

        const targetsToArm = this.targets.slice(0, Math.min(this.targets.length, 4));
        targetsToArm.forEach(target => {
            target.activate(15000, 'flurry_hit', 'flurry_hit', '1000 ANIM PULSE 0 0 255');
            this.activeTargets.set(target, { value: 'flurry_hit', activationTime: Date.now() });
        });

        setTimeout(() => this.endHitFlurry(), 15000);
    }

    endHitFlurry() {
        if (!this.hitFlurryActive) return;
        console.log("LOG: Ending Hit Flurry.");
        this.hitFlurryActive = false;

        this.activeTargets.forEach((_state, target) => {
            target.off();
        });
        this.activeTargets.clear();

        this.broadcast('hitFlurryEnd');
        this.activateRandomTarget();
    }
}

module.exports = PrecisionChallenge;
