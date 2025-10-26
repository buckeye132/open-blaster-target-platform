import { Message, MessageType } from './protocol.mjs';

const ws = new WebSocket('ws://' + window.location.host);
const targetGrid = document.getElementById('target-grid');
const gameModeSelect = document.getElementById('game-mode-select');
const gameOptionsContainer = document.getElementById('game-options-container');
const startGameButton = document.getElementById('start-game-button');
const aiCommentaryOption = document.getElementById('ai-commentary-option');
const enableAiCommentaryCheckbox = document.getElementById('enable-ai-commentary');

let targets = {}; // Store target state
let gameOptions = {}; // Store all game options fetched from the server

// --- WebSocket Handlers ---

ws.onopen = () => {
    ws.send(JSON.stringify(Message.getAiAvailability()));
    fetchGameOptions();
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const { type, payload } = data;

    switch (type) {
        case MessageType.S2C_AI_AVAILABILITY:
            aiCommentaryOption.style.display = payload.available ? 'block' : 'none';
            break;
        case MessageType.S2C_TARGET_LIST_UPDATE:
            updateTargetGrid(payload.targetList);
            break;
        case MessageType.S2C_TARGET_LOG_MESSAGE:
            handleTargetLog(payload);
            break;
    }
};

// --- UI Functions ---

function fetchGameOptions() {
    fetch('/games/options')
        .then(response => response.json())
        .then(options => {
            gameOptions = options;
            // Trigger a change event to render the initial options
            gameModeSelect.dispatchEvent(new Event('change'));
        })
        .catch(error => console.error('Error fetching game options:', error));
}

function renderGameOptions(gameId) {
    gameOptionsContainer.innerHTML = '';
    const options = gameOptions[gameId];

    if (!options || Object.keys(options).length === 0) {
        gameOptionsContainer.style.display = 'none';
        return;
    }

    gameOptionsContainer.style.display = 'block';

    for (const key in options) {
        const option = options[key];
        const optionEl = document.createElement('div');
        optionEl.className = 'game-option';

        const label = document.createElement('label');
        label.htmlFor = `option-${key}`;
        label.textContent = option.label;

        const input = document.createElement('input');
        input.type = option.type;
        input.id = `option-${key}`;
        input.name = key;
        input.value = option.default;
        if (option.min) input.min = option.min;
        if (option.max) input.max = option.max;
        if (option.step) input.step = option.step;

        optionEl.appendChild(label);
        optionEl.appendChild(input);
        gameOptionsContainer.appendChild(optionEl);
    }
}

function updateTargetGrid(targetList) {
    const onlineTargets = new Set(targetList);

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

function handleTargetLog({ from, message }) {
    if (message.startsWith('HIT')) {
        updateTargetStatus(from, 'HIT Detected!', 'hit');
    } else if (message.startsWith('EXPIRED')) {
        updateTargetStatus(from, 'Hit Test EXPIRED', 'expired');
    } else if (message.includes('Auto-calibration complete')) {
        const thresholdMatch = message.match(/New threshold: (\d+)/);
        const status = thresholdMatch ? `Calibrated! Threshold: ${thresholdMatch[1]}` : 'Calibration Finished';
        updateTargetStatus(from, status, 'hit');
    }
}

function updateTargetStatus(targetId, message, type = 'info') {
    const statusEl = document.getElementById(`status-${targetId.replace(/[:.]/g, '-')}`);
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'status ' + type;
    }
}

// --- Global Functions for Buttons ---

window.calibrateTarget = (targetId) => {
    ws.send(JSON.stringify(Message.targetCommand(targetId, 'calibrate-piezo')));
    updateTargetStatus(targetId, 'Calibrating...');
};

window.testLeds = (targetId) => {
    ws.send(JSON.stringify(Message.targetCommand(targetId, 'test-leds')));
    updateTargetStatus(targetId, 'LEDs Tested');
};

window.testHit = (targetId) => {
    ws.send(JSON.stringify(Message.targetCommand(targetId, 'test-hit')));
    updateTargetStatus(targetId, 'Waiting for hit...');
};

// --- Event Listeners ---

gameModeSelect.addEventListener('change', () => {
    renderGameOptions(gameModeSelect.value);
});

startGameButton.addEventListener('click', () => {
    const selectedGame = gameModeSelect.value;
    const aiCommentary = enableAiCommentaryCheckbox.checked;
    const options = {};

    const optionInputs = gameOptionsContainer.querySelectorAll('input');
    optionInputs.forEach(input => {
        options[input.name] = input.value;
    });

    ws.send(JSON.stringify(Message.startGame(selectedGame, options, aiCommentary)));
    window.location.href = `/game?game=${selectedGame}`;
});