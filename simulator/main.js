const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');

const sockets = new Map();
const targetStates = new Map(); // To store state for each target

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  return mainWindow;
}

function logToTargetUI(win, targetId, direction, message) {
    if (win && !win.isDestroyed()) {
        win.webContents.send('target-log', { targetId, direction, message: message.trim() });
    }
}

app.whenReady().then(() => {
  const mainWindow = createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // --- IPC Handlers ---

  ipcMain.on('connect-target', (event, { targetId, ip }) => {
      const port = 8888;
      const socket = new net.Socket();
      sockets.set(targetId, socket);
      // Initialize full state object
      targetStates.set(targetId, {
          currentState: 'Connecting',
          hitCount: 0,
          hitsRequired: 1,
          hitConfigs: new Map(),
          interimHitConfigs: new Map(),
          visualInfo: null
      });

      socket.connect(port, ip, () => {
          console.log(`[${targetId}] Connected to ${ip}:${port}`);
          const handshakeMsg = `ID_SIMULATED:${targetId}\n`;
          socket.write(handshakeMsg);
          logToTargetUI(mainWindow, targetId, 'CLIENT ->', handshakeMsg);
          event.sender.send('target-status-change', { targetId, status: 'Connected' });
          updateTargetState(mainWindow, targetId, 'IDLE');
      });

      socket.on('close', () => {
          console.log(`[${targetId}] Connection closed.`);
          mainWindow.webContents.send('target-status-change', { targetId, status: 'Disconnected' });
          targetStates.delete(targetId);
          sockets.delete(targetId);
      });

      socket.on('error', (err) => {
          console.error(`[${targetId}] Socket Error:`, err.message);
          mainWindow.webContents.send('target-status-change', { targetId, status: 'Error' });
      });

      let inputBuffer = '';
      socket.on('data', (data) => {
          inputBuffer += data.toString();
          let newlineIndex;
          while ((newlineIndex = inputBuffer.indexOf('\n')) !== -1) {
              const message = inputBuffer.substring(0, newlineIndex).trim();
              inputBuffer = inputBuffer.substring(newlineIndex + 1);
              if (message) {
                  handleServerCommand(mainWindow, targetId, message);
              }
          }
      });
  });

  ipcMain.on('disconnect-target', (_event, targetId) => {
      if (sockets.has(targetId)) {
          sockets.get(targetId).destroy();
      }
  });

  ipcMain.on('hit', (_event, targetId) => {
      const state = targetStates.get(targetId);
      const socket = sockets.get(targetId);

      if (!state || state.currentState !== 'READY' || !socket) {
          console.log(`[${targetId}] Hit ignored. State: ${state?.currentState}, Socket: ${socket ? 'exists' : 'null'}`);
          return;
      }

      state.hitCount++;

      if (state.hitCount >= state.hitsRequired) {
          // Final hit
          const reactionTime = Date.now() - state.activateTime;
          const message = `HIT ${reactionTime} ${state.value}\n`;
          logToTargetUI(mainWindow, targetId, 'CLIENT ->', message);
          socket.write(message);

          const finalHitConfig = state.hitConfigs.get(state.activeHitConfigId);
          const visualScript = finalHitConfig ? finalHitConfig.visualScript : null;
          const visualInfo = parseVisualScript(visualScript);
          const duration = calculateScriptDuration(visualScript);
          
          updateTargetState(mainWindow, targetId, 'DISPLAYING', visualInfo);
          setTimeout(() => {
              if (targetStates.has(targetId)) {
                  updateTargetState(mainWindow, targetId, 'IDLE');
              }
          }, duration);

      } else {
          // Interim hit
          const interimConfig = state.interimHitConfigs.get(state.activeHitConfigId);
          if (interimConfig) {
              const visualScript = interimConfig.visualScript;
              const visualInfo = parseVisualScript(visualScript);
              const duration = calculateScriptDuration(visualScript);
              updateTargetState(mainWindow, targetId, 'DISPLAYING', visualInfo);
              // Briefly show interim animation then return to ready
              setTimeout(() => {
                  if (targetStates.has(targetId)) {
                      // Re-apply the original 'ON' visual
                      const originalConfig = state.hitConfigs.get(state.activeHitConfigId);
                      const originalVisualInfo = originalConfig ? parseVisualScript(originalConfig.onVisual) : null;
                      updateTargetState(mainWindow, targetId, 'READY', originalVisualInfo);
                  }
              }, duration);
          } else {
            // If no interim animation, just update the hit count in the UI
            updateTargetState(mainWindow, targetId, 'READY', state.visualInfo);
          }
      }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    sockets.forEach(socket => socket.destroy());
    app.quit();
  }
});

function updateTargetState(win, targetId, newState, visualInfo) {
    const state = targetStates.get(targetId);
    if (!state) return;

    // Use provided visual info, otherwise keep the existing one if the state is READY
    const newVisualInfo = visualInfo !== undefined ? visualInfo : (newState === 'READY' ? state.visualInfo : null);

    // Clear any pending timeouts if the state is changing
    if (state.expireTimeout) {
        clearTimeout(state.expireTimeout);
        state.expireTimeout = null;
    }

    state.currentState = newState;
    state.visualInfo = newVisualInfo;

    if (win && !win.isDestroyed()) {
        const payload = {
            targetId,
            state: {
                currentState: state.currentState,
                visualInfo: state.visualInfo,
                hitCount: state.hitCount,
                hitsRequired: state.hitsRequired
            }
        };
        win.webContents.send('target-state-change', payload);
    }
}

function parseVisualScript(scriptString) {
    if (!scriptString) return null;

    const firstStep = scriptString.split('|')[0].trim();
    if (!firstStep) return null;

    const parts = firstStep.split(' ');
    const type = parts[1]; // SOLID or ANIM
    let name = '';
    let color = { r: 0, g: 0, b: 0 };

    if (type === 'SOLID') {
        name = 'Solid';
        color = { r: parseInt(parts[2]), g: parseInt(parts[3]), b: parseInt(parts[4]) };
    } else if (type === 'ANIM') {
        name = parts[2];
        color = { r: parseInt(parts[3]), g: parseInt(parts[4]), b: parseInt(parts[5]) };
    }

    return { name, color };
}

function calculateScriptDuration(scriptString) {
    if (!scriptString) return 0;

    return scriptString.split('|').reduce((totalDuration, step) => {
        const trimmedStep = step.trim();
        if (trimmedStep) {
            const durationStr = trimmedStep.split(' ')[0];
            const duration = parseInt(durationStr, 10);
            if (!isNaN(duration)) {
                return totalDuration + duration;
            }
        }
        return totalDuration;
    }, 0);
}

function handleServerCommand(win, targetId, command) {
    logToTargetUI(win, targetId, 'SERVER ->', command);
    const parts = command.split(' ');
    const cmdType = parts[0];
    const state = targetStates.get(targetId);

    if (!state) return;

    switch (cmdType) {
        case 'CONFIG_HIT': {
            // CONFIG_HIT <id> <hitsRequired> <healthBarMode> <visual_script>
            const configId = parts[1];
            state.hitConfigs.set(configId, {
                hitsRequired: parseInt(parts[2], 10),
                visualScript: parts.slice(4).join(' ')
            });
            break;
        }

        case 'CONFIG_INTERIM_HIT': {
            // CONFIG_INTERIM_HIT <id> <visual_script>
            const configId = parts[1];
            state.interimHitConfigs.set(configId, {
                visualScript: parts.slice(2).join(' ')
            });
            break;
        }

        case 'CONFIG_THRESHOLD': {
            if (parts.length === 1) { // Auto-calibration case
                const socket = sockets.get(targetId);
                if (socket) {
                    const calibMsg = 'LOG: Auto-calibration complete. Max noise: 100, New threshold: 2000\n';
                    logToTargetUI(win, targetId, 'CLIENT ->', calibMsg);
                    socket.write(calibMsg);
                }
            }
            // If a threshold value is provided, we don't need to do anything.
            break;
        }

        case 'ON': {
            // ON <timeoutMs> <value> <hitConfigId> <visual_script>
            const timeoutMs = parseInt(parts[1], 10);
            const hitConfigId = parts[3];
            const config = state.hitConfigs.get(hitConfigId) || { hitsRequired: 1 };

            state.value = parts[2];
            state.activeHitConfigId = hitConfigId;
            state.activateTime = Date.now();
            state.hitCount = 0;
            state.hitsRequired = config.hitsRequired;
            
            const onVisualScript = parts.slice(4).join(' ');
            const visualInfo = parseVisualScript(onVisualScript);
            config.onVisual = onVisualScript; // Store for later
            state.hitConfigs.set(hitConfigId, config);

            updateTargetState(win, targetId, 'READY', visualInfo);

            if (timeoutMs > 0) {
                state.expireTimeout = setTimeout(() => {
                    const socket = sockets.get(targetId);
                    if (socket && state.currentState === 'READY') {
                        const expiredMsg = `EXPIRED ${state.value}\n`;
                        logToTargetUI(win, targetId, 'CLIENT ->', expiredMsg);
                        socket.write(expiredMsg);
                        updateTargetState(win, targetId, 'IDLE');
                    }
                }, timeoutMs);
            }
            break;
        }

        case 'OFF':
            updateTargetState(win, targetId, 'IDLE');
            break;

        case 'DISPLAY': {
            const visualScript = parts.slice(2).join(' ');
            const visualInfo = parseVisualScript(visualScript);
            const duration = calculateScriptDuration(visualScript);
            updateTargetState(win, targetId, 'DISPLAYING', visualInfo);

            setTimeout(() => {
                if(state.currentState === 'DISPLAYING') {
                    updateTargetState(win, targetId, 'IDLE');
                }
            }, duration);
            break;
        }
        
        case 'PING': {
            const socket = sockets.get(targetId);
            if (socket) {
                const pongMsg = 'PONG\n';
                logToTargetUI(win, targetId, 'CLIENT ->', pongMsg);
                socket.write(pongMsg);
            }
            break;
        }
    }
}