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

const QuickDraw = require('../games/quick_draw');
const StubTarget = require('./stub_target');

jest.useFakeTimers();

describe('Quick Draw Game Mode', () => {
    let clients, target1, target2, targets, game;

    beforeEach(() => {
        clients = new Set();
        target1 = new StubTarget('stub1');
        target2 = new StubTarget('stub2');
        targets = [target1, target2];
        game = new QuickDraw(clients, targets);

        targets.forEach(target => {
            target.on('hit', (hitData) => game.onHit(target, hitData));
            target.on('expired', (expiredData) => game.onExpired(target, expiredData));
        });
    });

    it('should activate a random target after a delay', async () => {
        game.start();
        expect(game.activeTarget).toBeNull();

        await jest.advanceTimersByTimeAsync(5000); // Max delay is 5000ms

        expect(game.activeTarget).not.toBeNull();
        const activeTarget = game.activeTarget;
        expect(activeTarget.getEventLog()).toContain(`activate(10000, ${activeTarget.id}, quick_draw_hit, 1000 ANIM PULSE 255 0 0)`);
    });

    it('should end the game when a target is hit', async () => {
        const gameOverCallback = jest.fn();
        game.on('gameOver', gameOverCallback);

        target1.queueHit(150, 'stub1');
        target2.queueHit(150, 'stub2');

        game.start();
        await jest.advanceTimersByTimeAsync(5000);
        await jest.advanceTimersByTimeAsync(150);

        expect(gameOverCallback).toHaveBeenCalledWith('150 ms');
    });

    it('should end the game if the target expires', async () => {
        const gameOverCallback = jest.fn();
        game.on('gameOver', gameOverCallback);

        game.start();
        await jest.advanceTimersByTimeAsync(5000); // Initial delay

        const activeTarget = game.activeTarget;
        activeTarget.queueMiss(activeTarget.id);
        await jest.advanceTimersByTimeAsync(10000); // Target timeout

        expect(gameOverCallback).toHaveBeenCalledWith('Missed');
    });

    it('should ignore hits on the wrong target', async () => {
        const gameOverCallback = jest.fn();
        game.on('gameOver', gameOverCallback);

        game.start();
        await jest.advanceTimersByTimeAsync(5000);

        const activeTarget = game.activeTarget;
        const wrongTarget = targets.find(t => t !== activeTarget);
        wrongTarget.queueHit(100, wrongTarget.id);
        await jest.advanceTimersByTimeAsync(100);

        expect(gameOverCallback).not.toHaveBeenCalled();
    });

    it('should handle having no targets gracefully', () => {
        const gameOverCallback = jest.fn();
        game.targets = [];
        game.on('gameOver', gameOverCallback);
        game.start();
        expect(gameOverCallback).toHaveBeenCalled();
    });
});
