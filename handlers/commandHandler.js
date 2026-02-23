const fs   = require('fs');
const path = require('path');

module.exports = (client) => {
  const commandsPath = path.join(__dirname, '../commands');

  for (const folder of fs.readdirSync(commandsPath)) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
      const cmd = require(path.join(folderPath, file));

      // Slash command
      if (cmd.data?.name) {
        client.commands.set(cmd.data.name, cmd);
      }

      // Prefix command (bleed style: cmd.name + cmd.run)
      if (cmd.name && cmd.run) {
        client.prefixCmds.set(cmd.name, cmd);
        if (cmd.aliases && Array.isArray(cmd.aliases)) {
          cmd.aliases.forEach(alias => client.aliases.set(alias, cmd.name));
        }
        console.log(`  ✔ [${folder}] ${cmd.name}`);
      }
    }
  }

  // Slash command interaction handler
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command?.execute) return;

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`❌ Slash [${interaction.commandName}]:`, err);
      const msg = { content: 'Something went wrong.', ephemeral: true };
      interaction.replied || interaction.deferred
        ? interaction.followUp(msg).catch(() => {})
        : interaction.reply(msg).catch(() => {});
    }
  });
};
