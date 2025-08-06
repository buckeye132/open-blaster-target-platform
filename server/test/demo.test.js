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

const Demo = require('../games/demo');
const StubTarget = require('./stub_target');
const { Animations } = require('../target');

jest.useFakeTimers();

describe('Demo Game Mode', () => {
    let clients, target1, target2, targets, demoGame;

    beforeEach(() => {
        // 1. Setup
        clients = new Set(); // Mock clients
        target1 = new StubTarget('stub1');
        target2 = new StubTarget('stub2');
        targets = [target1, target2];

        demoGame = new Demo(clients, targets);

        // Wire up the event listeners between the game and the stub targets
        targets.forEach(target => {
            target.on('hit', (hitData) => {
                demoGame.onHit(target, hitData);
            });
            target.on('expired', (expiredData) => {
                demoGame.onExpired(target, expiredData);
            });
        });

        // Pre-program the stubs to resolve the game sequences
        target1.queueHit(100, 'single_hit');
        target2.queueHit(100, 'single_hit');
        target1.queueHit(100, 'multi_hit');
        target2.queueHit(100, 'multi_hit');
    });

    it('should run the full demo sequence and generate expected events', async () => {
        // 2. Execute
        const startPromise = demoGame.start();

        // Manually advance timers to resolve promises
        await jest.advanceTimersByTimeAsync(1000);
        await jest.advanceTimersByTimeAsync(10000);
        await jest.advanceTimersByTimeAsync(20000);

        await startPromise;

        // 3. Verify
        const log1 = target1.getEventLog();
        const log2 = target2.getEventLog();
        const combinedLog = [...log1, ...log2];

        // Check that some events were logged
        expect(combinedLog.length).toBeGreaterThan(0);

        // Check that the animation sequence was displayed
        const expectedAnimationCount = Object.keys(Animations).length;
        const displayCommands = combinedLog.filter(cmd => cmd.startsWith('display'));
        expect(displayCommands.length).toBe(expectedAnimationCount);

        // Check that the single hit sequence was configured and activated
        const singleHitConfig = combinedLog.some(cmd => cmd.includes('configureHit(demo_hit'));
        const singleHitActivate = combinedLog.some(cmd => cmd.includes('activate(10000, single_hit, demo_hit'));
        expect(singleHitConfig).toBe(true);
        expect(singleHitActivate).toBe(true);

        // Check that the multi-hit sequence was configured and activated
        const multiHitConfig = combinedLog.some(cmd => cmd.includes('configureHit(demo_multi_hit'));
        const multiHitActivate = combinedLog.some(cmd => cmd.includes('activate(20000, multi_hit, demo_multi_hit'));
        expect(multiHitConfig).toBe(true);
        expect(multiHitActivate).toBe(true);
    });
});

