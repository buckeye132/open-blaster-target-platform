const Game = require('../base_game');
const { VisualScriptBuilder, Animations } = require('../../../target');

class WhackAMole extends Game {
    constructor(clients, targets, options) {
        super(clients, targets, options);
        this.score = 0;
        this.targetTimeout = (parseFloat(options.targetTimeout) || 1) * 1000;
        this.activeTarget = null;
    }

    static getOptions() {
        return {
            gameLength: {
                label: 'Game Length (seconds)',
                type: 'number',
                default: 30,
                min: 10,
                max: 120
            },
            targetTimeout: {
                label: 'Target Timeout (seconds)',
                type: 'number',
                default: 1.5,
                min: 0.5,
                max: 5,
                step: 0.1
            }
        };
    }

    onGameStart() {
        console.log("LOG: Starting Whack-a-Mole");

        if (this.targets.length === 0) {
            this.broadcast('gameOver', { message: 'No targets connected!', finalScore: 0 });
            this.stop();
            return;
        }

        this.targets.forEach(target => {
            let animationTime = Math.min(500, this.targetTimeout);
            target.configureHit('standard', 1, 'NONE', new VisualScriptBuilder().animation(animationTime, Animations.THEATER_CHASE, 255, 165, 0));
        });

        this.pickAndActivateTarget();
    }

    onGameEnd() {
        console.log("LOG: Whack-a-Mole finished.");
        this.broadcast('gameOver', { finalScore: this.score });
    }

    pickAndActivateTarget() {
        if (this.activeTarget) {
            // Deactivate the old target before activating a new one.l
            this.activeTarget.off();
        }
        let availableTargets = this.targets.filter(t => t !== this.activeTarget);
        if (availableTargets.length === 0) {
            // If all targets have been used, reset the list.
            availableTargets = this.targets;
        }

        this.activeTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
        this.activeTarget.activate(this.targetTimeout, 'positive', 'standard', new VisualScriptBuilder().solid(this.targetTimeout, 0, 255, 0));
    }

    handleHit(target, { value }) {
        if (target === this.activeTarget) {
            this.score++;
            this.broadcast('updateScore', { score: this.score });
            this.pickAndActivateTarget();
        }
    }

    handleExpired(target, value) {
        if (target === this.activeTarget) {
            this.pickAndActivateTarget();
        }
    }
}

module.exports = WhackAMole;
