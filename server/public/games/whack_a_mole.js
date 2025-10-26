let timeRemainingEl;
let scoreEl;
let gameOverlayEl;
let countdownEl;
let gameOverMessageEl;
let finalScoreEl;

window.initGame = (options, ws, aiCommentary) => {
    timeRemainingEl = document.getElementById('time-remaining');
    scoreEl = document.getElementById('score');
    gameOverlayEl = document.getElementById('game-overlay');
    countdownEl = document.getElementById('countdown');
    gameOverMessageEl = document.getElementById('game-over-message');
    finalScoreEl = document.getElementById('final-score');

    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'gameSetup':
                // You can add logic here to show messages like "Calibrating..."
                break;
            case 'countdown':
                countdownEl.innerText = updatePayload.count;
                gameOverlayEl.classList.remove('hidden');
                gameOverMessageEl.classList.add('hidden');
                countdownEl.classList.remove('hidden');
                break;
            case 'gameStart':
                gameOverlayEl.classList.add('hidden');
                break;
            case 'gameTick':
                timeRemainingEl.innerText = updatePayload.remainingTime;
                break;
            case 'updateScore':
                scoreEl.innerText = updatePayload.score;
                break;
            case 'gameOver':
                finalScoreEl.innerText = updatePayload.finalScore;
                gameOverlayEl.classList.remove('hidden');
                countdownEl.classList.add('hidden');
                gameOverMessageEl.classList.remove('hidden');
                break;
        }
    };
};