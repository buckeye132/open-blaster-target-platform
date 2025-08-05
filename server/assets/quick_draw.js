let gameStatusEl;
let scoreboardEl;

window.initGame = (options, ws, aiCommentary) => {
    gameStatusEl = document.getElementById('game-status');
    scoreboardEl = document.getElementById('scoreboard');

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
                updateScoreboard(); // Clear the scoreboard
                break;
            case 'gameUpdate':
                updateStatus(payload.message);
                break;
            case 'gameOver':
                updateStatus(payload.message || 'Game Over!');
                if (payload.winner) {
                    updateScoreboard(payload.winner, payload.score);
                }
                break;
            case 'TARGET_LIST':
                // The server now handles all game logic, so we don't need to do anything here.
                break;
            default:
                // Not all messages are for this game, so it's safe to ignore them.
                break;
        }
    };

    ws.send(JSON.stringify({ command: 'start-game', gameMode: 'quick_draw', aiCommentary: aiCommentary }));
};

function updateStatus(message) {
    gameStatusEl.innerHTML = message;
}

function updateScoreboard(winner, score) {
    if (winner && score) {
        scoreboardEl.innerHTML = `<h3>Winner!</h3><p>${winner}: ${score}</p>`;
    } else {
        scoreboardEl.innerHTML = '';
    }
}