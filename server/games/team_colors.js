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

const HITS_TO_FLURRY = 5;
const BONUS_POINTS = 3000;

class TeamColors extends Game {
    constructor(clients, targets, options) {
        super(clients, targets);
        this.scores = { green: 0, blue: 0 };
        this.gameLength = (options.gameLength || 30);
        this.timeLeft = this.gameLength;
        this.gameInterval = null;
        this.activeTargets = new Map(); // To track currently active targets and their values
        this.targetTimers = new Map(); // To store timeouts for each target's next action
        this.hitFlurryActive = false;
    }

    async start() {
        console.log("LOG: Starting Team Colors");
        this.broadcast('gameStart', { message: 'Green vs Blue!', timeLeft: this.timeLeft });

        if (this.targets.length < 2) {
            this.broadcast('gameOver', { message: 'Team Colors requires at least 2 targets connected!' });
            this.emit('gameOver');
            return;
        }

        // Configure hits for main game
        this.targets.forEach(target => {
            target.configureHit('green_hit', 1, 'NONE', new VisualScriptBuilder().animation(500, Animations.THEATER_CHASE, 0, 255, 0));
            target.configureHit('blue_hit', 1, 'NONE', new VisualScriptBuilder().animation(500, Animations.THEATER_CHASE, 0, 0, 255));
        });

        this.gameInterval = setInterval(() => this.tick(), 1000);

        // Initialize each target's cycle
        this.targets.forEach(target => this.scheduleNextTargetAction(target));
    }

    stop() {
        console.log("LOG: Stopping Team Colors");
        clearInterval(this.gameInterval);

        // Clear all individual target timers
        this.targetTimers.forEach((timerId) => clearTimeout(timerId));
        this.targetTimers.clear();

        // Turn off all targets at game end
        this.targets.forEach(target => target.off());
        this.activeTargets.clear();

        this.broadcast('gameOver', { message: `Time's up! Final Score: Green: ${this.scores.green}, Blue: ${this.scores.blue}` });
        this.emit('gameOver');
    }

    tick() {
        this.timeLeft--;
        this.broadcast('updateTimer', { timeLeft: this.timeLeft });

        if (this.timeLeft <= 0) {
            clearInterval(this.gameInterval);
            this.startHitFlurry();
        }
    }

    startHitFlurry() {
        console.log("LOG: Starting Hit Flurry!");
        this.hitFlurryActive = true;

        // Clear all current target activities
        this.targetTimers.forEach((timerId) => clearTimeout(timerId));
        this.targetTimers.clear();
        this.targets.forEach(target => target.off());
        this.activeTargets.clear();

        this.broadcast('hitFlurryStart', { message: 'Hit Flurry! Clear your target!' });

        const availableTargets = [...this.targets];
        // Shuffle targets to ensure random selection
        for (let i = availableTargets.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableTargets[i], availableTargets[j]] = [availableTargets[j], availableTargets[i]];
        }
        const greenTarget = availableTargets[0];
        const blueTarget = availableTargets[1];

        // Configure and activate green target
        let hitConfigId = 'green_flurry_hit';
        greenTarget.configureHit(hitConfigId, HITS_TO_FLURRY, 'DECREMENTAL', new VisualScriptBuilder().solid(0, 0, 0, 0));
        greenTarget.configureInterimHit(hitConfigId, new VisualScriptBuilder().solid(150, 255, 255, 255));
        greenTarget.activate(30000, 'green', hitConfigId, new VisualScriptBuilder().animation(30000, Animations.PULSE, 0, 255, 0));
        this.activeTargets.set(greenTarget, { value: 'green', activationTime: Date.now() });

        // Configure and activate blue target
        hitConfigId = 'blue_flurry_hit';
        blueTarget.configureHit(hitConfigId, HITS_TO_FLURRY, 'DECREMENTAL', new VisualScriptBuilder().solid(0, 0, 0, 0));
        blueTarget.configureInterimHit(hitConfigId, new VisualScriptBuilder().solid(150, 255, 255, 255));
        blueTarget.activate(30000, 'blue', hitConfigId, new VisualScriptBuilder().animation(30000, Animations.PULSE, 0, 0, 255));
        this.activeTargets.set(blueTarget, { value: 'blue', activationTime: Date.now() });
    }

    endGameWithAnimation() {
        console.log("LOG: Ending game with animation.");
        this.targets.forEach(target => target.off());
        clearInterval(this.gameInterval);
        this.targetTimers.forEach((timerId) => clearTimeout(timerId));
        this.targetTimers.clear();

        let winningColorRGB = '0 0 0';
        if (this.scores.green > this.scores.blue) {
            winningColorRGB = '0 255 0'; // green wins
        } else {
            winningColorRGB = '0 0 255'; // blue wins
        }

        this.targets.forEach(target => {
            target.display(1, new VisualScriptBuilder().animation(3000, Animations.SPARKLE, ...winningColorRGB.split(' ').map(Number)));
        });

        setTimeout(() => {
            this.stop(); // Call the original stop after animation
        }, 3000);
    }

    scheduleNextTargetAction(target) {
        if (this.hitFlurryActive) return; // Don't schedule new actions during flurry

        // Clear any existing timeout for this target
        if (this.targetTimers.has(target)) {
            clearTimeout(this.targetTimers.get(target));
            this.targetTimers.delete(target);
        }

        const actionType = Math.random();
        const duration = Math.random() * 1500 + 500; // 0.5 to 2 seconds

        if (actionType < 0.3) { // Green target
            const value = 'green_team';
            const hitConfigId = 'green_hit';
            const visualScript = new VisualScriptBuilder().solid(duration, 0, 255, 0);
            target.activate(duration, value, hitConfigId, visualScript);
            this.activeTargets.set(target, { value, activationTime: Date.now() });
        } else if (actionType < 0.6) { // Blue target
            const value = 'blue_team';
            const hitConfigId = 'blue_hit';
            const visualScript = new VisualScriptBuilder().solid(duration, 0, 0, 255);
            target.activate(duration, value, hitConfigId, visualScript);
            this.activeTargets.set(target, { value, activationTime: Date.now() });
        } else { // Nothing (delay)
            target.off();
            const timerId = setTimeout(() => {
                this.scheduleNextTargetAction(target); // Schedule next action after delay
            }, duration);
            this.targetTimers.set(target, timerId);
            this.activeTargets.delete(target); // Not active during delay
        }
    }

    handleHit(target, { reactionTime, value }) {
        if (!this.activeTargets.has(target)) return; // Ignore hits on inactive targets

        if (this.hitFlurryActive) {
            console.log("hit flurry finished");
            // Target cleared in hit flurry
            if (value === 'green') {
                this.scores.green += BONUS_POINTS;
            } else if (value === 'blue') {
                this.scores.blue += BONUS_POINTS;
            }
            this.broadcast('updateScore', { scores: this.scores });
            this.endGameWithAnimation(); // End game with animation for the team that cleared it
        } else {
            // Normal game hit logic
            const points = Math.max(100, 1500 - reactionTime);

            if (value === 'green_team') {
                this.scores.green += points;
            } else if (value === 'blue_team') {
                this.scores.blue += points;
            }

            this.broadcast('updateScore', { scores: this.scores });
            this.activeTargets.delete(target);

            const timerId = setTimeout(() => {
                this.scheduleNextTargetAction(target); // Schedule next action after delay for hit animation
            }, 500);
            this.targetTimers.set(target, timerId);
        }
    }

    handleExpired(target, value) {
        if (!this.activeTargets.has(target)) return; // Ignore expirations of targets not managed by activeTargets

        if (this.hitFlurryActive) {
            console.log("hit flurry expired");
            this.endGameWithAnimation();
        } else {
            // Normal game expired logic
            this.activeTargets.delete(target);
            this.scheduleNextTargetAction(target);
        }
    }
}

module.exports = TeamColors;