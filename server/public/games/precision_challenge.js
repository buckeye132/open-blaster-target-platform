let timerDisplay;
let scoreDisplay;
let messageDisplay;
let gameOverlayEl;
let gameOverMessageEl;

window.initGame = (options, ws, aiCommentary) => {
    timerDisplay = document.getElementById('time-remaining');
    scoreDisplay = document.getElementById('score');
    messageDisplay = document.getElementById('message');
    gameOverlayEl = document.getElementById('game-overlay');
    gameOverMessageEl = document.getElementById('game-over-message');
    countdownEl = document.getElementById('countdown');


    timerDisplay.textContent = `Time: ${options.gameLength || 30}`;

    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'gameStart':
                gameOverlayEl.classList.add('hidden');
                messageDisplay.textContent = "Game On!";
                break;
            case 'gameTick':
                if (messageDisplay.textContent !== "HIT FLURRY!") {
                    timerDisplay.textContent = `Time: ${updatePayload.remainingTime}`;
                }
                break;
            case 'updateScore':
                scoreDisplay.textContent = `Score: ${updatePayload.score}`;
                break;
            case 'hitFlurryStart':
                messageDisplay.textContent = "HIT FLURRY!";
                break;
            case 'hitFlurryEnd':
                messageDisplay.textContent = "";
                break;
            case 'gameOver': // Custom message from the game logic
                gameOverMessageEl.innerHTML = `<h2>Final Score: ${updatePayload.finalScore}</h2>`;
                break;
            case 'gameEnd': // From base_game
                gameOverlayEl.classList.remove('hidden');
                document.getElementById('countdown').classList.add('hidden');
                gameOverMessageEl.classList.remove('hidden');
                break;
            case 'countdown':
                countdownEl.innerText = updatePayload.count;
                gameOverlayEl.classList.remove('hidden');
                gameOverMessageEl.classList.add('hidden');
                countdownEl.classList.remove('hidden');
                messageDisplay.innerText = '';
                break;
            case 'gameMessage':
                messageDisplay.innerText = updatePayload.title;
                break;
        }
    };
};
