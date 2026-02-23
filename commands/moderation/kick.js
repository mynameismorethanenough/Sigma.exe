const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, cmdHelp, base, Colors, E } = require('../../utils/embeds');

module.exports = {
  name: 'kick',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'kick_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'kick_members')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'kick', description: 'Kicks the mentioned user from the guild', aliases: 'N/A', parameters: 'member, reason', info: '⚠️ Kick Members', usage: 'kick (member) <reason>', example: 'kick @user Being annoying', module: 'moderation' })] });

    const member = message.mentions.members.first() ?? message.guild.members.cache.get(args[0]);
    const reason = args.slice(1).join(' ') || 'No Reason Supplied';

    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: **Invalid User**`)] });
    if (member.id === message.author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot kick **yourself**`)] });
    if (!member.kickable) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Cannot kick due to **hierarchy**`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot kick someone **higher** than you`)] });

    await member.kick(reason);
    await db.addInfraction({ guildId: message.guild.id, targetUserId: member.id, modUserId: message.author.id, type: 'kick', reason }).catch(() => {});
    return message.channel.send('👍');
  }
};
