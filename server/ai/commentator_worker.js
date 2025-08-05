const { parentPort } = require('worker_threads');
const { GoogleGenAI, Modality } = require('@google/genai');
const Speaker = require('speaker');
const fs = require('fs');
const path = require('path');

let liveSession = null;
let speaker = null;
let eventQueue = [];
let ticker = null;
let isGameOver = false;
let isReady = true; // Assume ready at the start

const generativeAi = new GoogleGenAI(process.env.GEMINI_API_KEY);

parentPort.on('message', (message) => {
    switch (message.type) {
        case 'start':
            start(message.gameMode, message.gameSettings);
            break;
        case 'event':
            eventQueue.push(message.event);
            // If the AI is ready, process the queue immediately.
            if (isReady) {
                processQueue();
            }
            break;
        case 'close':
            close();
            break;
    }
});

async function start(gameMode, gameSettings) {
    if (liveSession || ticker) {
        close();
    }

    speaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 24000,
        endianness: 'LE'
    });

    try {
        const basePromptPath = path.join(__dirname, 'prompts', 'base_commentator.txt');
        let systemInstruction = fs.readFileSync(basePromptPath, 'utf-8');
        const gameRulesPath = path.join(__dirname, 'prompts', `${gameMode}.txt`);
        let gameRules = 'No specific rules provided.';
        if (fs.existsSync(gameRulesPath)) {
            gameRules = fs.readFileSync(gameRulesPath, 'utf-8');
        }
        systemInstruction = systemInstruction.replace('{{GAME_RULES}}', gameRules).replace('{{GAME_SETTINGS}}', JSON.stringify(gameSettings));

        liveSession = await generativeAi.live.connect({
            model: 'gemini-live-2.5-flash-preview',
            //model: 'gemini-2.5-flash-preview-native-audio-dialog',
            config: {
                responseModalities: [Modality.AUDIO],
                systemInstruction: systemInstruction
            },
            callbacks: {
                onopen: () => console.log("AI Worker: Connection open."),
                onerror: (e) => console.error('AI Worker Error:', e),
                onmessage: onMessage,
                onclose: (e) => console.debug('AI Worker: Session Closed: ', e.reason)
            }
        });
        liveSession.sendClientContent({turns:`The game is starting now!`});
    } catch (error) {
        console.error('AI Worker: Failed to start session:', error);
    }
}

function onMessage(message) {
    // Process the audio data.
    if (speaker && message.serverContent && message.serverContent.modelTurn && message.serverContent.modelTurn.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
                speaker.write(audioBuffer);
            }
        }
    } else {
        console.log(JSON.stringify(message.serverContent));
    }

    // Check if the AI has finished its turn.
    if (message.serverContent && message.serverContent.turnComplete) {
        isReady = true;
        if (isGameOver) {
            close();
        } else {
            // After a turn, check if there are pending events to process.
            processQueue();
        }
    }
}

function processQueue() {
    if (!liveSession) return;

    // If there are no events, we don't need to send anything.
    if (eventQueue.length === 0) {
        // If the game is over and the queue is empty, we can close.
        if (isGameOver) {
            close();
        }
        return;
    }

    let filteredEvents = [];
    let latestTimeUpdate = null;
    let hasGameOver = false;

    for (const event of eventQueue) {
        if (event.startsWith('TIME_UPDATE')) {
            latestTimeUpdate = event;
        } else {
            filteredEvents.push(event);
        }
        if (event.includes('GAME_OVER')) {
            hasGameOver = true;
        }
    }

    // If there's a GAME_OVER event, we don't send any TIME_UPDATE events.
    // Otherwise, send only the most recent TIME_UPDATE.
    if (!hasGameOver && latestTimeUpdate) {
        filteredEvents.push(latestTimeUpdate);
    }

    const summary = filteredEvents.join('\n');

    // Only send if there's something to send after filtering
    if (summary.trim().length === 0) {
        eventQueue = [];
        return;
    }

    console.log(`AI Worker: Sending event summary:\n${summary}`);
    liveSession.sendClientContent({turns: summary});
    eventQueue = [];
    isReady = false;

    // If the summary we just sent contains the game over event, set the flag.
    if (summary.includes('GAME_OVER')) {
        isGameOver = true;
    }
}

function close() {
    console.log("AI Worker: Closing session.");
    if (ticker) clearInterval(ticker);
    if (liveSession) {
        liveSession.close();
        liveSession = null;
    }
    if (speaker) {
        speaker.end(() => {
            console.log("AI Worker: Speaker finished.");
            parentPort.postMessage({ type: 'closed' });
        });
    } else {
        parentPort.postMessage({ type: 'closed' });
    }
}
