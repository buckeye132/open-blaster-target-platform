
let gameStatusEl;
let scoreEl;

window.initGame = (options, ws, aiCommentary) => {
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
                updateScore('');
                break;
            case 'gameUpdate':
                updateStatus(payload.message);
                break;
            case 'updateScore':
                updateScore(payload.score);
                break;
            case 'gameOver':
                updateStatus(payload.message || 'Game Over!');
                break;
            default:
                // Not all messages are for this game, so it's safe to ignore them.
                break;
        }
    };

    ws.send(JSON.stringify({ command: 'start-game', gameMode: 'simon_says', aiCommentary: aiCommentary }));
};

function updateStatus(message) {
    if (gameStatusEl) {
        gameStatusEl.innerHTML = message;
    }
}

function updateScore(score) {
    if (scoreEl) {
        scoreEl.innerHTML = `<h2>${score}</h2>`;
    }
}
