let messageEl;
let gameOverlayEl;
let countdownEl;
let gameOverMessageEl;

window.initGame = (options, ws, aiCommentary) => {
    messageEl = document.getElementById('quick-draw-message');
    gameOverlayEl = document.getElementById('game-overlay');
    countdownEl = document.getElementById('countdown');
    gameOverMessageEl = document.getElementById('game-over-message');


    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'gameSetup':
                messageEl.innerText = updatePayload.message;
                gameOverlayEl.classList.add('hidden');
                break;
            case 'countdown':
                countdownEl.innerText = updatePayload.count;
                gameOverlayEl.classList.remove('hidden');
                gameOverMessageEl.classList.add('hidden');
                countdownEl.classList.remove('hidden');
                messageEl.innerText = '';
                break;
            case 'gameStart':
                gameOverlayEl.classList.add('hidden');
                messageEl.innerText = '';
                break;
            case 'gameMessage':
                messageEl.innerText = updatePayload.title;
                break;
            case 'gameOver':
                if (updatePayload.score) {
                    gameOverMessageEl.innerHTML = `<h2>Score: ${updatePayload.score}</h2>`;
                } else {
                    gameOverMessageEl.innerHTML = `<h2>${updatePayload.message}</h2>`;
                }
                break;
            case 'gameEnd':
                gameOverlayEl.classList.remove('hidden');
                countdownEl.classList.add('hidden');
                gameOverMessageEl.classList.remove('hidden');
                break;
        }
    };
};