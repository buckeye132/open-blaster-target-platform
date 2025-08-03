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


let targets = [];
let isGameRunning = false;
let score = 0;
let activeTarget = null;

function sendCommandToServer(targetId, command, ...args) {
  const commandStr = [command, ...args].join(' ').trim();
  ws.send(JSON.stringify({ targetId, command: commandStr }));
  console.log(`> [${targetId}] ${commandStr}`);
}

function updateStatus(message) {
    gameStatusEl.innerHTML = message;
}

function updateScoreboard() {
    scoreboardEl.innerHTML = `<h3>Score</h3><p>${score}</p>`;
}

async function countdown(seconds) {
    for (let i = seconds; i > 0; i--) {
        countdownEl.innerText = i;
        for (const targetId of targets) {
            // Pulse all targets white for 1 second
            sendCommandToServer(targetId, 'DISPLAY', '1', '250 ANIM PULSE 255 255 255');
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    countdownEl.innerText = 'Go!';
    await new Promise(r => setTimeout(r, 500));
    countdownEl.innerText = '';
}


async function startGame() {
    if (isGameRunning) return;
    score = 0;
    
    settingsPanel.style.display = 'none';
    gamePanel.style.display = 'block';

    updateStatus('Get Ready!');
    updateScoreboard();

    if (targets.length === 0) {
        updateStatus('No targets connected! Please go back to the lobby.');
        return;
    }

    await countdown(5);

    isGameRunning = true;
    updateStatus('Whack-a-Mole!');


    // 1. Configure all targets
    for (const targetId of targets) {
        sendCommandToServer(targetId, 'CONFIG_HIT', 'standard', '1', 'NONE', '500 SOLID 255 165 0');
    }
    await new Promise(r => setTimeout(r, 500)); // Give targets time to process

    // 2. Start the game loop
    pickAndActivateTarget();

    // 3. Set game timer
    const gameLength = parseInt(gameLengthInput.value, 10) * 1000;
    setTimeout(() => {
        endGame();
    }, gameLength);
}

function pickAndActivateTarget() {
    if (!isGameRunning) return;

    let availableTargets = targets.filter(t => t !== activeTarget);
    if (availableTargets.length === 0) {
        availableTargets = targets;
    }

    const targetTimeout = targetTimeoutInput.value;
    activeTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
    sendCommandToServer(activeTarget, 'ON', targetTimeout, 'positive', 'standard', targetTimeout + ' SOLID 0 255 0');
}

function endGame() {
    isGameRunning = false;
    updateStatus('Game Over! Final Score: ' + score);
    if(activeTarget) {
        sendCommandToServer(activeTarget, 'OFF');
    }
    settingsPanel.style.display = 'block';
}

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'TARGET_LIST') {
        targets = data.payload;
    } else if (data.type === 'LOG_MESSAGE') {
        if (!isGameRunning) return;

        const { from, message } = data.payload;
        const parts = message.split(' ');
        const eventType = parts[0];

        if (from === activeTarget) {
            if (eventType === 'HIT') {
                score++;
                updateScoreboard();
                pickAndActivateTarget();
            } else if (eventType === 'EXPIRED') {
                pickAndActivateTarget(); // Move to the next target even if missed
            }
        }
    }
};

ws.onopen = () => {
    // The server will automatically send the target list on connection.
};

ws.onclose = () => {
    updateStatus('Connection to server lost. Please return to the lobby.');
};

startGameBtn.addEventListener('click', startGame);