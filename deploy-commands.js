require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const commands = [];
const foldersPath = path.join(__dirname, 'commands');

for (const folder of fs.readdirSync(foldersPath)) {
  const files = fs.readdirSync(path.join(foldersPath, folder)).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const cmd = require(path.join(foldersPath, folder, file));
    if (cmd?.data?.toJSON) {
      commands.push(cmd.data.toJSON());
      console.log(`✔ Queued: ${cmd.data.name}`);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`\nRegistering ${commands.length} commands...`);

    // Use GUILD_ID for instant updates during dev, remove for global deploy
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
      console.log(`✅ Registered to guild ${process.env.GUILD_ID} (instant)`);
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
      console.log('✅ Registered globally (may take up to 1hr)');
    }
  } catch (err) {
    console.error('❌ Deploy failed:', err);
  }
})();
