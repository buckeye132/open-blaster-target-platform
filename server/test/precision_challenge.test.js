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

const PrecisionChallenge = require('../games/precision_challenge');
const StubTarget = require('./stub_target');

jest.useFakeTimers();

describe('Precision Challenge Game Mode', () => {
    let clients, target1, target2, targets, game;

    beforeEach(() => {
        clients = new Set();
        target1 = new StubTarget('stub1');
        target2 = new StubTarget('stub2');
        targets = [target1, target2];
        const options = { gameLength: 30 };
        game = new PrecisionChallenge(clients, targets, options);

        targets.forEach(target => {
            target.on('hit', (hitData) => game.onHit(target, hitData));
            target.on('expired', (expiredData) => game.onExpired(target, expiredData));
        });
    });

    it('should start the game and activate a target', () => {
        game.start();
        expect(game.activeTargets.size).toBe(1);
    });

    it('should decrease time and end the game when time is up', async () => {
        const stopSpy = jest.spyOn(game, 'stop');
        game.start();
        await jest.advanceTimersByTimeAsync(30000);
        expect(stopSpy).toHaveBeenCalled();
    });

    it('should handle a positive hit correctly', async () => {
        target1.queueHit(500, 'positive');
        target2.queueHit(500, 'positive');
        game.start();
        const initialScore = game.score;

        await jest.advanceTimersByTimeAsync(500);
        expect(game.score).toBeGreaterThan(initialScore);
    });

    it('should handle a negative hit correctly', async () => {
        target1.queueHit(500, 'negative');
        target2.queueHit(500, 'negative');
        game.start();
        const initialScore = game.score;

        await jest.advanceTimersByTimeAsync(500);
        expect(game.score).toBeLessThan(initialScore);
    });

    it('should trigger a hit flurry after 5 consecutive fast hits', async () => {
        for (let i = 0; i < 5; i++) {
            target1.queueHit(100, 'positive');
            target2.queueHit(100, 'positive');
        }
        game.start();
        const triggerHitFlurrySpy = jest.spyOn(game, 'triggerHitFlurry');

        for (let i = 0; i < 5; i++) {
            await jest.advanceTimersByTimeAsync(100);
        }
        expect(triggerHitFlurrySpy).toHaveBeenCalled();
    });

    it('should handle hits during a hit flurry', async () => {
        game.start();
        game.triggerHitFlurry();
        const initialScore = game.score;

        const activeTargets = [...game.activeTargets.keys()];
        activeTargets[0].queueHit(100, 'flurry_hit');
        activeTargets[1].queueHit(100, 'flurry_hit');

        await jest.advanceTimersByTimeAsync(100);
        expect(game.score).toBe(initialScore + 6000);
    });

    it('should end the hit flurry after the specified time', async () => {
        game.start();
        game.triggerHitFlurry();
        const endHitFlurrySpy = jest.spyOn(game, 'endHitFlurry');

        const totalFlurryTime = 2500 * game.targets.length;
        await jest.advanceTimersByTimeAsync(totalFlurryTime);

        expect(endHitFlurrySpy).toHaveBeenCalled();
        expect(game.hitFlurryActive).toBe(false);
    });

    it('should handle target expiration correctly', async () => {
        game.start();
        const activeTarget = [...game.activeTargets.keys()][0];
        game.activeTargets.set(activeTarget, { value: 'positive' });
        const initialTimeout = game.targetTimeout;

        activeTarget.queueMiss('positive');
        await jest.advanceTimersByTimeAsync(game.targetTimeout);
        expect(game.targetTimeout).toBeGreaterThan(initialTimeout);
    });
});
