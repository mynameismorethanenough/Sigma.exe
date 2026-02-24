/**
 * timeout — Discord native timeout
 * timeout @user <duration> [reason]
 * timeout list — show all currently timed out members
 */
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, base, Colors, warn } = require('../../utils/embeds');
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
  name: 'timeout',
  aliases: ['to'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'moderate_members')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const now = Date.now();
      // Fetch all members and filter timed-out ones
      await guild.members.fetch();
      const timedOut = guild.members.cache.filter(m =>
        m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > now
      );

      if (!timedOut.size) return message.channel.send({ embeds: [base(Colors.neutral).setDescription('📭 No members are currently timed out')] });

      const lines = [...timedOut.values()].slice(0, 20).map(m =>
        `${m} — expires <t:${Math.floor(m.communicationDisabledUntilTimestamp / 1000)}:R>`
      ).join('\n');

      return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.mod)
        .setTitle(`⏱️ Timed Out Members (${timedOut.size})`)
        .setDescription(lines)
        .setFooter({ text: timedOut.size > 20 ? `Showing 20/${timedOut.size}` : `${timedOut.size} total` })] });
    }

    // ── APPLY TIMEOUT ─────────────────────────────────────────
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers))
      return message.channel.send({ embeds: [botMissingPerm(author, 'moderate_members')] });

    const member = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0]);
    if (!member) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: Usage: \`${prefix}timeout @user <duration> [reason]\`\nDuration: \`1m\` \`1h\` \`1d\` (max 28d)\n\`${prefix}timeout list\` — view timed out members`)] });

    const durMs = parseDuration(args[1]) ?? 600000; // default 10m
    const reason = args.slice(2).join(' ') || 'No reason provided';
    const maxMs = 28 * 86400000;

    if (durMs > maxMs) return message.channel.send({ embeds: [warn(`${author}: Max timeout duration is **28 days**`)] });
    if (member.id === author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot timeout yourself`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: Cannot timeout someone higher than you`)] });

    await member.timeout(durMs, reason);
    await db.addInfraction({ guildId: guild.id, targetUserId: member.id, modUserId: author.id, type: 'timeout', reason: `${fmtDur(durMs)} — ${reason}` }).catch(() => {});

    const expiresAt = Math.floor((Date.now() + durMs) / 1000);
    return message.channel.send({ embeds: [base(Colors.mod)
      .setDescription(`⏱️ ${author}: **${member.user.tag}** timed out for **${fmtDur(durMs)}**\nExpires: <t:${expiresAt}:R>\n**Reason:** ${reason}`)] });
  }
};
