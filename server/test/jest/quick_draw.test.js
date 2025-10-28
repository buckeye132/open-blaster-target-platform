const QuickDraw = require('../../src/games/quick_draw');
const StubTarget = require('../stub_target');

jest.useFakeTimers();

describe('Quick Draw Game Mode', () => {
    let clients, target1, target2, targets, game;

    beforeEach(() => {
        clients = new Set();
        target1 = new StubTarget('stub1');
        target2 = new StubTarget('stub2');
        targets = [target1, target2];
        game = new QuickDraw(clients, targets, {});

        targets.forEach(target => {
            target.on('hit', (hitData) => game.onHit(target, hitData));
            target.on('expired', (expiredData) => game.onExpired(target, expiredData));
        });
    });

    it('should activate a random target after a delay', async () => {
        game.onGameStart();
        expect(game.activeTarget).toBeNull();

        await jest.advanceTimersByTimeAsync(5000); // Max delay is 5000ms

        expect(game.activeTarget).not.toBeNull();
        const activeTarget = game.activeTarget;
        expect(activeTarget.getEventLog()).toContain(`activate(10000, ${activeTarget.id}, quick_draw_hit, 1000 ANIM PULSE 255 0 0)`);
    });

    it('should end the game when a target is hit', async () => {
        const stopSpy = jest.spyOn(game, 'stop');
        
        target1.queueHit(150, 'stub1');
        target2.queueHit(150, 'stub2');

        game.onGameStart();
        
        await jest.advanceTimersByTimeAsync(5000); // initial delay
        await jest.advanceTimersByTimeAsync(150); // reaction time

        expect(stopSpy).toHaveBeenCalled();
        expect(game.winnerInfo).not.toBeNull();
    });

    it('should end the game if the target expires', async () => {
        const stopSpy = jest.spyOn(game, 'stop');

        game.onGameStart();
        await jest.advanceTimersByTimeAsync(5000); // Initial delay

        const activeTarget = game.activeTarget;
        activeTarget.queueMiss(activeTarget.id);
        await jest.advanceTimersByTimeAsync(10000); // Target timeout

        expect(stopSpy).toHaveBeenCalled();
    });

    it('should ignore hits on the wrong target', async () => {
        const stopSpy = jest.spyOn(game, 'stop');

        game.onGameStart();
        await jest.advanceTimersByTimeAsync(5000);

        const activeTarget = game.activeTarget;
        const wrongTarget = targets.find(t => t !== activeTarget);
        
        // Manually emit hit from wrong target
        wrongTarget.emit('hit', { reactionTime: 100, value: wrongTarget.id });

        expect(stopSpy).not.toHaveBeenCalled();
    });

    it('should handle having no targets gracefully', () => {
        const stopSpy = jest.spyOn(game, 'stop');
        game.targets = [];
        game.onGameStart();
        expect(stopSpy).toHaveBeenCalled();
    });
});