let socket;
let timerDisplay;
let scoreDisplay;
let messageDisplay;

let score = 0;
let timeLeft = 30;
let hitFlurryActive = false;

let gameTimerInterval = null;

window.initGame = (options) => {
    const gameSpecificContent = document.getElementById('game-specific-content');
    gameSpecificContent.innerHTML = `
        <div id="timer">Time: ${timeLeft}</div>
        <div id="score">Score: ${score}</div>
        <div id="message"></div>
    `;

    timerDisplay = document.getElementById('timer');
    scoreDisplay = document.getElementById('score');
    messageDisplay = document.getElementById('message');

    socket = new WebSocket(`ws://${window.location.host}`);

    socket.addEventListener('open', () => {
        console.log('Connected to server');
        socket.send(JSON.stringify({ command: 'start-game', gameMode: 'precision_challenge' }));
    });

    socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
    });
};

function handleServerMessage(message) {
    switch (message.type) {
        case 'gameStart':
            timeLeft = message.payload.timeLeft;
            score = 0;
            messageDisplay.textContent = "Game On!";
            gameTimerInterval = setInterval(updateTimer, 1000);
            break;
        case 'updateScore':
            updateScore(message.payload.score);
            break;
        case 'updateTimer':
            timeLeft = message.payload.timeLeft;
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
            messageDisplay.textContent = `Game Over! Final Score: ${message.payload.finalScore}`;
            break;
    }
}

function updateScore(newScore) {
    score = newScore;
    scoreDisplay.textContent = `Score: ${score}`;
}

function updateTimer() {
    if (!hitFlurryActive) {
        timerDisplay.textContent = `Time: ${timeLeft}`;
    }
}