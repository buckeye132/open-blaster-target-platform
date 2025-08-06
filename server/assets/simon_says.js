
let gameStatusEl;
let scoreEl;

window.initGame = (options, ws, aiCommentary) => {
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
                updateScore('');
                break;
            case 'gameUpdate':
                updateStatus(updatePayload.message);
                break;
            case 'updateScore':
                updateScore(updatePayload.score);
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
        scoreEl.innerHTML = `<h2>${score}</h2>`;
    }
}
