const { Worker } = require('worker_threads');
const path = require('path');
const { EventEmitter } = require('events');

class Commentator extends EventEmitter {
    constructor() {
        super();
        this.worker = null;
        this.isClosing = false;
        this.queuedStart = null; // To hold details for the next game if one is requested during shutdown
    }

    _startWorker(gameMode, gameSettings) {
        this.worker = new Worker(path.join(__dirname, 'commentator_worker.js'));
        this.isClosing = false;

        this.worker.on('message', (msg) => {
            if (msg.type === 'closed') {
                console.log('Commentator worker has confirmed shutdown.');
                this.worker.terminate();
                this.worker = null;
                this.isClosing = false;
                this.emit('commentaryComplete'); // Signal that we are done.

                // If a new game was requested while the old one was closing, start it now.
                if (this.queuedStart) {
                    const { gameMode, gameSettings } = this.queuedStart;
                    this.queuedStart = null;
                    this._startWorker(gameMode, gameSettings);
                }
            }
        });

        this.worker.on('error', (err) => {
            console.error('Commentator worker error:', err);
            this.isClosing = false;
        });

        this.worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Commentator worker stopped with exit code ${code}`);
            }
            this.isClosing = false;
        });

        this.worker.postMessage({ type: 'start', gameMode, gameSettings });
    }

    start(gameMode, gameSettings) {
        if (this.isClosing) {
            // A worker is already in the process of closing. Queue this request.
            this.queuedStart = { gameMode, gameSettings };
            return;
        }

        if (this.worker) {
            // A worker exists. We must close it first, and queue the new start.
            this.queuedStart = { gameMode, gameSettings };
            this.close();
        } else {
            // No worker exists. Start a new one immediately.
            this._startWorker(gameMode, gameSettings);
        }
    }

    onHit(hitData) {
        if (this.worker && !this.isClosing) {
            this.worker.postMessage({ type: 'event', event: `HIT, TIME: ${hitData.reactionTime}ms, VALUE: ${hitData.value}` });
        }
    }

    onMiss() {
        if (this.worker && !this.isClosing) {
            this.worker.postMessage({ type: 'event', event: 'MISS' });
        }
    }

    onTimeUpdate(timeLeft) {
        if (this.worker && !this.isClosing) {
            this.worker.postMessage({ type: 'event', event: `TIME_UPDATE, TIME_LEFT: ${timeLeft}` });
        }
    }

    onGameOver(finalScore) {
        if (this.worker && !this.isClosing) {
            this.worker.postMessage({ type: 'event', event: `GAME_OVER, FINAL_SCORE: ${finalScore}` });
        }
    }

    // The close method is now primarily for forceful shutdown if needed, the worker manages its own lifecycle.
    close() {
        if (this.worker && !this.isClosing) {
            this.isClosing = true;
            this.worker.postMessage({ type: 'close' });
        }
    }
}

module.exports = Commentator;