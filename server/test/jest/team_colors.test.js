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

const TeamColors = require('../../games/team_colors');
const StubTarget = require('./stub_target');

jest.useFakeTimers();

describe('Team Colors Game Mode', () => {
    let clients, target1, target2, targets, game;

    beforeEach(() => {
        clients = new Set();
        target1 = new StubTarget('stub1');
        target2 = new StubTarget('stub2');
        targets = [target1, target2];
        const options = { gameLength: 30 };
        game = new TeamColors(clients, targets, options);

        targets.forEach(target => {
            target.on('hit', (hitData) => game.onHit(target, hitData));
            target.on('expired', (expiredData) => game.onExpired(target, expiredData));
        });
    });

    it('should start the game and schedule actions for targets', () => {
        const scheduleSpy = jest.spyOn(game, 'scheduleNextTargetAction');
        game.start();
        expect(scheduleSpy).toHaveBeenCalledTimes(targets.length);
    });

    it('should add points to the correct team on a hit', async () => {
        game.start();
        game.scores = { green: 0, blue: 0 };

        const activeTarget = [...game.activeTargets.keys()][0];
        if (activeTarget) {
            const { value } = game.activeTargets.get(activeTarget);

            activeTarget.queueHit(500, value);
            await jest.advanceTimersByTimeAsync(500);

            if (value === 'green_team') {
                expect(game.scores.green).toBeGreaterThan(0);
                expect(game.scores.blue).toBe(0);
            } else {
                expect(game.scores.blue).toBeGreaterThan(0);
                expect(game.scores.green).toBe(0);
            }
        }
    });

    it('should start the hit flurry when the timer runs out', async () => {
        const hitFlurrySpy = jest.spyOn(game, 'startHitFlurry');
        game.start();
        await jest.advanceTimersByTimeAsync(30000);
        expect(hitFlurrySpy).toHaveBeenCalled();
    });

    it('should add bonus points during hit flurry', async () => {
        game.startHitFlurry();
        game.scores = { green: 0, blue: 0 };

        const greenTarget = [...game.activeTargets.keys()].find(t => game.activeTargets.get(t).value === 'green');

        greenTarget.queueHit(100, 'green');
        await jest.advanceTimersByTimeAsync(100);

        expect(game.scores.green).toBe(3000);
    });

    it('should end the game with an animation after hit flurry', async () => {
        const endGameSpy = jest.spyOn(game, 'endGameWithAnimation');
        game.startHitFlurry();
        game.scores = { green: 100, blue: 0 };

        const greenTarget = [...game.activeTargets.keys()].find(t => game.activeTargets.get(t).value === 'green');
        greenTarget.queueHit(100, 'green');
        await jest.advanceTimersByTimeAsync(100);

        expect(endGameSpy).toHaveBeenCalled();
    });

    it('should require at least 2 targets to start', () => {
        const gameOverCallback = jest.fn();
        game.targets = [target1];
        game.on('gameOver', gameOverCallback);
        game.start();
        expect(gameOverCallback).toHaveBeenCalled();
    });
});
