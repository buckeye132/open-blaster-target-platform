/*
 * Copyright 2025 https://github.com/buckeye132
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You maye obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const WhackAMole = require('../games/whack_a_mole');
const StubTarget = require('./stub_target');

jest.useFakeTimers();

describe('Whack-A-Mole Game Mode', () => {
    let clients, target1, target2, targets, game;

    beforeEach(() => {
        clients = new Set();
        target1 = new StubTarget('stub1');
        target2 = new StubTarget('stub2');
        targets = [target1, target2];
        const options = { gameLength: 10000, targetTimeout: 1000 };
        game = new WhackAMole(clients, targets, options);

        targets.forEach(target => {
            target.on('hit', (hitData) => game.onHit(target, hitData));
            target.on('expired', (expiredData) => game.onExpired(target, expiredData));
        });
    });

    it('should start and end the game after the specified game length', async () => {
        const gameOverCallback = jest.fn();
        game.on('gameOver', gameOverCallback);

        game.start();

        await jest.advanceTimersByTimeAsync(10000);

        expect(gameOverCallback).toHaveBeenCalled();
    });

    it('should increase the score when a target is hit', async () => {
        target1.queueHit(100, 'positive');
        target2.queueHit(100, 'positive');
        game.start();

        await jest.advanceTimersByTimeAsync(100);

        expect(game.score).toBe(1);
    });

    it('should activate a new target after a hit', async () => {
        game.start();
        const firstTarget = game.activeTarget;
        firstTarget.queueHit(100, 'positive');
        await jest.advanceTimersByTimeAsync(100);

        const secondTarget = game.activeTarget;

        expect(firstTarget).not.toBe(secondTarget);
    });

    it('should activate a new target when the active target expires', async () => {
        game.start();
        const firstTarget = game.activeTarget;
        firstTarget.queueMiss('positive');

        await jest.advanceTimersByTimeAsync(1000);

        const secondTarget = game.activeTarget;
        expect(firstTarget).not.toBe(secondTarget);
        expect(game.score).toBe(0);
    });

    it('should handle having no targets gracefully', () => {
        const gameOverCallback = jest.fn();
        game.targets = [];
        game.on('gameOver', gameOverCallback);
        game.start();
        expect(gameOverCallback).toHaveBeenCalled();
    });
});
