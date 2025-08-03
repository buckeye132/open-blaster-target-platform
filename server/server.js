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
