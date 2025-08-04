// Precision Challenge Game Logic
const socket = new WebSocket(`ws://${window.location.host}`);

const timerDisplay = document.getElementById('timer');
const scoreDisplay = document.getElementById('score');
const messageDisplay = document.getElementById('message');

let score = 0;
let timeLeft = 90;
let targetTimeout = 3000;
let hitFlurryActive = false;

let gameTimerInterval = null;

socket.addEventListener('open', () => {
    console.log('Connected to server');
    socket.send(JSON.stringify({ command: 'start-game', gameMode: 'precision_challenge' }));
});

socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
});

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
        // The server is the source of truth for the timer, so we just display it.
        // timeLeft--; 
        timerDisplay.textContent = `Time: ${timeLeft}`;
    }
}
