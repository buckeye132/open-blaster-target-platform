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

// This file is shared between the server and the browser.
// It defines the WebSocket communication protocol.

const MessageType = {
    // Client-to-Server (C2S)
    C2S_START_GAME: 'C2S_START_GAME',
    C2S_STOP_GAME: 'C2S_STOP_GAME',
    C2S_GET_AI_AVAILABILITY: 'C2S_GET_AI_AVAILABILITY',
    C2S_TARGET_COMMAND: 'C2S_TARGET_COMMAND',

    // Server-to-Client (S2C)
    S2C_AI_AVAILABILITY: 'S2C_AI_AVAILABILITY',
    S2C_TARGET_LIST_UPDATE: 'S2C_TARGET_LIST_UPDATE',
    S2C_TARGET_LOG_MESSAGE: 'S2C_TARGET_LOG_MESSAGE',
    S2C_GAME_START: 'S2C_GAME_START',
    S2C_GAME_UPDATE: 'S2C_GAME_UPDATE',
    S2C_GAME_OVER: 'S2C_GAME_OVER'
};

class Message {
    constructor(type, payload) {
        this.type = type;
        this.payload = payload;
    }

    // --- C2S Builders ---

    static startGame(gameMode, options, aiCommentary) {
        return new Message(MessageType.C2S_START_GAME, { gameMode, options, aiCommentary });
    }

    static stopGame() {
        return new Message(MessageType.C2S_STOP_GAME);
    }

    static getAiAvailability() {
        return new Message(MessageType.C2S_GET_AI_AVAILABILITY);
    }

    static targetCommand(targetId, command, options = {}) {
        return new Message(MessageType.C2S_TARGET_COMMAND, { targetId, command, options });
    }

    // --- S2C Builders ---

    static aiAvailability(available) {
        return new Message(MessageType.S2C_AI_AVAILABILITY, { available });
    }

    static targetListUpdate(targetList) {
        return new Message(MessageType.S2C_TARGET_LIST_UPDATE, { targetList });
    }

    static targetLogMessage(from, message) {
        return new Message(MessageType.S2C_TARGET_LOG_MESSAGE, { from, message });
    }

    static gameStart(payload) {
        return new Message(MessageType.S2C_GAME_START, payload);
    }

    static gameUpdate(updateType, payload) {
        return new Message(MessageType.S2C_GAME_UPDATE, { updateType, ...payload });
    }

    static gameOver(payload) {
        return new Message(MessageType.S2C_GAME_OVER, payload);
    }

    toJSON() {
        return { type: this.type, payload: this.payload };
    }
}

export { Message, MessageType };
