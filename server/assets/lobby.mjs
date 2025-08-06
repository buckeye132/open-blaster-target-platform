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

import { Message, MessageType } from './protocol.mjs';

const ws = new WebSocket('ws://' + window.location.host);
const targetGrid = document.getElementById('target-grid');

let targets = {}; // Store target state

function sendCommandToServer(message) {
  ws.send(JSON.stringify(message));
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
        <div class="button-group">
            <button onclick="testLeds('${targetId}')">Test LEDs</button>
            <button onclick="testHit('${targetId}')">Test Hit</button>
            <button onclick="calibrateTarget('${targetId}')">Calibrate</button>
        </div>
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
    sendCommandToServer(Message.targetCommand(targetId, 'calibrate-piezo'));
    updateTargetStatus(targetId, 'Calibrating...');
};

window.testLeds = (targetId) => {
    sendCommandToServer(Message.targetCommand(targetId, 'test-leds'));
    updateTargetStatus(targetId, 'LEDs Tested');
};

window.testHit = (targetId) => {
    sendCommandToServer(Message.targetCommand(targetId, 'test-hit'));
    updateTargetStatus(targetId, 'Waiting for hit...');
};

const gameModeSelect = document.getElementById('game-mode-select');
const startGameButton = document.getElementById('start-game-button');
const whackAMoleSettings = document.getElementById('whack-a-mole-settings');
const wamGameLengthInput = document.getElementById('wam-game-length');
const wamTargetTimeoutInput = document.getElementById('wam-target-timeout');
const precisionChallengeSettings = document.getElementById('precision-challenge-settings');
const pcGameLengthInput = document.getElementById('pc-game-length');

const distractionAlleySettings = document.getElementById('distraction-alley-settings');
const daGameLengthInput = document.getElementById('da-game-length');
const teamColorsSettings = document.getElementById('team-colors-settings');
const tcGameLengthInput = document.getElementById('tc-game-length');
const aiCommentaryOption = document.getElementById('ai-commentary-option');
const enableAiCommentaryCheckbox = document.getElementById('enable-ai-commentary');

// Initial message to server to check AI commentary availability
ws.onopen = () => {
    ws.send(JSON.stringify(Message.getAiAvailability()));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const { type, payload } = data;

    switch (type) {
        case MessageType.S2C_AI_AVAILABILITY:
            if (payload.available) {
                aiCommentaryOption.style.display = 'block';
            } else {
                aiCommentaryOption.style.display = 'none';
            }
            break;
        case MessageType.S2C_TARGET_LIST_UPDATE:
            const onlineTargets = new Set(payload.targetList);

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
            break;
        case MessageType.S2C_TARGET_LOG_MESSAGE:
            const { from, message } = payload;
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
            break;
    }
};

gameModeSelect.addEventListener('change', () => {
    // Hide all game settings initially
    document.querySelectorAll('.game-settings').forEach(el => {
        el.style.display = 'none';
    });

    if (gameModeSelect.value === 'whack_a_mole') {
        whackAMoleSettings.style.display = 'block';
    } else if (gameModeSelect.value === 'precision_challenge') {
        precisionChallengeSettings.style.display = 'block';
    } else if (gameModeSelect.value === 'distraction_alley') {
        distractionAlleySettings.style.display = 'block';
    } else if (gameModeSelect.value === 'team_colors') {
        teamColorsSettings.style.display = 'block';
    } else if (gameModeSelect.value === 'demo') {
        // No settings for demo mode
    }
});

startGameButton.addEventListener('click', () => {
    const selectedGame = gameModeSelect.value;
    const aiCommentary = aiCommentaryOption.style.display === 'block' && enableAiCommentaryCheckbox.checked;
    let options = {};

    if (selectedGame === 'whack_a_mole') {
        options.gameLength = wamGameLengthInput.value;
        options.targetTimeout = wamTargetTimeoutInput.value;
    } else if (selectedGame === 'precision_challenge') {
        options.gameLength = pcGameLengthInput.value;
    } else if (selectedGame === 'distraction_alley') {
        options.gameLength = daGameLengthInput.value;
    } else if (selectedGame === 'team_colors') {
        options.gameLength = tcGameLengthInput.value;
    }

    ws.send(JSON.stringify(Message.startGame(selectedGame, options, aiCommentary)));
    window.location.href = `/game?game=${selectedGame}`;
});

// Initial check for settings display
gameModeSelect.dispatchEvent(new Event('change'));