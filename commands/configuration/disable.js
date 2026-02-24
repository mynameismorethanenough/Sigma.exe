const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, success, warn, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

const PROTECTED = ['disable', 'enable', 'help']; // can't be disabled

module.exports = {
  name: 'disable',
  aliases: ['disablecmd'],
  category: 'configuration',

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    if (!args[0]) return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('⚙️ disable — Command')
      .setDescription('Disable a command guild-wide or in a specific channel')
      .addFields(
        { name: '**Usage**', value: [
          `\`${prefix}disable <command>\` — disable everywhere`,
          `\`${prefix}disable <command> #channel\` — disable in one channel`,
          `\`${prefix}disable list\` — see all disabled commands`,
        ].join('\n')},
        { name: '**Re-enable**', value: `\`${prefix}enable <command> [#channel]\`` }
      )]
    });

    if (args[0].toLowerCase() === 'list') {
      const rows = await db.getDisabledCommands(message.guild.id);
      if (!rows.length) return message.channel.send({ embeds: [base(Colors.neutral).setDescription('No commands are disabled in this server')] });
      const guildWide = rows.filter(r => r.channel_id === '');
      const channelSpecific = rows.filter(r => r.channel_id !== '');
      const lines = [];
      if (guildWide.length)        lines.push('**Guild-wide:**\n' + guildWide.map(r=>`\`${r.command_name}\``).join(' '));
      if (channelSpecific.length)  lines.push('**Channel-specific:**\n' + channelSpecific.map(r=>`\`${r.command_name}\` in <#${r.channel_id}>`).join('\n'));
      return message.channel.send({ embeds: [base(Colors.neutral).setTitle('🚫 Disabled Commands').setDescription(lines.join('\n\n'))] });
    }

    const cmdName = args[0].toLowerCase();
    const cmd = client.prefixCmds.get(cmdName) ?? client.prefixCmds.get(client.aliases.get(cmdName));
    if (!cmd) return message.channel.send({ embeds: [warn(`${message.author}: Command \`${cmdName}\` not found`)] });
    if (PROTECTED.includes(cmd.name)) return message.channel.send({ embeds: [warn(`${message.author}: \`${cmd.name}\` cannot be disabled`)] });

    const channel = message.mentions.channels.first();
    const channelId = channel?.id ?? '';
    const scope = channel ? `in ${channel}` : 'server-wide';

    await db.disableCommand(message.guild.id, cmd.name, channelId, message.author.id);
    return message.channel.send({ embeds: [success(`${message.author}: \`${cmd.name}\` has been **disabled** ${scope}`)] });
  }
};
