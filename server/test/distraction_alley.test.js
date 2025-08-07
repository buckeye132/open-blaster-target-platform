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

const DistractionAlley = require('../games/distraction_alley');
const StubTarget = require('./stub_target');

jest.useFakeTimers();

describe('Distraction Alley Game Mode', () => {
    let clients, target1, target2, targets, game;

    beforeEach(() => {
        clients = new Set();
        target1 = new StubTarget('stub1');
        target2 = new StubTarget('stub2');
        targets = [target1, target2];
        const options = { gameLength: 30 };
        game = new DistractionAlley(clients, targets, options);

        targets.forEach(target => {
            target.on('hit', (hitData) => game.onHit(target, hitData));
            target.on('expired', (expiredData) => game.onExpired(target, expiredData));
        });
    });

    it('should start the game and spawn all targets', () => {
        game.start();
        targets.forEach(target => {
            expect(target.getEventLog().some(cmd => cmd.startsWith('activate'))).toBe(true);
        });
    });

    it('should end the game when the timer runs out', async () => {
        const stopSpy = jest.spyOn(game, 'stop');
        game.start();
        await jest.advanceTimersByTimeAsync(30000);
        expect(stopSpy).toHaveBeenCalled();
    });

    it('should increase score on a positive hit', async () => {
        game.goodTargetChance = 1; // Force a good target
        game.start();
        game.score = 0;

        const activeTarget = targets[0];
        activeTarget.queueHit(100, 'positive');
        await jest.advanceTimersByTimeAsync(100);

        expect(game.score).toBe(1);
    });

    it('should decrease score on a negative hit', async () => {
        game.goodTargetChance = 0; // Force a bad target
        game.start();
        game.score = 0;

        const activeTarget = targets[0];
        activeTarget.queueHit(100, 'negative');
        await jest.advanceTimersByTimeAsync(100);

        expect(game.score).toBe(-1);
    });

    it('should respawn a target after it is hit', async () => {
        game.start();
        const spawnTargetSpy = jest.spyOn(game, 'spawnTarget');

        const activeTarget = targets[0];
        activeTarget.queueHit(100, 'positive');
        await jest.advanceTimersByTimeAsync(100);

        await jest.advanceTimersByTimeAsync(1500); // Max respawn delay

        expect(spawnTargetSpy).toHaveBeenCalledWith(activeTarget);
    });

    it('should respawn a target after it expires', async () => {
        game.start();
        const spawnTargetSpy = jest.spyOn(game, 'spawnTarget');

        const activeTarget = targets[0];
        activeTarget.queueMiss('any');
        await jest.advanceTimersByTimeAsync(2000); // Max activation time

        await jest.advanceTimersByTimeAsync(1000); // Max respawn delay

        expect(spawnTargetSpy).toHaveBeenCalledWith(activeTarget);
    });
});
