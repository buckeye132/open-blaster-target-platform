/*
 * Copyright 2025 https://github.com/buckeye132
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const ws = new WebSocket('ws://' + window.location.host);
const gameStatusEl = document.getElementById('game-status');
const scoreboardEl = document.getElementById('scoreboard');

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
