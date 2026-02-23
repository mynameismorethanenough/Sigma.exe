const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'enable',
  aliases: ['enablecmd'],
  category: 'configuration',

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    if (!args[0]) return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('⚙️ enable — Command')
      .setDescription(`Re-enable a previously disabled command`)
      .addFields({ name: '**Usage**', value: [
        `\`${prefix}enable <command>\` — re-enable everywhere`,
        `\`${prefix}enable <command> #channel\` — re-enable in one channel`,
      ].join('\n')})
    ]});

    const cmdName = args[0].toLowerCase();
    const cmd = client.prefixCmds.get(cmdName) ?? client.prefixCmds.get(client.aliases.get(cmdName));
    if (!cmd) return message.channel.send({ embeds: [warn(`${message.author}: Command \`${cmdName}\` not found`)] });

    const channel = message.mentions.channels.first();
    const channelId = channel?.id ?? '';
    const scope = channel ? `in ${channel}` : 'server-wide';

    const removed = await db.enableCommand(message.guild.id, cmd.name, channelId);
    if (!removed) return message.channel.send({ embeds: [warn(`${message.author}: \`${cmd.name}\` is not disabled ${scope}`)] });
    return message.channel.send({ embeds: [success(`${message.author}: \`${cmd.name}\` has been **re-enabled** ${scope}`)] });
  }
};
