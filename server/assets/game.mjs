// game.js
import { Message, MessageType } from './protocol.mjs';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('game');
    const gameLength = urlParams.get('gameLength');
    const targetTimeout = urlParams.get('targetTimeout');
    const aiCommentary = urlParams.get('aiCommentary') === 'true';

    const gameTitleElement = document.getElementById('game-title');
    const stopGameButton = document.getElementById('stop-game-button');

    const ws = new WebSocket(`ws://${window.location.host}`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        const options = {};
        if (gameType === 'whack_a_mole') {
            options.gameLength = gameLength ? parseInt(gameLength) : 15;
            options.targetTimeout = targetTimeout ? parseInt(targetTimeout) : 1000;
        } else if (gameType === 'precision_challenge') {
            options.gameLength = gameLength ? parseInt(gameLength) : 30;
        } else if (gameType === 'distraction_alley') {
            options.gameLength = gameLength ? parseInt(gameLength) : 30;
        } else if (gameType === 'team_colors') {
            options.gameLength = gameLength ? parseInt(gameLength) : 30;
        }
        ws.send(JSON.stringify(Message.startGame(gameType, options, aiCommentary)));
    };

    ws.onmessage = (event) => {
        try {
            if (event.data instanceof ArrayBuffer) {
                // TODO: implement audio commentary playback
            } else if (window.handleGameMessage) {
                const data = JSON.parse(event.data);
                if (data.type === MessageType.S2C_GAME_UPDATE || data.type === MessageType.S2C_GAME_START || data.type === MessageType.S2C_GAME_OVER) {
                    // Pass the inner payload to the game-specific handler
                    window.handleGameMessage(data.payload);
                } else {
                    // For other message types, pass the whole message
                    window.handleGameMessage(data);
                }
            }
        } catch (e) {
            console.error("Failed to parse message:", e, event.data);
        }
    };

    stopGameButton.addEventListener('click', () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(Message.stopGame()));
        } else {
            console.warn('WebSocket not open. Cannot send stop-game command.');
        }
    });

    if (gameType) {
        gameTitleElement.textContent = gameType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const script = document.createElement('script');
        script.src = `${gameType}.js`;
        script.onload = () => {
            if (typeof window.initGame === 'function') {
                const gameOptions = {};
                if (gameType === 'whack_a_mole') {
                    gameOptions.gameLength = gameLength ? parseInt(gameLength) : 15;
                    gameOptions.targetTimeout = targetTimeout ? parseInt(targetTimeout) : 1000;
                } else if (gameType === 'precision_challenge') {
                    gameOptions.gameLength = gameLength ? parseInt(gameLength) : 30;
                } else if (gameType === 'distraction_alley') {
                    gameOptions.gameLength = gameLength ? parseInt(gameLength) : 30;
                } else if (gameType === 'team_colors') {
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
