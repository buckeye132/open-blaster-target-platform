let roundNumberEl;
let gameStatusEl;
let gameOverlayEl;
let countdownEl;
let gameOverMessageEl;
let finalRoundEl;

window.initGame = (options, ws, aiCommentary) => {
    roundNumberEl = document.getElementById('round-number');
    gameStatusEl = document.getElementById('game-status');
    gameOverlayEl = document.getElementById('game-overlay');
    countdownEl = document.getElementById('countdown');
    gameOverMessageEl = document.getElementById('game-over-message');
    finalRoundEl = document.getElementById('final-round');

    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'countdown':
                countdownEl.innerText = updatePayload.count;
                gameOverlayEl.classList.remove('hidden');
                gameOverMessageEl.classList.add('hidden');
                countdownEl.classList.remove('hidden');
                break;
            case 'gameStart':
                gameOverlayEl.classList.add('hidden');
                break;
            case 'gameUpdate':
                if(updatePayload.message) {
                    gameStatusEl.innerText = updatePayload.message;
                }
                if(updatePayload.round) {
                    roundNumberEl.innerText = updatePayload.round;
                }
                break;
            case 'gameOver':
                finalRoundEl.innerText = updatePayload.round;
                gameOverlayEl.classList.remove('hidden');
                countdownEl.classList.add('hidden');
                gameOverMessageEl.classList.remove('hidden');
                break;
        }
    };
};
