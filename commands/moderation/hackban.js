const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, cmdHelp, base, Colors, E } = require('../../utils/embeds');

module.exports = {
  name: 'hackban',
  aliases: ['hban'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'ban_members')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'hackban', description: 'Ban a user by ID even if they are not in the server', aliases: 'hban', parameters: 'user id, reason', info: '⚠️ Ban Members\nUse a User ID (not name#tag)', usage: 'hackban (user id) <reason>', example: 'hackban 262429076763967488 Raider', module: 'moderation' })] });

    const target = args[0];
    if (isNaN(target)) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: You must specify a valid **user ID**`)] });
    if (target === message.author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot ban **yourself**`)] });

    const reason = args.slice(1).join(' ') || 'No Reason Supplied';
    await message.guild.bans.create(target, { reason }).catch(e => {
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Could not ban that user: \`${e.message}\``)] });
    });
    await db.addInfraction({ guildId: message.guild.id, targetUserId: target, modUserId: message.author.id, type: 'ban', reason }).catch(() => {});
    return message.channel.send('👍');
  }
};
