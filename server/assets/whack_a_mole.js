let ws;
let gameStatusEl;
let scoreboardEl;
let countdownEl;

let score = 0;

window.initGame = (options) => {
    const gameSpecificContent = document.getElementById('game-specific-content');
    gameSpecificContent.innerHTML = `
        <div id="countdown" style="font-size: 2em; text-align: center;"></div>
    `;

    gameStatusEl = document.getElementById('game-status');
    scoreboardEl = document.getElementById('scoreboard');
    countdownEl = document.getElementById('countdown');

    ws = new WebSocket('ws://' + window.location.host);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
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
                console.log('Unknown message type:', type);
        }
    };

    ws.onopen = () => {
        console.log('Connected to server.');
        ws.send(JSON.stringify({
            command: 'start-game',
            gameMode: 'whack_a_mole',
            options: {
                gameLength: options.gameLength * 1000,
                targetTimeout: options.targetTimeout
            }
        }));
    };
};

function updateStatus(message) {
    gameStatusEl.innerHTML = message;
}

function updateScoreboard() {
    scoreboardEl.innerHTML = `<h3>Score</h3><p>${score}</p>`;
}