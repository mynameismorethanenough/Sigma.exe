/**
 * hardban — Permanent ban stored in DB; user is automatically re-banned if they rejoin
 * hardban @user/id [reason]
 * hardban list [page]
 * hardban remove <id>   — remove from hardban list (still banned via Discord — use unban too)
 */
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, base, Colors, success, warn } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

const PER_PAGE = 10;

module.exports = {
  name: 'hardban',
  aliases: ['hban2', 'permban'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'ban_members')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const all = await db.getHardbans(guild.id);
      if (!all.length) return message.channel.send({ embeds: [base(Colors.neutral).setDescription('📭 No hardbanned users')] });

      const page  = Math.max(1, parseInt(args[1]) || 1);
      const total = Math.ceil(all.length / PER_PAGE);
      const slice = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);

      const lines = slice.map((r, i) => {
        const ts = Math.floor(new Date(r.banned_at).getTime() / 1000);
        return `\`${(page - 1) * PER_PAGE + i + 1}.\` <@${r.user_id}> \`${r.user_id}\`\n> ${r.reason ?? 'No reason'} — <t:${ts}:R> by <@${r.banned_by}>`;
      }).join('\n\n');

      return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.error)
        .setTitle(`🔨 Hardban List — ${all.length} entries`)
        .setDescription(lines)
        .setFooter({ text: `Page ${page}/${total}` })] });
    }

    // ── REMOVE ────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const id = args[1];
      if (!id || !/^\d{17,20}$/.test(id))
        return message.channel.send({ embeds: [warn(`${author}: Provide a user ID — \`${prefix}hardban remove <user_id>\``)] });
      const removed = await db.removeHardban(guild.id, id);
      if (!removed) return message.channel.send({ embeds: [warn(`${author}: \`${id}\` is not in the hardban list`)] });
      return message.channel.send({ embeds: [success(`${author}: Removed \`${id}\` from hardban list\n> ⚠️ They're still Discord-banned — use \`${prefix}unban ${id}\` too`)] });
    }

    // ── BAN ───────────────────────────────────────────────────
    const targetArg = message.mentions.users.first()?.id ?? (args[0]?.match(/^\d{17,20}$/) ? args[0] : null);
    if (!targetArg) return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('🔨 Hardban')
      .setDescription([
        `\`${prefix}hardban @user [reason]\` — permanently hardban`,
        `\`${prefix}hardban list [page]\` — view all hardbanned users`,
        `\`${prefix}hardban remove <id>\` — remove from hardban list`,
        '',
        '> Hardbanned users are automatically re-banned if they rejoin.',
      ].join('\n'))] });

    if (targetArg === author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot hardban yourself`)] });

    const reason = (message.mentions.users.first() ? args.slice(1) : args.slice(1)).join(' ') || 'No reason provided';

    // Try to get member from cache first, then fetch
    const member = guild.members.cache.get(targetArg);
    if (member) {
      if (!member.bannable) return message.channel.send({ embeds: [warn(`${author}: I cannot ban that member (hierarchy)`)] });
      if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
        return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot ban someone higher than you`)] });

      await member.send({ embeds: [base(Colors.error).setTitle('Permanently Banned')
        .addFields({ name: 'Server', value: guild.name, inline: true }, { name: 'Reason', value: reason })] }).catch(() => {});
    }

    await guild.bans.create(targetArg, { deleteMessageSeconds: 28 * 86400, reason: `[Hardban] ${reason}` }).catch(() => {});
    await db.addHardban(guild.id, targetArg, reason, author.id);
    await db.addInfraction({ guildId: guild.id, targetUserId: targetArg, modUserId: author.id, type: 'hardban', reason }).catch(() => {});

    const user = await client.users.fetch(targetArg).catch(() => null);
    return message.channel.send({ embeds: [base(Colors.error)
      .setTitle('🔨 Member Hardbanned')
      .setThumbnail(user?.displayAvatarURL({ dynamic: true }) ?? null)
      .addFields(
        { name: 'User',   value: user ? `${user.tag} \`(${targetArg})\`` : `\`${targetArg}\``, inline: true },
        { name: 'Mod',    value: `${author}`, inline: true },
        { name: 'Reason', value: reason },
        { name: '🔒 Hardban', value: 'User will be automatically re-banned if they attempt to rejoin.' },
      )] });
  }
};
