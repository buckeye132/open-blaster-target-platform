let gameStatusEl;
let scoreEl;
let timerDisplay;

window.initGame = (options, ws, aiCommentary) => {
    const gameSpecificContent = document.getElementById('game-specific-content');
    gameSpecificContent.innerHTML = `
        <div id="timer">Time: ${options.gameLength || 30}</div>
        <div id="scoreboard">
            <h2 class="green-score">Green: 0</h2>
            <h2 class="blue-score">Blue: 0</h2>
        </div>
    `;

    gameStatusEl = document.getElementById('game-status');
    scoreEl = document.getElementById('scoreboard');
    timerDisplay = document.getElementById('timer');

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
                updateScore({ green: 0, blue: 0 });
                break;
            case 'updateScore':
                updateScore(updatePayload.scores);
                break;
            case 'updateTimer':
                updateTimer(updatePayload.timeLeft);
                break;
            case 'hitFlurryStart':
                updateStatus(updatePayload.message);
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

function updateScore(scores) {
    if (scoreEl) {
        scoreEl.innerHTML = `<h2 class="green-score">Green: ${scores.green}</h2><h2 class="blue-score">Blue: ${scores.blue}</h2>`;
    }
}

function updateTimer(timeLeft) {
    if (timerDisplay) {
        timerDisplay.textContent = `Time: ${timeLeft}`;
    }
}