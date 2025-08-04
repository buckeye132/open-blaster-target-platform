let ws;
let gameStatusEl;
let scoreboardEl;

window.initGame = (options) => {
    gameStatusEl = document.getElementById('game-status');
    scoreboardEl = document.getElementById('scoreboard');

    ws = new WebSocket('ws://' + window.location.host);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
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
                console.log('Unknown message type:', type);
        }
    };

    ws.onopen = () => {
        console.log('Connected to server.');
        ws.send(JSON.stringify({ command: 'start-game', gameMode: 'quick_draw' }));
    };

    ws.onclose = () => {
        updateStatus('Connection to server lost. Please return to the lobby.');
    };
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