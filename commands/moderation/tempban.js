const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, base, Colors, E } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

function parseDuration(str) {
  const match = str?.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;
  const u = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return parseInt(match[1]) * u[match[2].toLowerCase()];
}
function fmtDur(ms) {
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ');
}

module.exports = {
  name: 'tempban',
  aliases: ['tban'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'ban_members')] });

    const { guild, author } = message;
    const member = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0]);

    if (!member) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: Usage: \`${prefix}tempban @user <duration> [reason]\`\nDuration: \`1m\` \`1h\` \`1d\` \`1w\``)] });

    const durMs = parseDuration(args[1]);
    if (!durMs) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: Provide a valid duration — e.g. \`1h\` \`7d\` \`2w\``)] });

    if (member.id === author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot ban yourself`)] });
    if (!member.bannable)        return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: I cannot ban that member (hierarchy)`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot ban someone higher than you`)] });

    const reason = args.slice(2).join(' ') || 'No reason provided';
    const unbanAt = new Date(Date.now() + durMs);

    await member.send({ embeds: [base(Colors.error).setTitle('Temporarily Banned')
      .addFields(
        { name: 'Server',    value: guild.name,           inline: true },
        { name: 'Duration',  value: fmtDur(durMs),        inline: true },
        { name: 'Expires',   value: `<t:${Math.floor(unbanAt.getTime()/1000)}:R>`, inline: true },
        { name: 'Moderator', value: author.tag,           inline: true },
        { name: 'Reason',    value: reason },
      )] }).catch(() => {});

    await member.ban({ deleteMessageSeconds: 7 * 86400, reason: `[Tempban ${fmtDur(durMs)}] ${reason}` });
    await db.addInfraction({ guildId: guild.id, targetUserId: member.id, modUserId: author.id, type: 'tempban', reason: `${fmtDur(durMs)} — ${reason}`, expiresAt: unbanAt }).catch(() => {});

    // Schedule unban
    setTimeout(async () => {
      await guild.bans.remove(member.id, 'Tempban expired').catch(() => {});
    }, durMs);

    return message.channel.send({ embeds: [base(Colors.mod)
      .setAuthor({ name: author.username, iconURL: author.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTitle('⏱️ Member Temporarily Banned')
      .addFields(
        { name: 'Member',   value: `${member.user.tag} \`(${member.id})\``, inline: true },
        { name: 'Duration', value: fmtDur(durMs), inline: true },
        { name: 'Expires',  value: `<t:${Math.floor(unbanAt.getTime()/1000)}:R>`, inline: true },
        { name: 'Reason',   value: reason },
      )] });
  }
};
