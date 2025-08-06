let gameStatusEl;
let scoreboardEl;
let countdownEl;

let score = 0;

window.initGame = (options, ws, aiCommentary) => {
    const gameSpecificContent = document.getElementById('game-specific-content');
    gameSpecificContent.innerHTML = `
        <div id="countdown" style="font-size: 2em; text-align: center;"></div>
    `;

    gameStatusEl = document.getElementById('game-status');
    scoreboardEl = document.getElementById('scoreboard');
    countdownEl = document.getElementById('countdown');

    // The main WebSocket message handler is in game.js
    // This function will be called by game.js with game-specific messages
    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'gameSetup':
                updateStatus(updatePayload.message);
                break;
            case 'countdown':
                countdownEl.innerText = updatePayload.count;
                break;
            case 'gameStart':
                countdownEl.innerText = 'Go!';
                setTimeout(() => { countdownEl.innerText = ''; }, 500);
                updateStatus(updatePayload.message);
                score = 0;
                updateScoreboard();
                break;
            case 'updateScore':
                score = updatePayload.score;
                updateScoreboard();
                break;
            case 'gameOver':
                updateStatus(`Game Over! Final Score: ${updatePayload.finalScore}`);
                break;
        }
    };

    // Send the start-game command via the main WebSocket connection
    // The game is started by game.mjs, which sends the C2S_START_GAME message.
};

function updateStatus(message) {
    gameStatusEl.innerHTML = message;
}

function updateScoreboard() {
    scoreboardEl.innerHTML = `<h3>Score</h3><p>${score}</p>`;
}