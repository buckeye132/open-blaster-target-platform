let messageEl;
let gameOverlayEl;
let countdownEl;
let gameOverMessageEl;

window.initGame = (options, ws, aiCommentary) => {
    messageEl = document.getElementById('demo-message');
    gameOverlayEl = document.getElementById('game-overlay');
    countdownEl = document.getElementById('countdown');
    gameOverMessageEl = document.getElementById('game-over-message');


    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'gameSetup':
                messageEl.innerText = updatePayload.message;
                break;
            case 'countdown':
                countdownEl.innerText = updatePayload.count;
                gameOverlayEl.classList.remove('hidden');
                gameOverMessageEl.classList.add('hidden');
                countdownEl.classList.remove('hidden');
                break;
            case 'gameStart':
                gameOverlayEl.classList.add('hidden');
                messageEl.innerText = '';
                break;
            case 'update':
                if (updatePayload.message) {
                    messageEl.innerText = updatePayload.message;
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