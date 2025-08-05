// game.js
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('game');
    const gameLength = urlParams.get('gameLength');
    const targetTimeout = urlParams.get('targetTimeout');
    const aiCommentary = urlParams.get('aiCommentary'); // Get AI commentary preference
    console.log(`game.js: aiCommentary from URL: ${aiCommentary}`);

    const gameTitleElement = document.getElementById('game-title');
    const gameSpecificContentElement = document.getElementById('game-specific-content');
    const stopGameButton = document.getElementById('stop-game-button');

    // Establish WebSocket connection
    const ws = new WebSocket(`ws://${window.location.host}`);
    ws.binaryType = 'arraybuffer';

    const audioContext = new (window.AudioContext || window.webkitAudioContext)(); // Create an AudioContext.
    let audioQueue = [];
    let isPlaying = false;
    let expectingAudioData = false;
    let receivedChunkCount = 0; // Track the number of audio chunks received.
    let totalBytesReceived = 0; // Track total bytes for sanity checks.

    console.log("AudioContext state on creation:", audioContext.state);

    ws.onmessage = (event) => {
        try {
            if (event.data instanceof ArrayBuffer) {
                receivedChunkCount++;
                const arrayBuffer = event.data;
                totalBytesReceived += arrayBuffer.byteLength;

                console.log(`Received audio chunk #${receivedChunkCount}: byteLength = ${arrayBuffer.byteLength}, total bytes = ${totalBytesReceived}`);

                if (arrayBuffer.byteLength === 0) {
                    console.warn("Received empty audio ArrayBuffer.");
                    return; 
                }

                const int16Array = new Int16Array(arrayBuffer);
                console.log(`Int16Array length: ${int16Array.length}`);
                console.log("First 10 Int16Array samples:", int16Array.slice(0, 10)); 
                console.log("Last 10 Int16Array samples:", int16Array.slice(-10));

                const allZerosInt16 = int16Array.every(sample => sample === 0);
                if (allZerosInt16) {
                    console.warn("Received Int16Array chunk contains all zero samples.");
                }

                // --- NEW ROBUST NORMALIZATION METHOD ---
                const normalizedAudioData = new Float32Array(int16Array.length); // Pre-allocate the Float32Array.
                for (let i = 0; i < int16Array.length; i++) {
                    // Ensure floating-point division.
                    normalizedAudioData[i] = int16Array[i] / 32768.0; 
                }
                // --- END NEW NORMALIZATION METHOD ---

                console.log("First 10 normalized Float32Array samples (manual):", normalizedAudioData.slice(0, 10));
                console.log("Last 10 normalized Float32Array samples (manual):", normalizedAudioData.slice(-10));

                const allZerosFloat32 = normalizedAudioData.every(sample => sample === 0);
                if (allZerosFloat32) {
                    console.warn("Normalized Float32Array chunk contains all zero samples (after manual processing). This is unexpected if Int16Array had non-zeros.");
                }

                const numberOfChannels = 1;
                const sampleRate = 24000;
                const audioBuffer = audioContext.createBuffer(numberOfChannels, normalizedAudioData.length, sampleRate);
                console.log(`AudioBuffer created: channels=${audioBuffer.numberOfChannels}, length=${audioBuffer.length}, sampleRate=${audioBuffer.sampleRate}`);

                if (audioBuffer.numberOfChannels !== numberOfChannels || audioBuffer.sampleRate !== sampleRate) {
                    console.error("AudioBuffer parameters mismatch!");
                    return;
                }

                audioBuffer.copyToChannel(normalizedAudioData, 0);

                // (AnalyserNode setup and playback remains the same)
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256; 
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;

                source.connect(analyser); 
                analyser.connect(audioContext.destination); 

                source.start(0);

                function checkAudioData() {
                    if (source.playbackState === source.ENDED) {
                    console.log("Audio playback ended for this chunk.");
                    return;
                    }
                    analyser.getByteTimeDomainData(dataArray);
                    const hasSound = dataArray.some(value => value !== 128); 
                    if (hasSound) {
                    console.log("Analyser detected audio signal!"); 
                    }
                }
                checkAudioData(); 
            } else if (window.handleGameMessage) {
                // It's a regular game message, pass it to the game-specific handler.
                const data = JSON.parse(event.data);
                window.handleGameMessage(data);
            }

            

        } catch (e) {
            console.error("Failed to parse message:", e, event.data);
        }
    };

    function playNextInQueue() {
        if (audioQueue.length === 0) {
            isPlaying = false;
            return;
        }
        isPlaying = true;
        const buffer = audioQueue.shift();
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.onended = playNextInQueue;
        source.start(0);
    }

    stopGameButton.addEventListener('click', () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ command: 'stop-game' }));
            console.log('Sent stop-game command');
        } else {
            console.warn('WebSocket not open. Cannot send stop-game command.');
        }
    });

    if (gameType) {
        gameTitleElement.textContent = gameType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Load the specific game script
        const script = document.createElement('script');
        script.src = `${gameType}.js`;
        script.onload = () => {
            // Initialize the game if it has an init function
            if (typeof window.initGame === 'function') {
                const gameOptions = {};
                if (gameType === 'whack_a_mole') {
                    gameOptions.gameLength = gameLength ? parseInt(gameLength) : 15;
                    gameOptions.targetTimeout = targetTimeout ? parseInt(targetTimeout) : 1000;
                } else if (gameType === 'precision_challenge') {
                    gameOptions.gameLength = gameLength ? parseInt(gameLength) : 30;
                }
                window.initGame(gameOptions, ws, aiCommentary);
            }
        };
        document.body.appendChild(script);
    } else {
        gameTitleElement.textContent = 'No game selected.';
    }
});
