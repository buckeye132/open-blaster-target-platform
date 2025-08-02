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

function sendCommandToServer(targetId, command, ...args) {
  const commandStr = [command, ...args].join(' ').trim();
  ws.send(JSON.stringify({ targetId, command: commandStr }));
  console.log(`> [${targetId}] ${commandStr}`);
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

window.testLeds = (targetId) => {
    sendCommandToServer(targetId, 'DISPLAY', '1', '250 SOLID 255 255 255 | 250 SOLID 0 0 0 | 250 SOLID 255 255 255 | 250 SOLID 0 0 0');
    updateTargetStatus(targetId, 'LEDs Tested');
};

window.testHit = (targetId) => {
    // First, configure a simple hit
    sendCommandToServer(targetId, 'CONFIG_HIT', 'lobby_test', '1', 'NONE', '500 SOLID 0 255 0');
    // Then, turn the target on
    sendCommandToServer(targetId, 'ON', '5000', 'test_hit', 'lobby_test', '1000 ANIM PULSE 255 165 0');
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
        }
    }
};
