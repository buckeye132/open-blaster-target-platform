const Game = require('../base_game');
const { VisualScriptBuilder, Animations } = require('../../../target');

class SimonSays extends Game {
    constructor(clients, targets, options) {
        super(clients, targets, { ...options, gameLength: 0 }); // Simon Says is not time-based
        this.sequence = [];
        this.playerSequence = [];
        this.round = 1;
    }

    async onGameStart() {
        if (this.targets.length === 0) {
            this.broadcast('gameOver', { message: 'No targets connected!' });
            this.stop();
            return;
        }

        this.targets.forEach(target => {
            target.configureHit('simon_says_hit', 1, 'NONE', new VisualScriptBuilder().solid(0, 0, 0, 0));
        });

        await this.nextRound();
    }

    onGameEnd() {
        // No specific cleanup needed for Simon Says
    }

    async nextRound() {
        this.playerSequence = [];
        this.broadcast('gameUpdate', { round: this.round, message: 'Watch carefully...' });
        this.sequence.push(this.targets[Math.floor(Math.random() * this.targets.length)]);

        await this.playSequence();

        this.broadcast('gameUpdate', { message: 'Your turn!' });
        this.activateTargets();
    }

    async playSequence() {
        for (const target of this.sequence) {
            target.display(1, new VisualScriptBuilder().solid(1000, 255, 255, 0));
            await new Promise(resolve => setTimeout(resolve, 1200));
        }
    }

    activateTargets() {
        this.targets.forEach(target => {
            target.activate(15000, target.id, 'simon_says_hit', new VisualScriptBuilder().solid(0, 100, 100, 100));
        });
    }

    handleHit(target, value) {
        this.targets.forEach(t => t.off());

        this.playerSequence.push(target);
        const correctTarget = this.sequence[this.playerSequence.length - 1];

        if (target !== correctTarget) {
            this.targets.forEach(t => t.display(1, new VisualScriptBuilder().animation(1000, Animations.THEATER_CHASE, 255, 0, 0)));
            this.broadcast('gameOver', { round: this.round });
            setTimeout(() => this.stop(), 1000);
        } else {
            if (this.playerSequence.length === this.sequence.length) {
                this.targets.forEach(t => t.display(1, new VisualScriptBuilder().animation(1000, Animations.THEATER_CHASE, 0, 255, 0)));
                this.round++;
                this.broadcast('gameUpdate', { message: 'Good job! Next round...' });
                setTimeout(() => this.nextRound(), 1500);
            } else {
                target.display(1, new VisualScriptBuilder().solid(250, 0, 255, 0));
                setTimeout(() => {
                    this.activateTargets();
                }, 250);
            }
        }
    }

    handleExpired(target, value) {
        this.broadcast('gameOver', { round: this.round });
        this.stop();
    }
}

module.exports = SimonSays;
