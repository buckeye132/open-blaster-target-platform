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
require('dotenv').config();



// Import custom classes
const { Target, VisualScriptBuilder, Animations } = require('./target');
let Message, MessageType;
import('./src/games/protocol.mjs').then(protocol => {
    Message = protocol.Message;
    MessageType = protocol.MessageType;
});

// --- Configuration ---
const WEB_PORT = 8080;
const TCP_PORT = 8888;

// --- State Variables ---
let connectedTargets = new Map(); // Use a Map to store targets by their ID
let webClients = new Set();
let activeGame = null;
let isCommentatorActiveForCurrentGame = false;

// --- AI Commentator Setup ---
let commentator = null;
if (process.env.GEMINI_API_KEY) {
    try {
        const Commentator = require('./ai/commentator');
        commentator = new Commentator();
        console.log('LOG: AI Commentator enabled.');
    } catch (error) {
        console.error('ERROR: Failed to load AI Commentator. Is @google/generative-ai installed?', error);
        commentator = null;
    }
}

// --- Game Registry ---
const gameModes = require('./src/games');
console.log('LOG: All game modes loaded.');

// --- Helper Functions ---
function broadcastToWeb(message) {
    const jsonMessage = JSON.stringify(message);
    for (const client of webClients) {
        client.send(jsonMessage);
    }
}

function broadcastTargetList() {
    const targetList = Array.from(connectedTargets.keys());
    broadcastToWeb(Message.targetListUpdate(targetList));
}

function registerTarget(socket, socketId) {
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
        } else {
            // If no game is active, just log it to the web UI for diagnostics
            console.log(`LOG: Hit registered for ${target.id} outside of a game.`);
            const logMessage = `HIT received! Reaction: ${reactionTime}ms, Value: ${value}`;
            broadcastToWeb(Message.targetLogMessage(target.id, logMessage));
        }
    });

    target.on('expired', ({ value }) => {
        if (activeGame) {
            activeGame.onExpired(target, value);
        }
    });

    target.on('log', (message) => {
        broadcastToWeb(Message.targetLogMessage(target.id, message));
    });

    target.on('close', () => {
        console.log(`LOG: Target Disconnected: ${socket.id}`);
        connectedTargets.delete(socketId);
        broadcastTargetList();
    });

    target.on('error', (err) => {
        console.error(`Socket Error from ${socket.id}:`, err.message);
    });
}

// --- TCP Server (for the ESP32 target) ---
const tcpServer = net.createServer((socket) => {
    const remoteIp = socket.remoteAddress.includes('::ffff:') ? socket.remoteAddress.slice(7) : socket.remoteAddress;
    const isLocal = remoteIp === '127.0.0.1' || remoteIp === '::1';

    if (isLocal) {
        // Handle simulated target handshake
        const handshakeTimeout = setTimeout(() => {
            console.log('LOG: Local client failed to send handshake, disconnecting.');
            socket.destroy();
        }, 2000); // 2-second timeout for handshake

        socket.once('data', (data) => {
            clearTimeout(handshakeTimeout);
            const message = data.toString();
            if (message.startsWith('ID_SIMULATED:')) {
                const socketId = message.split(':')[1].trim();
                if (socketId) {
                    registerTarget(socket, socketId);
                    // Manually emit the rest of the data for the new target instance to process
                    const remainingData = message.substring(message.indexOf('\n') + 1);
                    if (remainingData) {
                        socket.emit('data', remainingData);
                    }
                } else {
                    console.log('LOG: Local client sent empty ID, disconnecting.');
                    socket.destroy();
                }
            } else {
                console.log('LOG: Local client sent invalid handshake, disconnecting.');
                socket.destroy();
            }
        });
    } else {
        // Handle real hardware target
        registerTarget(socket, remoteIp);
    }
});

// --- Web Server (for the UI) ---
const webServer = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let page = parsedUrl.pathname;
    let rootDir = '';

    // API Endpoints
    if (parsedUrl.pathname === '/games/options') {
        const allOptions = {};
        for (const gameId in gameModes) {
            const gameClass = gameModes[gameId];
            if (typeof gameClass.getOptions === 'function') {
                allOptions[gameId] = gameClass.getOptions();
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(allOptions));
        return;
    }

    if (parsedUrl.pathname === '/games/list') {
        const gameList = Object.keys(gameModes);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(gameList));
        return;
    }

    // Route requests to the correct directory
    if (page.startsWith('/games/')) { // New game assets (whack_a_mole.html, etc.)
        rootDir = path.join(__dirname, 'public');
    } else if (page === '/lobby' || page === '/game' || page === '/style.css' || page === '/lobby_client.mjs' || page === '/game_client.mjs' || page === '/protocol.mjs') {
        rootDir = path.join(__dirname, 'src', 'games');
        if (page === '/lobby') page = '/lobby.html';
        if (page === '/game') page = '/game.html';
    } else { // Legacy pages and assets
        rootDir = path.join(__dirname, 'assets');
        if (page === '/') page = '/index.html';
        if (page === '/diagnostics') page = '/diagnostics.html';
    }

    const filePath = path.join(rootDir, page);

    // Security check to prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'public')) && !filePath.startsWith(path.join(__dirname, 'src', 'games')) && !filePath.startsWith(path.join(__dirname, 'assets'))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
        case '.mjs':
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
        handleWebMessage(ws, data);
    });

    ws.on('close', () => {
        console.log('LOG: Web UI client disconnected.');
        webClients.delete(ws);
    });
});

function handleWebMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
        case MessageType.C2S_START_GAME:
            handleStartGame(payload);
            break;
        case MessageType.C2S_STOP_GAME:
            handleStopGame();
            break;
        case MessageType.C2S_GET_AI_AVAILABILITY:
            ws.send(JSON.stringify(Message.aiAvailability(commentator !== null)));
            break;
        case MessageType.C2S_TARGET_COMMAND:
            handleTargetCommand(payload);
            break;
        default:
            console.log(`WARN: Unknown message type: ${type}`);
    }
}

function handleStartGame(payload) {
    if (activeGame) {
        console.log("WARN: A game is already in progress.");
        return;
    }

    const { gameMode, options, aiCommentary } = payload;
    const GameClass = gameModes[gameMode];
    if (GameClass) {
        const targets = Array.from(connectedTargets.values());
        activeGame = new GameClass(webClients, targets, options || {});

        if (commentator && aiCommentary) {
            isCommentatorActiveForCurrentGame = true;
            activeGame.on('hit', (target, hitData) => commentator.onHit(hitData));
            activeGame.on('miss', () => commentator.onMiss());
            activeGame.on('timeUpdate', (timeLeft) => commentator.onTimeUpdate(timeLeft));
            activeGame.on('gameOver', (finalScore) => commentator.onGameOver(finalScore));
            activeGame.on('customEvent', (event) => commentator.onCustomEvent(event));
            commentator.start(gameMode, options || {});
        } else {
            isCommentatorActiveForCurrentGame = false;
        }

        activeGame.setupAndStart();

        activeGame.on('gameOver', () => {
            if (commentator && isCommentatorActiveForCurrentGame) {
                commentator.once('commentaryComplete', () => {
                    activeGame = null;
                    isCommentatorActiveForCurrentGame = false;
                });
            } else {
                activeGame = null;
                isCommentatorActiveForCurrentGame = false;
            }
        });
    } else {
        console.log(`WARN: Unknown game mode: ${gameMode}`);
    }
}

function handleStopGame() {
    if (activeGame) {
        activeGame.stop();
        activeGame = null;
        console.log("LOG: Game stopped by user request.");
    } else {
        console.log("WARN: No active game to stop.");
    }
}

function handleTargetCommand(payload) {
    const { targetId, command, options } = payload;
    const target = connectedTargets.get(targetId);
    if (!target) {
        console.log(`WARN: Target not found: ${targetId}`);
        return;
    }

    switch (command) {
        case 'test-leds':
            target.display(1, new VisualScriptBuilder().solid(250, 255, 255, 255).solid(250, 0, 0, 0).solid(250, 255, 255, 255).solid(250, 0, 0, 0));
            break;
        case 'calibrate-piezo':
            target.configureThreshold(null);
            break;
        case 'test-hit':
            target.configureHit('lobby_test', 1, 'NONE', new VisualScriptBuilder().solid(500, 0, 255, 0));
            target.activate(5000, 'test_hit', 'lobby_test', new VisualScriptBuilder().animation(1000, Animations.PULSE, 255, 165, 0));
            break;
        case 'status-request':
            target._sendCommand('STATUS_REQUEST');
            break;
        default:
            console.log(`WARN: Unknown target command: ${command}`);
    }
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