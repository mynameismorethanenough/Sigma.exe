const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, cmdHelp, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'purgeuser',
  aliases: ['clearuser'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'purgeuser', description: 'Delete messages from a specific user', aliases: 'clearuser', parameters: 'member, amount', info: '⚠️ Manage Messages', usage: 'purgeuser (member) <amount>', example: 'purgeuser @user 20', module: 'moderation' })] });

    const member = message.mentions.members.first() ?? message.guild.members.cache.get(args[0]);
    const amount = parseInt(args[1]) || 10;
    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Invalid user`)] });

    const messages = await message.channel.messages.fetch({ limit: 100 });
    const userMsgs = messages.filter(m => m.author.id === member.id).first(Math.min(amount, 100));
    await message.channel.bulkDelete(userMsgs, true).catch(() => {});
    const m = await message.channel.send(`Purged **${userMsgs.length}** messages from **${member.user.tag}** 👍`);
    setTimeout(() => m.delete().catch(() => {}), 2000);
  }
};
