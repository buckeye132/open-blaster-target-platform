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
const net = require('net');       // For TCP communication with targets
const http = require('http');     // For the web UI
const os = require('os');         // To get local IP address
const WebSocket = require('ws');  // For real-time web UI updates
const fs = require('fs');         // To read files
const path = require('path');     // To handle file paths

// --- Configuration ---
const WEB_PORT = 8080; // Port for the web interface
const TCP_PORT = 8888; // Port for the ESP32 targets to connect to

// --- State Variables ---
let connectedTargets = []; // This will hold all connected target sockets
let webClients = new Set(); // Set to hold all connected web UI clients

// --- Helper Functions ---
function broadcastToWeb(type, payload) {
  const message = JSON.stringify({ type, payload });
  for (const client of webClients) {
    client.send(message);
  }
}

function broadcastTargetList() {
    const targetList = connectedTargets.map(socket => socket.id);
    broadcastToWeb('TARGET_LIST', targetList);
}

// --- TCP Server (for the ESP32 target) ---
const tcpServer = net.createServer((socket) => {
  let socketId = socket.remoteAddress; // Get the raw address
  // Clean up IPv6-mapped IPv4 addresses
  if (socketId.startsWith('::ffff:')) {
    socketId = socketId.slice(7);
  }
  socket.id = socketId; // Use the cleaned IP as the unique ID
  socket.setKeepAlive(true, 3000);

  // If a socket with the same IP already exists, remove it.
  const oldSocketIndex = connectedTargets.findIndex(s => s.id === socketId);
  if (oldSocketIndex !== -1) {
    console.log(`LOG: Target Reconnected: ${socketId}. Replacing old socket.`);
    connectedTargets.splice(oldSocketIndex, 1);
  } else {
    console.log(`LOG: Target Connected: ${socketId}`);
  }
  
  connectedTargets.push(socket);
  broadcastTargetList();

  let inputBuffer = '';
  // Handle incoming data from the target
  socket.on('data', (data) => {
    inputBuffer += data.toString();
    let newlineIndex;
    // Process all complete commands in the buffer
    while ((newlineIndex = inputBuffer.indexOf('\n')) !== -1) {
        const message = inputBuffer.substring(0, newlineIndex).trim();
        inputBuffer = inputBuffer.substring(newlineIndex + 1);
        if (message) {
            console.log(`LOG: Received from ${socket.id}: ${message}`);
            if (message === 'PONG') {
              // Handle single pings
              if (socket.pingId) {
                console.log(`LOG: Pong received from ${socket.id}`);
                broadcastToWeb('PING_RESULT', { targetId: socket.id, status: 'ok' });
                delete socket.pingId;
              }
              // Handle ping test pongs
              const test = pingTests[socket.id];
              if (test && socket.pingStartTime) {
                clearTimeout(test.timeout); // Clear the timeout for this specific ping
                const latency = Date.now() - socket.pingStartTime;
                test.latencies.push(latency);
                test.remaining--;
                broadcastToWeb('PING_TEST_UPDATE', { targetId: socket.id, status: 'pong', latency: latency, remaining: test.remaining });
                delete socket.pingStartTime;
                // Send the next ping after a short delay
                setTimeout(() => sendSinglePingForTest(socket.id), 100);
              }
            } else if (message.startsWith('HIT')) {
              if (activeGame) {
                const parts = message.split(' '); // HIT <reaction_ms> <value>
                const value = parts.length > 2 ? parts[2] : '';
                activeGame.handleHit(socket, value);
              }
            } else if (message.startsWith('EXPIRED')) { // Corrected from TIMEOUT
              if (activeGame) {
                const parts = message.split(' '); // EXPIRED <value>
                const value = parts.length > 1 ? parts[1] : '';
                activeGame.handleExpired(socket, value); // Renamed from handleMiss
              }
            } else {
              broadcastToWeb('LOG_MESSAGE', { from: socket.id, message: message });
            }
        }
    }
  });

  // Handle disconnection
  socket.on('close', (hadError) => {
    console.log(`LOG: Target Disconnected: ${socket.id} (Error: ${hadError})`);
    // Remove this specific socket instance from the array
    const index = connectedTargets.indexOf(socket);
    if (index > -1) {
        connectedTargets.splice(index, 1);
    }
    broadcastTargetList();
  });

  socket.on('error', (err) => {
    console.error(`Socket Error from ${socket.id}:`, err.message);
    // The 'close' event will be called automatically after an error, so we don't need to clean up here.
  });
});


// --- Web Server (for the UI) ---
const webServer = http.createServer((req, res) => {
  let page = req.url === '/' ? 'index.html' : req.url;
  if (req.url === '/diagnostics') {
    page = 'diagnostics.html';
  } else if (req.url === '/lobby') {
    page = 'lobby.html';
  } else if (req.url === '/quick_draw') {
    page = 'quick_draw.html';
  } else if (req.url === '/whack_a_mole') {
    page = 'whack_a_mole.html';
  } else if (req.url === '/precision_challenge') {
    page = 'precision_challenge.html';
  }

  let filePath = path.join(__dirname, 'assets', page);

  // Disallow directory traversal
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
        res.end('Sorry, check with the site admin for error: ' + err.code + ' ..');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// --- Ping Test Functions ---
let pingTests = {}; // Store state of ongoing ping tests

function runPingTest(target, count, withDebug) {
  const targetId = target.id;
  if (pingTests[targetId]) {
    console.log(`LOG: Ping test already in progress for ${targetId}.`);
    return;
  }

  pingTests[targetId] = {
    latencies: [],
    timeouts: 0,
    remaining: count,
    target: target,
    withDebug: withDebug,
  };

  broadcastToWeb('PING_TEST_UPDATE', { targetId, status: 'starting', total: count });
  console.log(`LOG: Starting ping test for ${targetId} with ${count} pings (Debug: ${withDebug}).`);
  
  if (withDebug) {
    target.write('TIMING_DEBUG\n');
    setTimeout(() => sendSinglePingForTest(targetId), 200);
  } else {
    sendSinglePingForTest(targetId);
  }
}

function sendSinglePingForTest(targetId) {
  const test = pingTests[targetId];
  if (!test || test.remaining <= 0) {
    finishPingTest(targetId);
    return;
  }

  const target = test.target;
  // Ensure target is still connected
  if (!connectedTargets.includes(target)) {
      console.log(`LOG: Target ${targetId} disconnected during ping test.`);
      broadcastToWeb('PING_TEST_UPDATE', { targetId, status: 'error', message: 'Target disconnected' });
      delete pingTests[targetId];
      return;
  }

  target.pingStartTime = Date.now();
  target.write('PING\n');

  test.timeout = setTimeout(() => {
    console.log(`LOG: Ping to ${targetId} timed out during test.`);
    test.timeouts++;
    test.remaining--;
    broadcastToWeb('PING_TEST_UPDATE', { targetId, status: 'timeout', remaining: test.remaining });
    delete target.pingStartTime;
    sendSinglePingForTest(targetId); // Send next ping
  }, 2000);
}

function finishPingTest(targetId) {
  const test = pingTests[targetId];
  if (!test) return;

  const { latencies, timeouts } = test;
  const totalPings = latencies.length + timeouts;

  let results = {
    targetId,
    total: totalPings,
    successful: latencies.length,
    timeouts,
    min: latencies.length > 0 ? Math.min(...latencies) : 0,
    max: latencies.length > 0 ? Math.max(...latencies) : 0,
    avg: latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : 0,
  };

  console.log(`LOG: Ping test for ${targetId} finished.`);
  broadcastToWeb('PING_TEST_RESULT', results);
  
  // Disable timing debug on the target if it was enabled for the test
  if (test.withDebug && test.target && connectedTargets.includes(test.target)) {
      test.target.write('TIMING_DEBUG\n');
  }

  delete pingTests[targetId];
}


// --- Start the Servers ---
let activeGame = null;

function startGame(gameMode, clients) {
    if (activeGame) {
        console.log("LOG: A game is already in progress.");
        return;
    }

    switch (gameMode) {
        case 'precision_challenge':
            activeGame = new PrecisionChallenge(clients);
            break;
        // Add other game modes here
        default:
            console.log(`WARN: Unknown game mode: ${gameMode}`);
            return;
    }
    activeGame.start();
}

class PrecisionChallenge {
    constructor(clients) {
        this.clients = clients;
        this.score = 0;
        this.timeLeft = 90;
        this.targetTimeout = 3000;
        this.consecutiveFastHits = 0;
        this.hitFlurryActive = false;
        this.gameInterval = null;
        this.activeTargets = new Map(); // Using a Map to track targets and their state
    }

    start() {
        console.log("LOG: Starting Precision Challenge");
        this.broadcast('gameStart', { timeLeft: this.timeLeft });

        // Pre-configure all connected targets for the game
        connectedTargets.forEach(target => {
            // Positive Target Configuration
            target.write('CONFIG_HIT positive 1 NONE 500 SOLID 0 255 0\n');
            // Negative Target Configuration
            target.write('CONFIG_HIT negative 1 NONE 500 SOLID 255 0 0\n');
            // Hit Flurry Target Configuration
            target.write('CONFIG_HIT flurry_hit 3 DECREMENTAL 1000 ANIM THEATER_CHASE 0 0 255\n');
            target.write('CONFIG_INTERIM_HIT flurry_hit 150 SOLID 255 255 255\n');
        });

        this.gameInterval = setInterval(() => this.tick(), 1000);
        this.activateRandomTarget();
    }

    tick() {
        if (this.hitFlurryActive) return; // Pause timer during flurry

        this.timeLeft--;
        this.broadcast('updateTimer', { timeLeft: this.timeLeft });

        if (this.timeLeft <= 0) {
            this.endGame();
        }
    }

    activateRandomTarget() {
        if (this.hitFlurryActive || connectedTargets.length === 0) return;

        // Clear any previous target
        if (this.activeTargets.size > 0) {
            const [target] = this.activeTargets.keys();
            target.write('OFF\n');
            this.activeTargets.delete(target);
        }

        const target = connectedTargets[Math.floor(Math.random() * connectedTargets.length)];
        const isNegative = Math.random() < 0.2;
        const value = isNegative ? 'negative' : 'positive';
        const hitConfigId = isNegative ? 'negative' : 'positive';
        const visualScript = isNegative ? '1000 SOLID 255 0 0' : '1000 SOLID 0 255 0';

        target.write(`ON ${this.targetTimeout} ${value} ${hitConfigId} ${visualScript}\n`);
        this.activeTargets.set(target, { value, activationTime: Date.now() });
    }

    handleHit(target, value) {
        if (!this.activeTargets.has(target)) return; // Ignore hits on non-active targets

        const { activationTime } = this.activeTargets.get(target);
        const reactionTime = Date.now() - activationTime;

        if (this.hitFlurryActive) {
            // In a flurry, any hit is a good hit
            this.score += 1000; // Bonus for flurry hits
            // Check if all flurry targets are done
            const flurryTargets = Array.from(this.activeTargets.keys());
            const allDone = flurryTargets.every(t => !this.activeTargets.has(t)); // This logic needs refinement
            if (allDone) {
                this.endHitFlurry();
            }
        } else {
            if (value === 'positive') {
                const points = Math.max(100, 1500 - reactionTime); // Higher potential score
                this.score += points;
                this.targetTimeout = Math.max(500, this.targetTimeout - (reactionTime < 800 ? 150 : -200));
                this.consecutiveFastHits = reactionTime < 800 ? this.consecutiveFastHits + 1 : 0;
            } else if (value === 'negative') {
                this.score -= 500;
                this.targetTimeout += 500;
                this.consecutiveFastHits = 0;
            }

            if (this.consecutiveFastHits >= 5) {
                this.triggerHitFlurry();
            } else {
                this.activateRandomTarget();
            }
        }
        this.broadcast('updateScore', { score: this.score });
    }

    handleExpired(target, value) {
        if (!this.activeTargets.has(target)) return; // Ignore expired events from non-active targets

        if (this.hitFlurryActive) return; // In a flurry, we don't care about timeouts

        const { value: targetValue } = this.activeTargets.get(target);

        if (targetValue === 'positive') {
            // This was a missed positive target
            this.targetTimeout += 1000; // Slow down dramatically
            this.consecutiveFastHits = 0;
        } else if (targetValue === 'negative') {
            // This was a correctly ignored negative target
            this.score += 100; // Patience bonus
        }

        this.broadcast('updateScore', { score: this.score });
        this.activateRandomTarget(); // Move to the next target
    }

    triggerHitFlurry() {
        console.log("LOG: Triggering Hit Flurry!");
        this.hitFlurryActive = true;
        this.consecutiveFastHits = 0;
        this.broadcast('hitFlurryStart');

        // Turn off the single target
        if (this.activeTargets.size > 0) {
            const [target] = this.activeTargets.keys();
            target.write('OFF\n');
            this.activeTargets.delete(target);
        }

        const targetsToArm = connectedTargets.slice(0, Math.min(connectedTargets.length, 4));
        targetsToArm.forEach(target => {
            target.write('ON 15000 flurry_hit flurry_hit 1000 ANIM PULSE 0 0 255\n');
            this.activeTargets.set(target, { value: 'flurry_hit', activationTime: Date.now() });
        });

        // Set a timeout to end the flurry
        setTimeout(() => this.endHitFlurry(), 15000);
    }

    endHitFlurry() {
        if (!this.hitFlurryActive) return;
        console.log("LOG: Ending Hit Flurry.");
        this.hitFlurryActive = false;

        this.activeTargets.forEach((_state, target) => {
            target.write('OFF\n');
        });
        this.activeTargets.clear();

        this.broadcast('hitFlurryEnd');
        this.activateRandomTarget();
    }

    endGame() {
        console.log("LOG: Game Over");
        clearInterval(this.gameInterval);
        this.activeTargets.forEach((_state, target) => {
            target.write('OFF\n');
        });
        this.activeTargets.clear();
        this.broadcast('gameOver', { finalScore: this.score });
        activeGame = null;
    }

    broadcast(type, payload) {
        const message = JSON.stringify({ type, payload });
        for (const client of this.clients) {
            client.send(message);
        }
    }
}


// --- Start the Servers ---
const wss = new WebSocket.Server({ server: webServer });
wss.on('connection', (ws) => {
  console.log('LOG: Web UI client connected.');
  webClients.add(ws);

  broadcastTargetList(); // Send the current list of targets to the new web client

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    const target = connectedTargets.find(s => s.id === data.targetId);

    if (data.command === 'ping') {
      if (target) {
        const pingId = `${data.targetId}-${Date.now()}`;
        target.pingId = pingId; // Attach a unique ID for this ping

        console.log(`LOG: Pinging target ${data.targetId}...`);
        target.write('PING\n');

        // Set a timeout for the pong response
        setTimeout(() => {
          if (target.pingId === pingId) { // If the ping ID is still the same, it timed out
            console.log(`LOG: Ping to ${data.targetId} timed out.`);
            broadcastToWeb('PING_RESULT', { targetId: data.targetId, status: 'timeout' });
          }
        }, 2000); // 2-second timeout
      } else {
        console.log(`WARN: Target ${data.targetId} not found for ping.`);
      }
      return;
    }

    if (data.command === 'run-ping-test') {
      if (target) {
        runPingTest(target, data.count || 10, data.withDebug || false);
      } else {
        console.log(`WARN: Target ${data.targetId} not found for ping test.`);
      }
      return;
    }

    if (data.command === 'start-game') {
      startGame(data.gameMode, webClients);
      return;
    }

    if (data.command === 'calibrate-piezo') {
      if (target) {
        console.log(`LOG: Sending auto-calibration command to ${data.targetId}`);
        target.write('CONFIG_THRESHOLD\n');
      } else {
        console.log(`WARN: Target ${data.targetId} not found for calibration.`);
      }
      return;
    }
    
    if (target) {
      const commandToSend = data.command;
      console.log(`LOG: Relaying command to ${data.targetId}: ${commandToSend}`);
      
      // *** FIXED: Send command as a Buffer to ensure a true newline character ***
      const commandWithNewline = Buffer.from(commandToSend + '\n');
      target.write(commandWithNewline);

    } else {
      console.log(`WARN: Target ${data.targetId} not found. Cannot send command.`);
    }
  });

  ws.on('close', () => {
    console.log('LOG: Web UI client disconnected.');
    webClients.delete(ws);
  });
});

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
