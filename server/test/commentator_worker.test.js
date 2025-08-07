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

const { EventEmitter } = require('events');
const { exec } = require('child_process');
jest.useFakeTimers();
const fs = require('fs');
const path = require('path');

// Mock the worker_threads module
jest.mock('worker_threads', () => {
    const { EventEmitter } = require('events');
    return {
        parentPort: new EventEmitter(),
    };
});

// Mock the child_process module
jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

// Mock fs.writeFileSync
jest.mock('fs', () => ({
    ...jest.requireActual('fs'), // import and retain the original functionalities
    writeFileSync: jest.fn(),
}));


// Mock the genai module
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn(() => ({
        live: {
            connect: jest.fn(() => ({
                sendClientContent: jest.fn(),
                close: jest.fn(),
            })),
        },
    })),
    Modality: {
        AUDIO: 'AUDIO',
    }
}));

const commentatorWorker = require('../ai/commentator_worker');
const { parentPort } = require('worker_threads');


describe('Commentator Worker', () => {
    beforeEach(() => {
        // Reset mocks before each test
        exec.mockClear();
        fs.writeFileSync.mockClear();
        const { GoogleGenAI } = require('@google/genai');
        GoogleGenAI().live.connect.mockClear();
    });

    it('should play audio using ffplay when an audio message is received', () => {
        const { onMessage } = require('../ai/commentator_worker');
        const audioData = 'fake_audio_data';
        const audioBuffer = Buffer.from(audioData, 'base64');
        const filePath = path.join(__dirname, '../ai/commentary.wav');

        const message = {
            serverContent: {
                modelTurn: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'audio/wav',
                                data: audioData,
                            },
                        },
                    ],
                },
            },
        };

        onMessage(message);

        expect(fs.writeFileSync).toHaveBeenCalledWith(filePath, audioBuffer);
        expect(exec).toHaveBeenCalledWith(
            `ffplay -autoexit -nodisp ${filePath}`,
            expect.any(Function)
        );
    });
});
