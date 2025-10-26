const serverIpInput = document.getElementById('server-ip');
const addTargetBtn = document.getElementById('add-target-btn');
const targetsContainer = document.getElementById('targets-container');
let nextTargetNum = 0;

// Add a new target to the UI
addTargetBtn.addEventListener('click', () => {
    nextTargetNum++;
    const targetId = `target-${nextTargetNum}`;
    const serverIp = serverIpInput.value;

    if (!serverIp) {
        alert('Please enter a server IP address.');
        return;
    }

    createTargetElement(targetId, nextTargetNum);
    window.electronAPI.connect(targetId, serverIp);
});

function createTargetElement(targetId, displayNum) {
    const targetDiv = document.createElement('div');
    targetDiv.id = targetId;
    targetDiv.className = 'target idle'; // Start with idle class
    targetDiv.innerHTML = `
        <div class="target-header">
            <span class="target-id">Target ${displayNum}</span>
            <button class="delete-btn-sm" title="Delete Target">X</button>
        </div>
        <div class="target-body">
            <div class="state-display">State: IDLE</div>
            <div class="visual-display">
                <div class="color-swatch"></div>
                <span class="anim-name"></span>
            </div>
            <div class="hit-counter"></div>
            <button class="hit-btn" disabled>Hit</button>
            <details class="log-details">
                <summary>Logs</summary>
                <div class="log-container"></div>
            </details>
        </div>
        <div class="target-footer">
            <span class="target-status connecting">Connecting...</span>
            <button class="connection-btn">Disconnect</button>
        </div>
    `;

    targetsContainer.appendChild(targetDiv);

    const connectionBtn = targetDiv.querySelector('.connection-btn');
    const deleteBtn = targetDiv.querySelector('.delete-btn-sm');

    connectionBtn.addEventListener('click', () => {
        const isConnected = connectionBtn.textContent === 'Disconnect';
        if (isConnected) {
            window.electronAPI.disconnect(targetId);
        } else {
            const serverIp = serverIpInput.value;
            if (!serverIp) {
                alert('Please enter a server IP address.');
                return;
            }
            window.electronAPI.connect(targetId, serverIp);
            const statusEl = targetDiv.querySelector('.target-status');
            statusEl.textContent = 'Connecting...';
            statusEl.className = 'target-status connecting';
        }
    });

    deleteBtn.addEventListener('click', () => {
        window.electronAPI.disconnect(targetId); // Ensure socket is killed before removing
        targetDiv.remove();
    });

    targetDiv.querySelector('.hit-btn').addEventListener('click', () => {
        window.electronAPI.hit(targetId);
    });
}

// Handle connection status updates from the main process
window.electronAPI.onStatusChange((targetId, status) => {
    const targetDiv = document.getElementById(targetId);
    if (targetDiv) {
        const statusEl = targetDiv.querySelector('.target-status');
        const connectionBtn = targetDiv.querySelector('.connection-btn');

        statusEl.textContent = status;
        statusEl.className = `target-status ${status.toLowerCase()}`;

        if (status === 'Connected') {
            targetDiv.classList.add('connected');
            connectionBtn.textContent = 'Disconnect';
        } else {
            targetDiv.classList.remove('connected');
            connectionBtn.textContent = 'Connect';
        }
    }
});

// Handle state updates from the main process
window.electronAPI.onStateChange((targetId, state) => {
    const targetDiv = document.getElementById(targetId);
    if (targetDiv) {
        const stateDisplay = targetDiv.querySelector('.state-display');
        const hitBtn = targetDiv.querySelector('.hit-btn');
        const visualDisplay = targetDiv.querySelector('.visual-display');
        const swatch = targetDiv.querySelector('.color-swatch');
        const animName = targetDiv.querySelector('.anim-name');
        const hitCounter = targetDiv.querySelector('.hit-counter');

        const { currentState, visualInfo, hitCount, hitsRequired } = state;

        stateDisplay.textContent = `State: ${currentState}`;
        
        targetDiv.classList.remove('idle', 'ready', 'displaying');
        targetDiv.classList.add(currentState.toLowerCase());

        hitBtn.disabled = currentState !== 'READY';

        if ((currentState === 'READY' || currentState === 'DISPLAYING') && visualInfo) {
            visualDisplay.style.display = 'flex';
            swatch.style.backgroundColor = `rgb(${visualInfo.color.r}, ${visualInfo.color.g}, ${visualInfo.color.b})`;
            animName.textContent = visualInfo.name;
        } else {
            visualDisplay.style.display = 'none';
        }

        if (currentState === 'READY' && hitsRequired > 1) {
            hitCounter.style.display = 'block';
            hitCounter.textContent = `Hits: ${hitCount} / ${hitsRequired}`;
        } else {
            hitCounter.style.display = 'none';
        }
    }
});

window.electronAPI.onTargetLog((targetId, direction, message) => {
    const targetDiv = document.getElementById(targetId);
    if (targetDiv) {
        const logContainer = targetDiv.querySelector('.log-container');
        const logEntry = document.createElement('code');
        logEntry.className = direction === 'CLIENT ->' ? 'log-out' : 'log-in';
        logEntry.textContent = `${direction} ${message}`;
        logContainer.appendChild(logEntry);
        // Auto-scroll
        logContainer.scrollTop = logContainer.scrollHeight;
    }
});