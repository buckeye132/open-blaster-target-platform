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

let targets = [];
let isGameRunning = false;

function sendCommandToServer(targetId, command, ...args) {
  const commandStr = [command, ...args].join(' ').trim();
  ws.send(JSON.stringify({ targetId, command: commandStr }));
  console.log(`> [${targetId}] ${commandStr}`);
}

function updateStatus(message) {
    gameStatusEl.innerHTML = message;
}

function updateScoreboard(targetId, score) {
    scoreboardEl.innerHTML = `<h3>Score</h3><p>${targetId}: ${score} ms</p>`;
}

async function startGame() {
    if (isGameRunning) return;
    isGameRunning = true;
    updateStatus('Starting Quick Draw...');

    if (targets.length === 0) {
        updateStatus('No targets connected! Please go back to the lobby.');
        return;
    }

    // 1. Configure all targets
    updateStatus('Configuring targets...');
    for (const targetId of targets) {
        sendCommandToServer(targetId, 'CONFIG_HIT', 'quick_draw_hit', '1', 'NONE', '500 SOLID 0 255 0');
    }
    await new Promise(r => setTimeout(r, 500)); // Give targets time to process

    // 2. Start the game loop
    const delay = Math.random() * 3000 + 2000; // 2-5 second delay
    updateStatus(`Get ready...`);
    setTimeout(() => {
        const targetId = targets[Math.floor(Math.random() * targets.length)];
        updateStatus('GO!');
        sendCommandToServer(targetId, 'ON', '10000', targetId, 'quick_draw_hit', '1000 ANIM PULSE 255 0 0');
    }, delay);
}

function stopGame() {
    isGameRunning = false;
    for (const targetId of targets) {
        sendCommandToServer(targetId, 'OFF');
    }
}

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'TARGET_LIST') {
        targets = data.payload;
        if (!isGameRunning) {
            startGame();
        }
    } else if (data.type === 'LOG_MESSAGE') {
        if (!isGameRunning) return;

        const { from, message } = data.payload;
        const parts = message.split(' ');
        const eventType = parts[0];

        if (eventType === 'HIT') {
            const reactionTime = parseInt(parts[1], 10);
            updateStatus('HIT!');
            updateScoreboard(from, reactionTime);
            isGameRunning = false;
        } else if (eventType === 'EXPIRED') {
            updateStatus('Missed! Game over.');
            stopGame();
        }
    }
};

ws.onopen = () => {
    // The server will automatically send the target list on connection.
};

ws.onclose = () => {
    updateStatus('Connection to server lost. Please return to the lobby.');
};