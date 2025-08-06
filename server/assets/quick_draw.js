let gameStatusEl;
let scoreboardEl;

window.initGame = (options, ws, aiCommentary) => {
    gameStatusEl = document.getElementById('game-status');
    scoreboardEl = document.getElementById('scoreboard');

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
                updateScoreboard(); // Clear the scoreboard
                break;
            case 'gameUpdate':
                updateStatus(updatePayload.message);
                break;
            case 'gameOver':
                updateStatus(updatePayload.message || 'Game Over!');
                if (updatePayload.winner) {
                    updateScoreboard(updatePayload.winner, updatePayload.score);
                }
                break;
        }
    };

    // The game is started by game.mjs, which sends the C2S_START_GAME message.
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