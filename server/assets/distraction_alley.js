
let gameStatusEl;
let scoreEl;
let timerDisplay;

window.initGame = (options, ws, aiCommentary) => {
    const gameSpecificContent = document.getElementById('game-specific-content');
    gameSpecificContent.innerHTML = `
        <div id="timer">Time: ${options.gameLength || 30}</div>
    `;

    timerDisplay = document.getElementById('timer');
    gameStatusEl = document.getElementById('game-status');
    scoreEl = document.getElementById('scoreboard');


    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'gameSetup':
                updateStatus(updatePayload.message);
                break;
            case 'countdown':
                updateStatus(`Get Ready... ${updatePayload.count}`);
                break;
            case 'gameStart':
                updateStatus(updatePayload.message);
                updateScore(0);
                break;
            case 'updateScore':
                updateScore(updatePayload.score);
                break;
            case 'updateTimer':
                updateTimer(updatePayload.timeLeft);
                break;
            case 'gameOver':
                updateStatus(updatePayload.message || 'Game Over!');
                break;
        }
    };

    // The game is started by game.mjs, which sends the C2S_START_GAME message.
};

function updateStatus(message) {
    if (gameStatusEl) {
        gameStatusEl.innerHTML = message;
    }
}

function updateScore(score) {
    if (scoreEl) {
        scoreEl.innerHTML = `<h2>Score: ${score}</h2>`;
    }
}

function updateTimer(timeLeft) {
    if (timerDisplay) {
        timerDisplay.textContent = `Time: ${timeLeft}`;
    }
}