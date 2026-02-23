const { PermissionFlagsBits } = require('discord.js');
const { missingPerm } = require('../../utils/embeds');

module.exports = {
  name: 'botclear',
  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });
    const amount = parseInt(args[0]) || 20;
    const msgs = await message.channel.messages.fetch({ limit: Math.min(amount, 100) });
    const botMsgs = msgs.filter(m => m.author.bot);
    await message.channel.bulkDelete(botMsgs, true).catch(() => {});
    const m = await message.channel.send(`Cleared **${botMsgs.size}** bot messages 👍`);
    setTimeout(() => m.delete().catch(() => {}), 2000);
  }
};
