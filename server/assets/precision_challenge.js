let timerDisplay;
let scoreDisplay;
let messageDisplay;

let score = 0;
let timeLeft;
let hitFlurryActive = false;

let gameTimerInterval = null;

window.initGame = (options, ws, aiCommentary) => {
    const gameSpecificContent = document.getElementById('game-specific-content');
    gameSpecificContent.innerHTML = `
        <div id="timer">Time: ${options.gameLength || 30}</div>
        <div id="score">Score: ${score}</div>
        <div id="message"></div>
    `;

    timerDisplay = document.getElementById('timer');
    scoreDisplay = document.getElementById('score');
    messageDisplay = document.getElementById('message');

    window.handleGameMessage = (payload) => {
        const { updateType, ...updatePayload } = payload;

        switch (updateType) {
            case 'gameStart':
                timeLeft = updatePayload.timeLeft;
                score = 0;
                messageDisplay.textContent = "Game On!";
                gameTimerInterval = setInterval(updateTimer, 1000);
                break;
            case 'updateScore':
                updateScore(updatePayload.score);
                break;
            case 'updateTimer':
                timeLeft = updatePayload.timeLeft;
                timerDisplay.textContent = `Time: ${timeLeft}`;
                break;
            case 'hitFlurryStart':
                hitFlurryActive = true;
                messageDisplay.textContent = "HIT FLURRY!";
                break;
            case 'hitFlurryEnd':
                hitFlurryActive = false;
                messageDisplay.textContent = "";
                break;
            case 'gameOver':
                clearInterval(gameTimerInterval);
                messageDisplay.textContent = `Game Over! Final Score: ${updatePayload.finalScore}`;
                break;
        }
    };

    // The game is started by game.mjs, which sends the C2S_START_GAME message.
};

function updateScore(newScore) {
    score = newScore;
    scoreDisplay.textContent = `Score: ${score}`;
}

function updateTimer() {
    if (!hitFlurryActive) {
        timerDisplay.textContent = `Time: ${timeLeft}`;
    }
}