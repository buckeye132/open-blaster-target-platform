const fs = require('fs');
const path = require('path');

const gameModes = {};
const gamesDir = __dirname;
const publicDir = path.join(__dirname, '..', '..', 'public', 'games');

console.log('LOG: Discovering and registering game modes...');

// Ensure the public games directory exists
fs.mkdirSync(publicDir, { recursive: true });

fs.readdirSync(gamesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .forEach(dirent => {
    const gameName = dirent.name;
    const gamePath = path.join(gamesDir, gameName, 'index.js');
    const clientScriptPath = path.join(gamesDir, gameName, 'client.js');
    const viewTemplatePath = path.join(gamesDir, gameName, 'view.html');

    if (fs.existsSync(gamePath)) {
      try {
        // Register the game mode
        gameModes[gameName] = require(gamePath);
        console.log(`  -> Registered game mode: ${gameName}`);

        // Copy client script to public directory
        if (fs.existsSync(clientScriptPath)) {
          const publicScriptPath = path.join(publicDir, `${gameName}.js`);
          fs.copyFileSync(clientScriptPath, publicScriptPath);
          console.log(`    - Copied client script.`);
        }

        // Copy view template to public directory
        if (fs.existsSync(viewTemplatePath)) {
          const publicViewPath = path.join(publicDir, `${gameName}.html`);
          fs.copyFileSync(viewTemplatePath, publicViewPath);
          console.log(`    - Copied view template.`);
        }

      } catch (error) {
        console.error(`ERROR: Failed to load game mode '${gameName}':`, error);
      }
    }
  });

module.exports = gameModes;
