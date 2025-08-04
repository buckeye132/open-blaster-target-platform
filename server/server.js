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

// Import necessary Node.js modules
const net = require('net');
const http = require('http');
const os = require('os');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Import custom classes
const Target = require('./target');
const PrecisionChallenge = require('./games/precision_challenge');
const WhackAMole = require('./games/whack_a_mole');
const QuickDraw = require('./games/quick_draw');

// --- Configuration ---
const WEB_PORT = 8080;
const TCP_PORT = 8888;

// --- State Variables ---
let connectedTargets = new Map(); // Use a Map to store targets by their ID
let webClients = new Set();
let activeGame = null;

// --- Game Registry ---
const gameModes = {
    'precision_challenge': PrecisionChallenge,
    'whack_a_mole': WhackAMole,
    'quick_draw': QuickDraw,
};

// --- Helper Functions ---
function broadcastToWeb(type, payload) {
    const message = JSON.stringify({ type, payload });
    for (const client of webClients) {
        client.send(message);
    }
}

function broadcastTargetList() {
    const targetList = Array.from(connectedTargets.keys());
    broadcastToWeb('TARGET_LIST', targetList);
}

// --- TCP Server (for the ESP32 target) ---
const tcpServer = net.createServer((socket) => {
    let socketId = socket.remoteAddress;
    if (socketId.startsWith('::ffff:')) {
        socketId = socketId.slice(7);
    }
    socket.id = socketId;
    socket.setKeepAlive(true, 3000);

    if (connectedTargets.has(socketId)) {
        console.log(`LOG: Target Reconnected: ${socketId}. Replacing old socket.`);
        connectedTargets.get(socketId).socket.destroy();
    }
    console.log(`LOG: Target Connected: ${socketId}`);

    const target = new Target(socket);
    connectedTargets.set(socketId, target);
    broadcastTargetList();

    // --- Event Handling for the new Target object ---

    target.on('hit', ({ reactionTime, value }) => {
        if (activeGame) {
            // Pass the reaction time along with the value
            activeGame.onHit(target, { reactionTime, value });
        }
    });

    target.on('expired', ({ value }) => {
        if (activeGame) {
            activeGame.onExpired(target, value);
        }
    });

    target.on('log', (message) => {
        broadcastToWeb('LOG_MESSAGE', { from: target.id, message });
    });

    target.on('close', () => {
        console.log(`LOG: Target Disconnected: ${socket.id}`);
        connectedTargets.delete(socketId);
        broadcastTargetList();
    });

    target.on('error', (err) => {
        console.error(`Socket Error from ${socket.id}:`, err.message);
    });
});

// --- Web Server (for the UI) ---
const webServer = http.createServer((req, res) => {
    let page;
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    switch (parsedUrl.pathname) {
        case '/':
            page = 'index.html';
            break;
        case '/lobby':
            page = 'lobby.html';
            break;
        case '/game':
            page = 'game.html';
            break;
        case '/diagnostics':
            page = 'diagnostics.html';
            break;
        // Add other game pages here as they are refactored
        default:
            page = parsedUrl.pathname.substring(1);
            break;
    }

    const filePath = path.join(__dirname, 'assets', page);

    // Security check to prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'assets'))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// --- WebSocket Server (for UI communication) ---
const wss = new WebSocket.Server({ server: webServer });
wss.on('connection', (ws) => {
    console.log('LOG: Web UI client connected.');
    webClients.add(ws);
    broadcastTargetList();

    ws.on('message', (message) => {
        const data = JSON.parse(message.toString());
        handleWebMessage(data);
    });

    ws.on('close', () => {
        console.log('LOG: Web UI client disconnected.');
        webClients.delete(ws);
    });
});

function handleWebMessage(data) {
    if (data.command === 'start-game') {
        if (activeGame) {
            console.log("WARN: A game is already in progress.");
            return;
        }
        const GameClass = gameModes[data.gameMode];
        if (GameClass) {
            const targets = Array.from(connectedTargets.values());
            activeGame = new GameClass(webClients, targets, data.options || {});
            activeGame.setupAndStart(); // This now handles the entire setup and game start

            // Listen for the game to end to clean up
            activeGame.on('gameOver', () => {
                console.log("LOG: Game has ended.");
                activeGame = null;
            });
        } else {
            console.log(`WARN: Unknown game mode: ${data.gameMode}`);
        }
    } else if (data.command === 'stop-game') {
        if (activeGame) {
            activeGame.stop();
            activeGame = null;
            console.log("LOG: Game stopped by user request.");
        } else {
            console.log("WARN: No active game to stop.");
        }
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.configureThreshold();
        }
    } else if (data.command === 'test-leds') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.display(1, '250 SOLID 255 255 255 | 250 SOLID 0 0 0 | 250 SOLID 255 255 255 | 250 SOLID 0 0 0');
        }
    } else if (data.command === 'calibrate-piezo') {
      const target = connectedTargets.get(data.targetId);
        if (target) {
          target.configureThreshold(null);
        }
    } else if (data.command === 'test-hit') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.configureHit('lobby_test', 1, 'NONE', '500 SOLID 0 255 0');
            target.activate(5000, 'test_hit', 'lobby_test', '1000 ANIM PULSE 255 165 0');
        }
    } else if (data.command === 'display') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.display(data.loopCount, data.visualScript);
        }
    } else if (data.command === 'config-hit') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.configureHit(data.id, data.hits, data.healthBar, data.script);
        }
    } else if (data.command === 'config-interim-hit') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.configureInterimHit(data.id, data.script);
        }
    } else if (data.command === 'on') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.activate(data.timeout, data.value, data.hitId, data.script);
        }
    } else if (data.command === 'off') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.off();
        }
    } else if (data.command === 'status-request') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target._sendCommand('STATUS_REQUEST');
        }
    } else if (data.command === 'display') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.display(data.loopCount, data.visualScript);
        }
    } else if (data.command === 'config-hit') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.configureHit(data.id, data.hits, data.healthBar, data.script);
        }
    } else if (data.command === 'config-interim-hit') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.configureInterimHit(data.id, data.script);
        }
    } else if (data.command === 'on') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.activate(data.timeout, data.value, data.hitId, data.script);
        }
    } else if (data.command === 'off') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            target.off();
        }
    } else if (data.command === 'status-request') {
        const target = connectedTargets.get(data.targetId);
        if (target) {
            // The Target class doesn't have a status_request method yet.
            // For now, we can send the raw command.
            target._sendCommand('STATUS_REQUEST');
        }
    }
    // Handle other commands like ping tests if needed
}

// --- Start the Servers ---
tcpServer.listen(TCP_PORT, () => {
    console.log(`TCP server listening for targets on port ${TCP_PORT}`);
});

webServer.listen(WEB_PORT, () => {
    const interfaces = os.networkInterfaces();
    let ipAddress = 'localhost';
    for (const ifaceName of Object.keys(interfaces)) {
        for (const iface of interfaces[ifaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ipAddress = iface.address;
                break;
            }
        }
    }
    console.log(`Web UI running at http://${ipAddress}:${WEB_PORT}`);
});