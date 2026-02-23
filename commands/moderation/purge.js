const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, botMissingPerm, cmdHelp, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'purge',
  aliases: ['clear', 'prune', 'c'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'manage_messages')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'purge', description: 'Deletes the specified amount of messages', aliases: 'clear, prune, c', parameters: 'amount', info: '⚠️ Manage Messages', usage: 'purge <amount>', example: 'purge 30', module: 'moderation' })] });

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 2 || amount > 100)
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Amount must be between **2-100**`)] });

    const fetched = await message.channel.messages.fetch({ limit: amount });
    await message.channel.bulkDelete(fetched, true).catch(() => {});
    const msg = await message.channel.send(`Purged **${fetched.size}** messages 👍`);
    setTimeout(() => msg.delete().catch(() => {}), 2000);
  }
};
