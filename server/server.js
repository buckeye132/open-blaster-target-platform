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
            broadcastToWeb('LOG_MESSAGE', { from: socket.id, message: message });
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

// --- Start the Servers ---
const wss = new WebSocket.Server({ server: webServer });
wss.on('connection', (ws) => {
  console.log('LOG: Web UI client connected.');
  webClients.add(ws);

  broadcastTargetList(); // Send the current list of targets to the new web client

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    const target = connectedTargets.find(s => s.id === data.targetId);
    
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
