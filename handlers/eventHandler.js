const fs   = require('fs');
const path = require('path');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
    if (typeof event === 'function') {
      event(client);
      console.log(`  ✔ Event: ${file}`);
    }
  }
};
