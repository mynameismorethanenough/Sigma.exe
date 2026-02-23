const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, base, Colors, success } = require('../../utils/embeds');

module.exports = {
  name: 'softban',
  aliases: ['sban'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'ban_members')] });

    const { guild, author } = message;
    const member = message.mentions.members.first() ?? guild.members.cache.get(args[0]);

    if (!member) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: Usage: \`${prefix}softban @user [reason]\`\nSoftban bans then immediately unbans to purge messages.`)] });

    if (member.id === author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot ban yourself`)] });
    if (!member.bannable)        return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: I cannot ban that member (hierarchy)`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot ban someone higher than you`)] });

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await member.send({ embeds: [base(Colors.warn).setTitle('Kicked (Softban)')
      .addFields(
        { name: 'Server',    value: guild.name,   inline: true },
        { name: 'Moderator', value: author.tag,   inline: true },
        { name: 'Reason',    value: reason },
        { name: 'Note',      value: 'You may rejoin the server.' },
      )] }).catch(() => {});

    await member.ban({ deleteMessageSeconds: 7 * 86400, reason: `[Softban] ${reason}` });
    await guild.bans.remove(member.id, 'Softban — immediate unban').catch(() => {});
    await db.addInfraction({ guildId: guild.id, targetUserId: member.id, modUserId: author.id, type: 'softban', reason }).catch(() => {});

    return message.channel.send({ embeds: [success(`${author}: **${member.user.tag}** softbanned — messages purged, can rejoin`)] });
  }
};
