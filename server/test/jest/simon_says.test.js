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

const SimonSays = require('../../games/simon_says');
const StubTarget = require('./stub_target');

jest.useFakeTimers();

describe('Simon Says Game Mode', () => {
    let clients, target1, target2, targets, game;

    beforeEach(() => {
        clients = new Set();
        target1 = new StubTarget('stub1');
        target2 = new StubTarget('stub2');
        targets = [target1, target2];
        game = new SimonSays(clients, targets);

        targets.forEach(target => {
            target.on('hit', (hitData) => game.onHit(target, hitData));
            target.on('expired', (expiredData) => game.onExpired(target, expiredData));
        });
    });

    it('should start the first round and play the sequence', async () => {
        const playSequenceSpy = jest.spyOn(game, 'playSequence');
        game.start();
        await jest.runAllTimersAsync();
        expect(playSequenceSpy).toHaveBeenCalled();
        expect(game.sequence.length).toBe(1);
    });

    it('should proceed to the next round after a correct sequence', async () => {
        game.start();
        await jest.runAllTimersAsync();
        const correctTarget = game.sequence[0];

        correctTarget.queueHit(100, correctTarget.id);
        await jest.advanceTimersByTimeAsync(100);
        await jest.runAllTimersAsync();

        expect(game.round).toBe(2);
        expect(game.sequence.length).toBe(2);
    });

    it('should end the game after an incorrect sequence', async () => {
        const stopSpy = jest.spyOn(game, 'stop');
        game.start();
        await jest.runAllTimersAsync();

        const correctTarget = game.sequence[0];
        const incorrectTarget = targets.find(t => t !== correctTarget);

        incorrectTarget.queueHit(100, incorrectTarget.id);
        await jest.advanceTimersByTimeAsync(100);
        await jest.runAllTimersAsync();

        expect(stopSpy).toHaveBeenCalled();
    });

    it('should end the game if the player is too slow', async () => {
        const stopSpy = jest.spyOn(game, 'stop');
        game.start();
        await jest.runAllTimersAsync();

        const anyTarget = targets[0];
        anyTarget.queueMiss('simon_says_hit');
        await jest.advanceTimersByTimeAsync(15000);

        expect(stopSpy).toHaveBeenCalled();
    });
});
