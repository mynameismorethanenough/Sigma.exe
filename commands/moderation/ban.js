const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, cmdHelp, base, Colors, E } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'ban',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'ban_members')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'ban', description: 'Bans the mentioned user from the guild', aliases: 'N/A', parameters: 'member, reason', info: '⚠️ Ban Members', usage: 'ban (member) <reason>', example: 'ban @user Threatening members', module: 'moderation' })] });

    const member = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0]);
    const reason = args.slice(1).join(' ') || 'No Reason Supplied';

    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: **Invalid User**. Do \`${prefix}ban\` to see usage`)] });
    if (member.id === message.author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot ban **yourself**`)] });
    if (!member.bannable) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Cannot ban due to **hierarchy**`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot ban someone **higher** than you`)] });

    await member.send({ embeds: [base(Colors.error).setTitle('**Banned**').addFields({ name: '**You have been banned from**', value: message.guild.name, inline: true }, { name: '**Moderator**', value: message.author.tag, inline: true }, { name: '**Reason**', value: reason, inline: true }).setFooter({ text: 'Contact a staff member to dispute.' })] }).catch(() => {});
    await member.ban({ deleteMessageSeconds: 7 * 86400, reason });
    await db.addInfraction({ guildId: message.guild.id, targetUserId: member.id, modUserId: message.author.id, type: 'ban', reason }).catch(() => {});
    return message.channel.send('👍');
  }
};
