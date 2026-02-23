const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, botMissingPerm, cmdHelp, base, Colors, success } = require('../../utils/embeds');

module.exports = {
  name: 'unban',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'unban', description: 'Unbans a user from the guild', aliases: 'N/A', parameters: 'user id', info: '⚠️ Ban Members', usage: 'unban (user id)', example: 'unban 262429076763967488', module: 'moderation' })] });

    const userId = args[0];
    if (isNaN(userId)) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Provide a valid **user ID**`)] });
    await message.guild.bans.remove(userId).catch(() => {});
    return message.channel.send({ embeds: [success(`${message.author}: Successfully **unbanned** \`${userId}\``)] });
  }
};
