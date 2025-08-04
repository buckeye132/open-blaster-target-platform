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
const targetGrid = document.getElementById('target-grid');

let targets = {}; // Store target state

function sendCommandToServer(targetId, command) {
  ws.send(JSON.stringify({ targetId, command }));
  console.log(`> [${targetId}] ${command}`);
}

function renderTargetCard(targetId) {
    const target = targets[targetId];
    let card = document.getElementById(`target-${targetId.replace(/[:.]/g, '-')}`);
    if (!card) {
        card = document.createElement('div');
        card.id = `target-${targetId.replace(/[:.]/g, '-')}`;
        card.className = 'target-card';
        targetGrid.appendChild(card);
    }

    card.innerHTML = `
        <h3>${targetId}</h3>
        <div class="status" id="status-${targetId.replace(/[:.]/g, '-')}">Idle</div>
        <button onclick="testLeds('${targetId}')">Test LEDs</button>
        <button onclick="testHit('${targetId}')">Test Hit</button>
        <button onclick="calibrateTarget('${targetId}')">Calibrate</button>
    `;
    card.classList.toggle('offline', !target.online);
}

function updateTargetStatus(targetId, message, type = 'info') {
    const statusEl = document.getElementById(`status-${targetId.replace(/[:.]/g, '-')}`);
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'status ' + type;
    }
}

window.calibrateTarget = (targetId) => {
    sendCommandToServer(targetId, 'calibrate-piezo');
    updateTargetStatus(targetId, 'Calibrating...');
};

window.testLeds = (targetId) => {
    sendCommandToServer(targetId, 'test-leds');
    updateTargetStatus(targetId, 'LEDs Tested');
};

window.testHit = (targetId) => {
    sendCommandToServer(targetId, 'test-hit');
    updateTargetStatus(targetId, 'Waiting for hit...');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'TARGET_LIST') {
        const onlineTargets = new Set(data.payload);

        // Add new targets
        for (const targetId of onlineTargets) {
            if (!targets[targetId]) {
                targets[targetId] = { online: true };
            }
            targets[targetId].online = true;
            renderTargetCard(targetId);
        }

        // Mark disconnected targets as offline
        for (const targetId in targets) {
            if (!onlineTargets.has(targetId)) {
                targets[targetId].online = false;
            }
            renderTargetCard(targetId);
        }
    } else if (data.type === 'LOG_MESSAGE') {
        const { from, message } = data.payload;
        if (message.startsWith('HIT')) {
            updateTargetStatus(from, 'HIT Detected!', 'hit');
        } else if (message.startsWith('EXPIRED')) {
            updateTargetStatus(from, 'Hit Test EXPIRED', 'expired');
        } else if (message.includes('Auto-calibration complete')) {
            const thresholdMatch = message.match(/New threshold: (\d+)/);
            if (thresholdMatch && thresholdMatch[1]) {
                updateTargetStatus(from, `Calibrated! Threshold: ${thresholdMatch[1]}`, 'hit');
            } else {
                updateTargetStatus(from, 'Calibration Finished', 'hit');
            }
        }
    }
};

const gameModeSelect = document.getElementById('game-mode-select');
const startGameButton = document.getElementById('start-game-button');
const whackAMoleSettings = document.getElementById('whack-a-mole-settings');
const wamGameLengthInput = document.getElementById('wam-game-length');
const wamTargetTimeoutInput = document.getElementById('wam-target-timeout');
const precisionChallengeSettings = document.getElementById('precision-challenge-settings');
const pcGameLengthInput = document.getElementById('pc-game-length');

gameModeSelect.addEventListener('change', () => {
    whackAMoleSettings.style.display = 'none';
    precisionChallengeSettings.style.display = 'none';

    if (gameModeSelect.value === 'whack_a_mole') {
        whackAMoleSettings.style.display = 'block';
    } else if (gameModeSelect.value === 'precision_challenge') {
        precisionChallengeSettings.style.display = 'block';
    }
});

startGameButton.addEventListener('click', () => {
    const selectedGame = gameModeSelect.value;
    let url = `/game?game=${selectedGame}`;

    if (selectedGame === 'whack_a_mole') {
        const gameLength = wamGameLengthInput.value;
        const targetTimeout = wamTargetTimeoutInput.value;
        url += `&gameLength=${gameLength}&targetTimeout=${targetTimeout}`;
    } else if (selectedGame === 'precision_challenge') {
        const gameLength = pcGameLengthInput.value;
        url += `&gameLength=${gameLength}`;
    }
    window.location.href = url;
});

// Initial check for settings display
gameModeSelect.dispatchEvent(new Event('change'));