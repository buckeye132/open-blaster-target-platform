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
                updateScore({ green: 0, blue: 0 });
                break;
            case 'updateScore':
                updateScore(payload.scores);
                break;
            case 'updateTimer':
                updateTimer(payload.timeLeft);
                break;
            case 'hitFlurryStart':
                updateStatus(payload.message);
                break;
            case 'gameOver':
                updateStatus(payload.message || 'Game Over!');
                break;
            default:
                break;
        }
    };

    ws.send(JSON.stringify({ command: 'start-game', gameMode: 'team_colors', options: options, aiCommentary: aiCommentary }));
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