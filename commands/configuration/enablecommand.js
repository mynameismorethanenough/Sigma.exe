/**
 * enablecommand — Re-enable previously disabled commands
 *
 * enablecommand all <command>           — re-enable server-wide
 * enablecommand <#channel> <command>    — re-enable in a specific channel
 * enablecommand @member <command>       — re-enable for a member
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'enablecommand',
  aliases: ['enablecmd', 'cmdon'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🔧 Enable Command')
        .setDescription('Re-enable a previously disabled command.')
        .addFields({ name: '📋 Usage', value: [
          `\`${prefix}enablecommand all <command>\` — re-enable server-wide`,
          `\`${prefix}enablecommand #channel <command>\` — re-enable in a channel`,
          `\`${prefix}enablecommand @member <command>\` — re-enable for a member`,
          `> To view disabled commands: \`${prefix}disablecommand list\``,
        ].join('\n') })
      ]});
    }

    // ── ALL (server-wide) ─────────────────────────────────────
    if (sub === 'all') {
      const cmdName = args[1]?.toLowerCase();
      if (!cmdName)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}enablecommand all <command>\``)] });

      const cmd = client.prefixCmds.get(cmdName) ?? client.prefixCmds.get(client.aliases.get(cmdName));
      const name = cmd?.name ?? cmdName;

      const removed = await db.enableCommand(guild.id, name, '');
      if (!removed)
        return message.channel.send({ embeds: [warn(`${author}: \`${name}\` is not disabled server-wide`)] });
      return message.channel.send({ embeds: [success(`${author}: \`${name}\` re-enabled **server-wide**`)] });
    }

    // ── CHANNEL or MEMBER ─────────────────────────────────────
    const channel = message.mentions.channels.first();
    const member  = message.mentions.members.first();
    const target  = channel ?? member;

    if (!target)
      return message.channel.send({ embeds: [warn(`${author}: Mention a channel or member, or use \`all\`\nUsage: \`${prefix}enablecommand #channel <command>\``)] });

    const cmdName = args.find((a, i) => i > 0 && !a.startsWith('<'));
    if (!cmdName)
      return message.channel.send({ embeds: [warn(`${author}: Provide a command name`)] });

    const cmd = client.prefixCmds.get(cmdName.toLowerCase()) ?? client.prefixCmds.get(client.aliases.get(cmdName.toLowerCase()));
    const name = cmd?.name ?? cmdName.toLowerCase();

    const scopeId   = channel ? channel.id : member.id;
    const scopeDesc = channel ? `in ${channel}` : `for ${member}`;

    const removed = await db.enableCommand(guild.id, name, scopeId);
    if (!removed)
      return message.channel.send({ embeds: [warn(`${author}: \`${name}\` is not disabled ${scopeDesc}`)] });
    return message.channel.send({ embeds: [success(`${author}: \`${name}\` re-enabled ${scopeDesc}`)] });
  }
};
