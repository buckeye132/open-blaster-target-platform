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
const settingsPanel = document.getElementById('settings-panel');
const gamePanel = document.getElementById('game-panel');
const startGameBtn = document.getElementById('start-game-btn');
const gameLengthInput = document.getElementById('game-length');
const targetTimeoutInput = document.getElementById('target-timeout');
const countdownEl = document.getElementById('countdown');

let score = 0;

function updateStatus(message) {
    gameStatusEl.innerHTML = message;
}

function updateScoreboard() {
    scoreboardEl.innerHTML = `<h3>Score</h3><p>${score}</p>`;
}

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const { type, payload } = data;

    switch (type) {
        case 'gameSetup':
            settingsPanel.style.display = 'none';
            gamePanel.style.display = 'block';
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
            settingsPanel.style.display = 'block';
            break;
        default:
            console.log('Unknown message type:', type);
    }
};

startGameBtn.addEventListener('click', () => {
    const gameLength = parseInt(gameLengthInput.value, 10) * 1000;
    const targetTimeout = parseInt(targetTimeoutInput.value, 10);
    ws.send(JSON.stringify({
        command: 'start-game',
        gameMode: 'whack_a_mole',
        options: {
            gameLength,
            targetTimeout
        }
    }));
});

ws.onopen = () => {
    console.log('Connected to server.');
};

ws.onclose = () => {
    updateStatus('Connection to server lost. Please return to the lobby.');
};
