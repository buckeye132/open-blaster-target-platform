import { Message, MessageType } from './protocol.mjs';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('game');
    const aiCommentary = urlParams.get('aiCommentary') === 'true';

    const gameTitleElement = document.getElementById('game-title');
    const stopGameButton = document.getElementById('stop-game-button');
    const gameContainer = document.getElementById('game-container');

    const ws = new WebSocket(`ws://${window.location.host}`);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
        try {
            if (event.data instanceof ArrayBuffer) {
                // TODO: implement audio commentary playback
            } else if (window.handleGameMessage) {
                const data = JSON.parse(event.data);
                // Pass the payload directly to the game-specific handler
                if (data.type === MessageType.S2C_GAME_UPDATE || data.type === MessageType.S2C_GAME_START || data.type === MessageType.S2C_GAME_OVER) {
                    window.handleGameMessage(data.payload);
                } else {
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
        }
        window.location.href = '/lobby';
    });

    if (gameType) {
        gameTitleElement.textContent = gameType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        const viewUrl = `/games/${gameType}.html`;
        const scriptUrl = `/games/${gameType}.js`;

        fetch(viewUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Game view not found for ${gameType}. The game may not be updated to the new UI system yet.`);
                }
                return response.text();
            })
            .then(html => {
                gameContainer.innerHTML = html;
                
                const script = document.createElement('script');
                script.src = scriptUrl;
                script.onload = () => {
                    if (typeof window.initGame === 'function') {
                        window.initGame({}, ws, aiCommentary);
                    } else {
                        console.error(`initGame function not found for ${gameType}.`);
                    }
                };
                document.body.appendChild(script);
            })
            .catch(error => {
                console.error(`Error loading game ${gameType}:`, error);
                gameContainer.innerHTML = `<p class="error">${error.message}</p>`;
            });

    } else {
        gameTitleElement.textContent = 'No Game Selected';
        gameContainer.innerHTML = '<p>Please select a game from the lobby.</p>';
    }
});
