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
import('./assets/protocol.mjs').then(protocol => {
    Message = protocol.Message;
    MessageType = protocol.MessageType;
});
const PrecisionChallenge = require('./games/precision_challenge');
const WhackAMole = require('./games/whack_a_mole');
const QuickDraw = require('./games/quick_draw');
const Demo = require('./games/demo');
const SimonSays = require('./games/simon_says');
const DistractionAlley = require('./games/distraction_alley');
const TeamColors = require('./games/team_colors');

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
const gameModes = {
    'precision_challenge': PrecisionChallenge,
    'whack_a_mole': WhackAMole,
    'quick_draw': QuickDraw,
    'demo': Demo,
    'simon_says': SimonSays,
    'distraction_alley': DistractionAlley,
    'team_colors': TeamColors
};

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