/**
 * disablecommand — Disable commands for a channel, member, or server-wide
 *
 * disablecommand all <command>              — disable server-wide
 * disablecommand <#channel> <command>       — disable in a channel
 * disablecommand @member <command>          — disable for a member
 * disablecommand list                       — list all disabled commands
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

const PROTECTED = ['disablecommand', 'enablecommand', 'help', 'disable', 'enable'];

module.exports = {
  name: 'disablecommand',
  aliases: ['disablecmd', 'cmdoff'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🔧 Disable Command')
        .setDescription('Disable specific commands globally, per-channel, or per-member.')
        .addFields({ name: '📋 Usage', value: [
          `\`${prefix}disablecommand all <command>\` — disable server-wide`,
          `\`${prefix}disablecommand #channel <command>\` — disable in a channel`,
          `\`${prefix}disablecommand @member <command>\` — disable for a member`,
          `\`${prefix}disablecommand list\` — view all disabled commands`,
          `> Re-enable with \`${prefix}enablecommand\``,
        ].join('\n') })
      ]});
    }

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const rows = await db.getDisabledCommands(guild.id);
      if (!rows.length)
        return message.channel.send({ embeds: [base(Colors.neutral).setDescription('No commands are disabled in this server')] });

      const guildWide = rows.filter(r => r.channel_id === '');
      const specific  = rows.filter(r => r.channel_id !== '');

      const lines = [];
      if (guildWide.length)
        lines.push('**🌐 Server-wide:**\n' + guildWide.map(r => `\`${r.command_name}\``).join(' '));
      if (specific.length)
        lines.push('**📍 Channel-specific:**\n' + specific.map(r => `\`${r.command_name}\` in <#${r.channel_id}>`).join('\n'));

      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🚫 Disabled Commands')
        .setDescription(lines.join('\n\n'))
      ]});
    }

    // ── ALL (server-wide) ─────────────────────────────────────
    if (sub === 'all') {
      const cmdName = args[1]?.toLowerCase();
      if (!cmdName)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}disablecommand all <command>\``)] });

      const cmd = client.prefixCmds.get(cmdName) ?? client.prefixCmds.get(client.aliases.get(cmdName));
      if (!cmd)
        return message.channel.send({ embeds: [warn(`${author}: Command \`${cmdName}\` not found`)] });
      if (PROTECTED.includes(cmd.name))
        return message.channel.send({ embeds: [warn(`${author}: \`${cmd.name}\` cannot be disabled`)] });

      await db.disableCommand(guild.id, cmd.name, '', author.id);
      return message.channel.send({ embeds: [success(`${author}: \`${cmd.name}\` disabled **server-wide**`)] });
    }

    // ── CHANNEL or MEMBER ─────────────────────────────────────
    const channel = message.mentions.channels.first();
    const member  = message.mentions.members.first();
    const target  = channel ?? member;

    if (!target)
      return message.channel.send({ embeds: [warn(`${author}: Mention a channel or member, or use \`all\`\nUsage: \`${prefix}disablecommand #channel <command>\``)] });

    const cmdName = args.find((a, i) => i > 0 && !a.startsWith('<'));
    if (!cmdName)
      return message.channel.send({ embeds: [warn(`${author}: Provide a command name`)] });

    const cmd = client.prefixCmds.get(cmdName.toLowerCase()) ?? client.prefixCmds.get(client.aliases.get(cmdName.toLowerCase()));
    if (!cmd)
      return message.channel.send({ embeds: [warn(`${author}: Command \`${cmdName}\` not found`)] });
    if (PROTECTED.includes(cmd.name))
      return message.channel.send({ embeds: [warn(`${author}: \`${cmd.name}\` cannot be disabled`)] });

    const scopeId   = channel ? channel.id : member.id;
    const scopeDesc = channel ? `in ${channel}` : `for ${member}`;

    await db.disableCommand(guild.id, cmd.name, scopeId, author.id);
    return message.channel.send({ embeds: [success(`${author}: \`${cmd.name}\` disabled ${scopeDesc}`)] });
  }
};
