const Game = require('../base_game');
const { VisualScriptBuilder, Animations } = require('../../../target');

class Demo extends Game {
    constructor(clients, targets, options) {
        // Demo game has no explicit end time, it ends when the sequence is complete.
        // Set gameLength to 0 to prevent the base game from setting a timeout.
        super(clients, targets, { ...options, gameLength: 0 });
        this.activeTarget = null;
        this.demoState = 'idle'; // Game-specific state
        this.gameTimeout = null; // To be used for individual steps
    }

    async onGameStart() {
        console.log("LOG: Starting Demo");
        this.broadcast('update', { message: 'Starting Demo Mode...' });

        if (this.targets.length === 0) {
            this.broadcast('update', { message: 'No targets connected!' });
            this.stop();
            return;
        }

        await this.runAnimationSequence();
        await this.runSingleHitSequence();
        await this.runMultiHitSequence();

        this.broadcast('update', { message: 'Demo complete!' });
        this.stop();
    }

    onGameEnd() {
        console.log("LOG: Demo finished.");
        if (this.gameTimeout) {
            clearTimeout(this.gameTimeout);
        }
        this.targets.forEach(target => target.off());
    }

    async runAnimationSequence() {
        this.broadcast('update', { message: 'Cycling animations...' });
        const animationKeys = Object.keys(Animations);
        const numTargets = this.targets.length;
        for (let i = 0; i < animationKeys.length; i += numTargets) {
            const batch = animationKeys.slice(i, i + numTargets);
            
            const activeAnimations = [];
            const promises = batch.map((animation, index) => {
                const target = this.targets[index];
                if (target) {
                    activeAnimations.push(animation);
                    return target.display(1, new VisualScriptBuilder().animation(1000, Animations[animation], 255, 255, 255));
                }
                return Promise.resolve();
            });

            if (activeAnimations.length > 0) {
                this.broadcast('update', { message: `Animations: ${activeAnimations.join(', ')}` });
            }

            await Promise.all(promises);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    runSingleHitSequence() {
        return new Promise(resolve => {
            this.broadcast('update', { message: 'Hit the target!' });
            this.demoState = 'single_hit';
            this.activeTarget = this.targets[Math.floor(Math.random() * this.targets.length)];
            this.activeTarget.configureHit('demo_hit', 1, 'NONE', new VisualScriptBuilder().animation(1000, Animations.THEATER_CHASE, 0, 0, 0));
            this.activeTarget.activate(10000, 'single_hit', 'demo_hit', new VisualScriptBuilder().animation(1000, Animations.PULSE, 255, 0, 0));
            this.gameTimeout = setTimeout(() => {
                if (this.demoState === 'single_hit') {
                    this.activeTarget.off();
                    resolve();
                }
            }, 10000);
            this.once('single_hit_done', resolve);
        });
    }

    runMultiHitSequence() {
        return new Promise(resolve => {
            this.broadcast('update', { message: 'Hit the target 5 times!' });
            this.demoState = 'multi_hit';
            this.activeTarget = this.targets[Math.floor(Math.random() * this.targets.length)];
            this.activeTarget.configureHit('demo_multi_hit', 5, 'DECREMENTAL', new VisualScriptBuilder().animation(1500, Animations.THEATER_CHASE, 0, 0, 0));
            this.activeTarget.configureInterimHit('demo_multi_hit', new VisualScriptBuilder().solid(150, 255, 255, 255));
            this.activeTarget.activate(20000, 'multi_hit', 'demo_multi_hit', new VisualScriptBuilder().animation(1000, Animations.PULSE, 0, 0, 255));
            this.gameTimeout = setTimeout(() => {
                if (this.demoState === 'multi_hit') {
                    this.activeTarget.off();
                    resolve();
                }
            }, 20000);
            this.once('multi_hit_done', resolve);
        });
    }

    handleHit(target, { value }) {
        if (target !== this.activeTarget) return;

        if (this.demoState === 'single_hit' && value === 'single_hit') {
            clearTimeout(this.gameTimeout);
            this.emit('single_hit_done');
        } else if (this.demoState === 'multi_hit' && value === 'multi_hit') {
            clearTimeout(this.gameTimeout);
            this.emit('multi_hit_done');
        }
    }

    handleExpired(target, value) {
        if (target !== this.activeTarget) return;

        if (this.demoState === 'single_hit' && value === 'single_hit') {
            this.emit('single_hit_done');
        } else if (this.demoState === 'multi_hit' && value === 'multi_hit') {
            this.emit('multi_hit_done');
        }
    }
}

module.exports = Demo;