const Game = require('../base_game');
const { VisualScriptBuilder, Animations } = require('../../../target');

class QuickDraw extends Game {
    constructor(clients, targets, options) {
        // Quick Draw is a game with no set time limit. The game ends when a target is hit or missed.
        // We pass gameLength: 0 to the base class to prevent it from setting a timeout.
        super(clients, targets, { ...options, gameLength: 0 });
        this.activeTarget = null;
        this.gameTimeout = null;
        this.winnerInfo = null;
    }

    onGameStart() {
        this.broadcast('gameMessage', { title: 'Get ready...' });

        if (this.targets.length === 0) {
            this.stop();
            return;
        }

        // Configure all targets for the game
        this.targets.forEach(target => {
            target.configureHit('quick_draw_hit', 1, 'NONE', new VisualScriptBuilder().animation(1500, Animations.RAINBOW_CYCLE, 0, 0, 0));
        });

        const delay = Math.random() * 3000 + 2000; // 2-5 second delay
        this.gameTimeout = setTimeout(() => {
            this.activeTarget = this.targets[Math.floor(Math.random() * this.targets.length)];
            this.broadcast('gameMessage', { title: 'GO!' });
            this.activeTarget.activate(10000, this.activeTarget.id, 'quick_draw_hit', new VisualScriptBuilder().animation(1000, Animations.PULSE, 255, 0, 0));
        }, delay);
    }

    onGameEnd() {
        if (this.gameTimeout) {
            clearTimeout(this.gameTimeout);
        }
        this.broadcast('gameOver', this.winnerInfo || { message: 'Missed! You were too slow.' });
    }

    handleHit(target, { reactionTime, value }) {
        if (target !== this.activeTarget) return; // Wrong target hit

        const score = `${reactionTime} ms`;
        this.winnerInfo = {
            score: score
        };
        this.stop();
    }

    handleExpired(target, { value }) {
        if (target !== this.activeTarget) return;
        this.stop();
    }
}

module.exports = QuickDraw;
