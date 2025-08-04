// game.js
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('game');
    const gameLength = urlParams.get('gameLength');
    const targetTimeout = urlParams.get('targetTimeout');

    const gameTitleElement = document.getElementById('game-title');
    const gameSpecificContentElement = document.getElementById('game-specific-content');

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
                }
                window.initGame(gameOptions);
            }
        };
        document.body.appendChild(script);
    } else {
        gameTitleElement.textContent = 'No game selected.';
    }
});
