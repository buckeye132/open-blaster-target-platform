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
    window.handleGameMessage = (data) => {
        const { type, payload } = data;

        switch (type) {
            case 'gameSetup':
                updateStatus(payload.message);
                break;
            case 'countdown':
                countdownEl.innerText = payload.count;
                break;
            case 'gameStart':
                countdownEl.innerText = 'Go!';
                setTimeout(() => { countdownEl.innerText = ''; }, 500);
                updateStatus(payload.message);
                score = 0;
                updateScoreboard();
                break;
            case 'updateScore':
                score = payload.score;
                updateScoreboard();
                break;
            case 'gameOver':
                updateStatus(`Game Over! Final Score: ${payload.finalScore}`);
                break;
            default:
                // Not all messages are for this game, so it's safe to ignore them.
                break;
        }
    };

    // Send the start-game command via the main WebSocket connection
    ws.send(JSON.stringify({
        command: 'start-game',
        gameMode: 'whack_a_mole',
        options: {
            gameLength: options.gameLength * 1000,
            targetTimeout: options.targetTimeout
        },
        aiCommentary: aiCommentary
    }));
};

function updateStatus(message) {
    gameStatusEl.innerHTML = message;
}

function updateScoreboard() {
    scoreboardEl.innerHTML = `<h3>Score</h3><p>${score}</p>`;
}