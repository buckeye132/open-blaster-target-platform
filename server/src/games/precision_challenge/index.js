const Game = require('../base_game');
const { VisualScriptBuilder, Animations } = require('../../../target');

const STARTING_TIMEOUT = 1500;
const TIMEOUT_STEP = 150;
const MIN_TIMEOUT = 300;

const HITS_TO_FLURRY = 5;
const HITS_PER_TARGET_FLURRY = 3;
const TIME_PER_TARGET_FLURRY = 2500;
const SCORE_PER_TARGET_FLURRY = 3000;

const FAST_REACTION = 900;

class PrecisionChallenge extends Game {
    constructor(clients, targets, options) {
        super(clients, targets, options);
        this.score = 0;
        this.targetTimeout = STARTING_TIMEOUT;
        this.consecutiveFastHits = 0;
        this.hitFlurryActive = false;
        this.activeTargets = new Map();
    }

    onGameStart() {
        this.targets.forEach(target => {
            target.configureHit('positive', 1, 'NONE', new VisualScriptBuilder().solid(250, 0, 255, 0));
            target.configureHit('negative', 1, 'NONE', new VisualScriptBuilder().solid(250, 255, 0, 0));
            target.configureHit('flurry_hit', HITS_PER_TARGET_FLURRY, 'DECREMENTAL', new VisualScriptBuilder().animation(1000, Animations.THEATER_CHASE, 0, 0, 255));
            target.configureInterimHit('flurry_hit', new VisualScriptBuilder().solid(150, 255, 255, 255));
        });

        this.activateRandomTarget();
    }

    onGameEnd() {
        this.activeTargets.forEach((_state, target) => {
            target.off();
        });
        this.activeTargets.clear();
        this.broadcast('gameOver', { finalScore: this.score });
    }

    activateRandomTarget() {
        if (this.hitFlurryActive || this.targets.length === 0) return;

        if (this.activeTargets.size > 0) {
            const [target] = this.activeTargets.keys();
            target.off();
            this.activeTargets.delete(target);
        }

        const target = this.targets[Math.floor(Math.random() * this.targets.length)];
        const isNegative = Math.random() < 0.2;
        const value = isNegative ? 'negative' : 'positive';
        const hitConfigId = isNegative ? 'negative' : 'positive';
        const visualScript = isNegative ? new VisualScriptBuilder().solid(this.targetTimeout, 255, 0, 0) : new VisualScriptBuilder().solid(this.targetTimeout, 0, 255, 0);

        target.activate(this.targetTimeout, value, hitConfigId, visualScript);
        this.activeTargets.set(target, { value, activationTime: Date.now() });
    }

    handleHit(target, { reactionTime, value }) {
        if (!this.activeTargets.has(target)) return;

        if (this.hitFlurryActive) {
            this.score += SCORE_PER_TARGET_FLURRY;
            this.activeTargets.delete(target);
            if (this.activeTargets.size === 0) {
                this.endHitFlurry();
            }
        } else {
            if (value === 'positive') {
                const points = Math.max(100, 1500 - reactionTime);
                this.score += points;
                this.targetTimeout = Math.max(MIN_TIMEOUT, this.targetTimeout - (TIMEOUT_STEP * (reactionTime < FAST_REACTION ? 1 : -1)));
                this.consecutiveFastHits = reactionTime < FAST_REACTION ? this.consecutiveFastHits + 1 : 0;
            } else if (value === 'negative') {
                this.score -= 500;
                this.targetTimeout += TIMEOUT_STEP;
                this.consecutiveFastHits = 0;
            }

            if (this.consecutiveFastHits >= HITS_TO_FLURRY) {
                this.triggerHitFlurry();
            } else {
                this.activateRandomTarget();
            }
        }
        this.broadcast('updateScore', { score: this.score });
    }

    handleExpired(target, value) {
        if (!this.activeTargets.has(target)) return;

        if (this.hitFlurryActive) return;

        if (value === 'positive') {
            this.targetTimeout += TIMEOUT_STEP;
            this.consecutiveFastHits = 0;
        } else if (value === 'negative') {
            this.score += 100;
        }

        this.broadcast('updateScore', { score: this.score });
        this.activateRandomTarget();
    }

    triggerHitFlurry() {
        this.hitFlurryActive = true;
        this.consecutiveFastHits = 0;
        this.pauseTimer();
        this.broadcast('hitFlurryStart');
        this.emit('customEvent', 'HIT_FLURRY: START');

        if (this.activeTargets.size > 0) {
            const [target] = this.activeTargets.keys();
            target.off();
            this.activeTargets.delete(target);
        }

        const targetsToArm = this.targets.slice(0, Math.min(this.targets.length, 4));
        const totalTime = TIME_PER_TARGET_FLURRY * targetsToArm.length;
        targetsToArm.forEach(target => {
            target.activate(totalTime, 'flurry_hit', 'flurry_hit', new VisualScriptBuilder().animation(1000, Animations.PULSE, 0, 0, 255));
            this.activeTargets.set(target, { value: 'flurry_hit', activationTime: Date.now() });
        });

        setTimeout(() => this.endHitFlurry(), totalTime);
    }

    endHitFlurry() {
        if (!this.hitFlurryActive) return;
        this.emit('customEvent', 'HIT_FLURRY: END');
        this.hitFlurryActive = false;

        this.activeTargets.forEach((_state, target) => {
            target.off();
        });
        this.activeTargets.clear();

        this.resumeTimer();
        this.broadcast('hitFlurryEnd');
        this.activateRandomTarget();
    }
}

module.exports = PrecisionChallenge;
