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
const logEl = document.getElementById('log');
const targetSelector = document.getElementById('targetSelector');
const testStatusEl = document.getElementById('test-status');
const startTestBtn = document.getElementById('startTestBtn');

// --- Ping Test State ---
const pingCountInput = document.getElementById('ping-count');
const startPingTestBtn = document.getElementById('startPingTestBtn');
const pingStatusEl = document.getElementById('ping-test-status');
const pingResultsEl = document.getElementById('ping-test-results');
let pingTestInProgress = false;

// --- Test Routine State ---
let testInProgress = false;
let currentTestStep = 0;
let testTargetId = '';
let messageResolver = null;

function sendCommandToServer(targetId, command, ...args) {
  if (!targetId) {
    logEl.innerHTML += '<strong>ERROR: No target selected.</strong><br>';
    return;
  }
  const commandStr = [command, ...args].join(' ').trim();
  ws.send(JSON.stringify({ targetId, command: commandStr }));
  logEl.innerHTML += '<strong>&gt; [' + targetId + '] ' + commandStr + '</strong><br>';
  logEl.scrollTop = logEl.scrollHeight;
}

// Helper functions to grab values and send
const sendCommand = (cmd, ...args) => sendCommandToServer(targetSelector.value, cmd, ...args);
const sendConfigHit = () => sendCommandToServer(targetSelector.value, 'CONFIG_HIT', document.getElementById('hit_id').value, document.getElementById('hits_req').value, document.getElementById('health_bar').value, document.getElementById('hit_script').value);
const sendConfigInterimHit = () => sendCommandToServer(targetSelector.value, 'CONFIG_INTERIM_HIT', document.getElementById('hit_id').value, document.getElementById('hit_script').value);
const sendOn = () => sendCommandToServer(targetSelector.value, 'ON', document.getElementById('on_timeout').value, document.getElementById('on_value').value, document.getElementById('on_hit_id').value, document.getElementById('on_script').value);
const sendDisplay = () => sendCommandToServer(targetSelector.value, 'DISPLAY', document.getElementById('display_loops').value, document.getElementById('display_script').value);

function pingTarget() {
  const targetId = targetSelector.value;
  if (!targetId) {
    logEl.innerHTML += '<strong>ERROR: No target selected.</strong><br>';
    return;
  }
  ws.send(JSON.stringify({ command: 'ping', targetId }));
  logEl.innerHTML += `<strong>&gt; [${targetId}] PING</strong><br>`;
  logEl.scrollTop = logEl.scrollHeight;
}

function calibratePiezo() {
  const targetId = targetSelector.value;
  if (!targetId) {
    logEl.innerHTML += '<strong>ERROR: No target selected.</strong><br>';
    return;
  }
  ws.send(JSON.stringify({ command: 'calibrate-piezo', targetId }));
  logEl.innerHTML += `<strong>&gt; [${targetId}] CALIBRATE_PIEZO</strong><br>`;
  logEl.scrollTop = logEl.scrollHeight;
}

function testAnimation(animName, color) {
    const visualScript = `5000 ANIM ${animName} ${color.replace(/,/g, '')}`;
    sendCommandToServer(targetSelector.value, 'DISPLAY', '1', visualScript);
}

function runPingTest(withDebug = false) {
  const targetId = targetSelector.value;
  if (!targetId || targetSelector.options[targetSelector.selectedIndex].text === 'No Targets Connected') {
    pingStatusEl.innerHTML = '<strong style="color: #ff6b6b;">Please select a target first.</strong>';
    return;
  }
  if (pingTestInProgress) return;

  pingTestInProgress = true;
  startPingTestBtn.disabled = true;
  document.getElementById('startPingTestDebugBtn').disabled = true;
  pingStatusEl.innerHTML = 'Starting test...';
  pingResultsEl.innerHTML = '';

  const count = parseInt(pingCountInput.value, 10) || 20;
  ws.send(JSON.stringify({ command: 'run-ping-test', targetId, count, withDebug }));
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'TARGET_LIST') {
    const currentTarget = targetSelector.value;
    targetSelector.innerHTML = '';
    if (data.payload.length === 0) {
      const option = document.createElement('option');
      option.innerText = 'No Targets Connected';
      targetSelector.appendChild(option);
    } else {
      data.payload.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.innerText = id;
        if (id === currentTarget) {
          option.selected = true;
        }
        targetSelector.appendChild(option);
      });
    }
  } else if (data.type === 'LOG_MESSAGE') {
    const logLine = `&lt; [${data.payload.from}] ${data.payload.message}<br>`;
    logEl.innerHTML += logLine;
    logEl.scrollTop = logEl.scrollHeight;
    // If a test is waiting for a message, resolve its promise
    if (testInProgress && messageResolver) {
      messageResolver(data.payload);
    }
  } else if (data.type === 'PING_RESULT') {
    const { targetId, status } = data.payload;
    let logLine;
    if (status === 'ok') {
      logLine = `&lt; [${targetId}] PONG<br>`;
    } else {
      logLine = `<strong style="color: #ff6b6b;">&lt; [${targetId}] PING TIMEOUT</strong><br>`;
    }
    logEl.innerHTML += logLine;
    logEl.scrollTop = logEl.scrollHeight;
  } else if (data.type === 'PING_TEST_UPDATE') {
    const { targetId, status, remaining, total, latency } = data.payload;
    if (status === 'starting') {
        pingStatusEl.innerHTML = `Test running... 0/${total} pings sent.`;
    } else {
        const sentCount = total - remaining;
        pingStatusEl.innerHTML = `Test running... ${sentCount}/${total} pings sent.`;
        if (status === 'pong') {
            pingResultsEl.innerHTML += `&lt; [${targetId}] PONG (${latency}ms)<br>`;
        } else if (status === 'timeout') {
            pingResultsEl.innerHTML += `<strong style="color: #ff6b6b;">&lt; [${targetId}] TIMEOUT</strong><br>`;
        }
        pingResultsEl.scrollTop = pingResultsEl.scrollHeight;
    }
  } else if (data.type === 'PING_TEST_RESULT') {
      const { targetId, total, successful, timeouts, min, max, avg } = data.payload;
      pingStatusEl.innerHTML = `<strong>Test for ${targetId} complete.</strong>`;
      pingResultsEl.innerHTML += `
        <hr>
        <strong>Results:</strong><br>
        - Sent: ${total}<br>
        - Success: ${successful} (${((successful/total)*100).toFixed(1)}%)<br>
        - Timeouts: ${timeouts}<br>
        - Latency (ms): Min=${min}, Max=${max}, Avg=${avg}
      `;
      pingTestInProgress = false;
      startPingTestBtn.disabled = false;
      document.getElementById('startPingTestDebugBtn').disabled = false;
  }
};

// --- Test Routine Logic ---

function updateTestStatus(html) {
  testStatusEl.innerHTML = html;
}

function waitForMessage(timeout = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      messageResolver = null;
      reject(new Error('Test timed out waiting for a response from the target.'));
    }, timeout);

    messageResolver = (payload) => {
      clearTimeout(timer);
      messageResolver = null;
      resolve(payload);
    };
  });
}

const testSteps = [
  // 1. Test Pre-condition: Ensure target is idle
  async () => {
    updateTestStatus('Step 1/9: Checking initial state...');
    sendCommandToServer(testTargetId, 'STATUS_REQUEST');
    const response = await waitForMessage();
    if (!response.message.startsWith('STATUS_REPORT IDLE')) {
      throw new Error(`Expected initial state to be IDLE, but got: ${response.message}`);
    }
    updateTestStatus('Step 1/9: OK - Target is IDLE.');
  },
  // 2. Test DISPLAY command
  async () => {
    updateTestStatus('Step 2/9: Testing DISPLAY command (Blue pulse for 3s)...');
    sendCommandToServer(testTargetId, 'DISPLAY', '1', '3000 ANIM PULSE 0 0 255');
    await new Promise(r => setTimeout(r, 3200)); // Wait for display to finish
    sendCommandToServer(testTargetId, 'STATUS_REQUEST');
    const response = await waitForMessage();
     if (!response.message.startsWith('STATUS_REPORT IDLE')) {
      throw new Error(`Expected state to be IDLE after DISPLAY, but got: ${response.message}`);
    }
    updateTestStatus('Step 2/9: OK - DISPLAY command finished.');
  },
  // 3. Test CONFIG_THRESHOLD
  async () => {
      updateTestStatus('Step 3/9: Configuring hit sensitivity...');
      sendCommandToServer(testTargetId, 'CONFIG_THRESHOLD', '200');
      updateTestStatus('Step 3/9: OK - Sensitivity configured.');
      await new Promise(r => setTimeout(r, 500)); 
  },
  // 4. Test CONFIG_HIT (Single Hit)
  async () => {
      updateTestStatus('Step 4/9: Configuring single-hit reaction (Green flash)...');
      sendCommandToServer(testTargetId, 'CONFIG_HIT', 'test_single', '1', 'NONE', '500 SOLID 0 255 0');
      updateTestStatus('Step 4/9: OK - Single-hit reaction configured.');
      await new Promise(r => setTimeout(r, 500));
  },
  // 5. Test ON command and successful HIT
  async () => {
    updateTestStatus('Step 5/9: Testing ON command...');
    sendCommandToServer(testTargetId, 'ON', '5000', 'test_hit_1', 'test_single', '1000 ANIM PULSE 255 255 0');
    updateTestStatus('Step 5/9: Target is now ON (Yellow Pulse). <strong class="prompt">Please HIT the target now!</strong>');
    const response = await waitForMessage();
    if (!response.message.startsWith('HIT')) {
      throw new Error(`Expected HIT response, but got: ${response.message}`);
    }
    updateTestStatus('Step 5/9: OK - HIT detected!');
    await new Promise(r => setTimeout(r, 3000)); // Wait for hit animation and target to settle
  },
  // 6. Test EXPIRED message
  async () => {
    updateTestStatus('Step 6/9: Testing target timeout (EXPIRED)...');
    sendCommandToServer(testTargetId, 'ON', '3000', 'test_expired', 'test_single', '1000 ANIM PULSE 255 0 0');
    updateTestStatus('Step 6/9: Target is ON (Red Pulse). <strong class="prompt">DO NOT HIT the target.</strong> Waiting for timeout...');
    const response = await waitForMessage(5000);
    if (!response.message.startsWith('EXPIRED')) {
      throw new Error(`Expected EXPIRED response, but got: ${response.message}`);
    }
    updateTestStatus('Step 6/9: OK - Target correctly sent EXPIRED.');
  },
  // 7. Test Multi-Hit Config
  async () => {
      updateTestStatus('Step 7/9: Configuring multi-hit reaction (3 hits)...');
      sendCommandToServer(testTargetId, 'CONFIG_INTERIM_HIT', 'test_multi', '150 SOLID 255 255 255');
      await new Promise(r => setTimeout(r, 200));
      sendCommandToServer(testTargetId, 'CONFIG_HIT', 'test_multi', '3', 'DECREMENTAL', '2000 ANIM THEATER_CHASE 255 0 255');
      updateTestStatus('Step 7/9: OK - Multi-hit reaction configured.');
      await new Promise(r => setTimeout(r, 500));
  },
  // 8. Test Multi-Hit Gameplay
  async () => {
    updateTestStatus('Step 8/9: Testing multi-hit (3 required)...');
    sendCommandToServer(testTargetId, 'ON', '30000', 'test_hit_2', 'test_multi', '1000 ANIM PULSE 0 255 255');
    updateTestStatus('Step 8/9: Target is ON (Cyan Pulse). <strong class="prompt">Please HIT the target 3 times now.</strong> Watch for the white flash on the first two hits and a purple animation on the final hit.');
    const response = await waitForMessage();
    if (!response.message.startsWith('HIT')) {
        throw new Error(`Expected final HIT response after 3 impacts, but got: ${response.message}`);
    }
    updateTestStatus('Step 8/9: OK - Final HIT detected!');
    await new Promise(r => setTimeout(r, 2500)); // Wait for hit animation
  },
  // 9. Test OFF command
  async () => {
      updateTestStatus('Step 9/9: Testing OFF command...');
      sendCommandToServer(testTargetId, 'DISPLAY', '0', '1000 ANIM PULSE 255 165 0'); // Start an infinite display
      await new Promise(r => setTimeout(r, 2000));
      sendCommandToServer(testTargetId, 'OFF');
      await new Promise(r => setTimeout(r, 500));
      sendCommandToServer(testTargetId, 'STATUS_REQUEST');
      const response = await waitForMessage();
      if (!response.message.startsWith('STATUS_REPORT IDLE')) {
          throw new Error(`Expected state to be IDLE after OFF, but got: ${response.message}`);
      }
      updateTestStatus('Step 9/9: OK - Target correctly turned OFF.');
  }
];

async function runTestRoutine() {
  if (testInProgress) return;
  testTargetId = targetSelector.value;
  if (!testTargetId || targetSelector.options[targetSelector.selectedIndex].text === 'No Targets Connected') {
    updateTestStatus('<strong>Error:</strong> Please select a connected target to test.');
    return;
  }

  testInProgress = true;
  startTestBtn.disabled = true;
  currentTestStep = 0;
  logEl.innerHTML += '<hr><strong>--- STARTING TEST ROUTINE ---</strong><br>';

  try {
    for (const step of testSteps) {
      await step();
      currentTestStep++;
    }
    updateTestStatus('<h2>Test Complete!</h2><p>All tests passed successfully.</p>');
    logEl.innerHTML += '<strong>--- TEST ROUTINE PASSED ---</strong><br><hr>';
  } catch (error) {
    updateTestStatus(`<h2>Test Failed on Step ${currentTestStep + 1}</h2><p style="color: #ff6b6b;">${error.message}</p>`);
    logEl.innerHTML += `<strong style="color: #ff6b6b;">--- TEST FAILED: ${error.message} ---</strong><br><hr>`;
    // Attempt to turn the target off to leave it in a clean state
    sendCommandToServer(testTargetId, 'OFF');
  } finally {
    testInProgress = false;
    startTestBtn.disabled = false;
    messageResolver = null;
  }
}
