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

const ANIMATIONS = [
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

class Demo extends Game {
    constructor(clients, targets) {
        super(clients, targets);
        this.state = 'idle';
        this.activeTarget = null;
        this.gameTimeout = null;
    }

    async start() {
        console.log("LOG: Starting Demo");
        this.broadcast('gameStart', { message: 'Starting Demo Mode...' });

        if (this.targets.length === 0) {
            this.broadcast('gameOver', { message: 'No targets connected!' });
            this.emit('gameOver');
            return;
        }

        await this.runAnimationSequence();
        await this.runSingleHitSequence();
        await this.runMultiHitSequence();

        this.broadcast('gameOver', { message: 'Demo complete!' });
        this.emit('gameOver');
    }

    async runAnimationSequence() {
        this.broadcast('gameUpdate', { message: 'Cycling animations...' });
        const numTargets = this.targets.length;
        for (let i = 0; i < ANIMATIONS.length; i += numTargets) {
            const batch = ANIMATIONS.slice(i, i + numTargets);
            const promises = batch.map((animation, index) => {
                const target = this.targets[index];
                if (target) {
                    this.broadcast('gameUpdate', { message: `Animation: ${animation}` });
                    return target.display(1, `1000 ANIM ${animation} 255 255 255`);
                }
            });
            await Promise.all(promises);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    runSingleHitSequence() {
        return new Promise(resolve => {
            this.broadcast('gameUpdate', { message: 'Hit the target!' });
            this.state = 'single_hit';
            this.activeTarget = this.targets[Math.floor(Math.random() * this.targets.length)];
            this.activeTarget.configureHit('demo_hit', 1, 'NONE', '1000 ANIM THEATER_CHASE 0 0 0');
            this.activeTarget.activate(10000, 'single_hit', 'demo_hit', '1000 ANIM PULSE 255 0 0');
            this.gameTimeout = setTimeout(() => {
                this.activeTarget.off();
                resolve();
            }, 10000);
            this.once('single_hit_done', resolve);
        });
    }

    runMultiHitSequence() {
        return new Promise(resolve => {
            this.broadcast('gameUpdate', { message: 'Hit the target 5 times!' });
            this.state = 'multi_hit';
            this.activeTarget = this.targets[Math.floor(Math.random() * this.targets.length)];
            this.activeTarget = this.targets[Math.floor(Math.random() * this.targets.length)];
            this.activeTarget.configureHit('demo_multi_hit', 5, 'DECREMENTAL', '1500 ANIM THEATER_CHASE 0 0 0');
            this.activeTarget.configureInterimHit('demo_multi_hit', '150 SOLID 255 255 255');
            this.activeTarget.activate(20000, 'multi_hit', 'demo_multi_hit', '1000 ANIM PULSE 0 0 255');
            this.gameTimeout = setTimeout(() => {
                this.activeTarget.off();
                resolve();
            }, 20000);
            this.once('multi_hit_done', resolve);
        });
    }

    stop() {
        console.log("LOG: Stopping Demo");
        if (this.gameTimeout) {
            clearTimeout(this.gameTimeout);
        }
        this.targets.forEach(target => target.off());
        this.emit('gameOver');
    }

    handleHit(target, { value }) {
        if (target !== this.activeTarget) return;

        if (this.state === 'single_hit' && value === 'single_hit') {
            clearTimeout(this.gameTimeout);
            this.emit('single_hit_done');
        } else if (this.state === 'multi_hit' && value === 'multi_hit') {
            clearTimeout(this.gameTimeout);
            this.emit('multi_hit_done');
        }
    }

    handleExpired(target, value) {
        if (target !== this.activeTarget) return;

        if (this.state === 'single_hit' && value === 'single_hit') {
            this.emit('single_hit_done');
        } else if (this.state === 'multi_hit' && value === 'multi_hit') {
            this.emit('multi_hit_done');
        }
    }
}

module.exports = Demo;