/**
 * history — Detailed moderation history
 * history @user              — list all cases (alias: cases, moderationhistory)
 * history view <case_id>     — view full details of a case
 * history remove <case_id>   — delete a specific case
 * history remove all @user   — delete all cases for a user
 */
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');

const TYPE_EMOJI = { ban: '🔨', tempban: '⏱️', hardban: '🔒', softban: '🧹', kick: '👢', mute: '🔇', unmute: '🔊', imute: '🖼️', rmute: '💬', warn: '⚠️', timeout: '⏱️', jail: '🔒', softban: '🧹' };

module.exports = {
  name: 'history',
  aliases: ['moderationhistory', 'modhistory', 'mh'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'moderate_members')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── VIEW <id> ─────────────────────────────────────────────
    if (sub === 'view' || sub === 'show') {
      const id = parseInt(args[1]);
      if (!id) return message.channel.send({ embeds: [warn(`${author}: Provide a case ID — \`${prefix}history view <id>\``)] });

      const r = await db.getInfractionById(id).catch(() => null);
      if (!r || r.guild_id !== guild.id) return message.channel.send({ embeds: [warn(`${author}: Case \`#${id}\` not found`)] });

      const ts = Math.floor(new Date(r.created_at).getTime() / 1000);
      return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.mod)
        .setTitle(`Case #${r.id} — ${r.type}`)
        .addFields(
          { name: 'User',      value: `<@${r.target_user_id}> \`(${r.target_user_id})\``, inline: true },
          { name: 'Moderator', value: `<@${r.mod_user_id}>`,                              inline: true },
          { name: 'Date',      value: `<t:${ts}:F>`,                                      inline: true },
          { name: 'Reason',    value: r.reason ?? 'No reason provided' },
          ...(r.expires_at ? [{ name: 'Expires', value: `<t:${Math.floor(new Date(r.expires_at).getTime()/1000)}:R>` }] : []),
        )
        .setFooter({ text: `Active: ${r.is_active ? 'Yes' : 'No'}` })] });
    }

    // ── REMOVE <id> ───────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const next = args[1]?.toLowerCase();

      // remove all @user
      if (next === 'all') {
        const user = message.mentions.users.first() ?? await client.users.fetch(args[2]).catch(() => null);
        if (!user) return message.channel.send({ embeds: [warn(`${author}: Mention a user — \`${prefix}history remove all @user\``)] });

        const count = await db.deleteAllInfractions(guild.id, user.id);
        return message.channel.send({ embeds: [success(`${author}: Deleted **${count}** case(s) for **${user.tag}**`)] });
      }

      const id = parseInt(args[1]);
      if (!id) return message.channel.send({ embeds: [warn(`${author}: \`${prefix}history remove <id>\` or \`${prefix}history remove all @user\``)] });

      const deleted = await db.deleteInfraction(guild.id, id);
      if (!deleted) return message.channel.send({ embeds: [warn(`${author}: Case \`#${id}\` not found in this server`)] });
      return message.channel.send({ embeds: [success(`${author}: Case \`#${id}\` deleted`)] });
    }

    // ── LIST @user ────────────────────────────────────────────
    const user = message.mentions.users.first() ?? await client.users.fetch(args[0] ?? '').catch(() => null);
    if (!user) return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('📋 History Commands')
      .setDescription([
        `\`${prefix}history @user\` — view all cases for a user`,
        `\`${prefix}history view <id>\` — view a specific case`,
        `\`${prefix}history remove <id>\` — delete a case`,
        `\`${prefix}history remove all @user\` — delete all cases for a user`,
      ].join('\n'))] });

    const records = await db.getUserInfractions(guild.id, user.id).catch(() => []);
    if (!records.length) return message.channel.send({ embeds: [base(Colors.success).setDescription(`✅ **${user.tag}** has no moderation history`)] });

    const lines = records.map(r => {
      const ts = Math.floor(new Date(r.created_at).getTime() / 1000);
      return `\`#${r.id}\` ${TYPE_EMOJI[r.type] ?? '🛡️'} **${r.type}** — <t:${ts}:R>\n↳ ${r.reason ?? 'No reason'} | by <@${r.mod_user_id}>`;
    }).join('\n\n');

    return message.channel.send({ embeds: [base(Colors.mod)
      .setAuthor({ name: `${user.tag} — Moderation History`, iconURL: user.displayAvatarURL() })
      .setDescription(lines.slice(0, 4000))
      .setFooter({ text: `${records.length} case(s) • ${prefix}history view <id> for details` })] });
  }
};
