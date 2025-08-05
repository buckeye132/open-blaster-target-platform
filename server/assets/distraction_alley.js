
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


    window.handleGameMessage = (data) => {
        const { type, payload } = data;

        switch (type) {
            case 'gameSetup':
                updateStatus(payload.message);
                break;
            case 'countdown':
                updateStatus(`Get Ready... ${payload.count}`);
                break;
            case 'gameStart':
                updateStatus(payload.message);
                updateScore(0);
                break;
            case 'updateScore':
                updateScore(payload.score);
                break;
            case 'updateTimer':
                updateTimer(payload.timeLeft);
                break;
            case 'gameOver':
                updateStatus(payload.message || 'Game Over!');
                break;
            default:
                break;
        }
    };

    ws.send(JSON.stringify({ command: 'start-game', gameMode: 'distraction_alley', options: options, aiCommentary: aiCommentary }));
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