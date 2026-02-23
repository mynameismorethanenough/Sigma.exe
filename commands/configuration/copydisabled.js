/**
 * copydisabled — Copy all disabled commands from one channel to another
 *
 * copydisabled <#source> <#target>  — copy disabled state to target channel
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'copydisabled',
  aliases: ['copydisable', 'copycommands'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;

    const sourceChannel = message.mentions.channels.first();
    const targetChannel = message.mentions.channels.last();

    if (!sourceChannel || !targetChannel || sourceChannel.id === targetChannel.id)
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('📋 Copy Disabled Commands')
        .setDescription('Copy disabled command settings from one channel to another.')
        .addFields({ name: '📋 Usage', value: `\`${prefix}copydisabled #source-channel #target-channel\`` })
      ]});

    // Get all disabled commands for the source channel
    const all = await db.getDisabledCommands(guild.id);
    const sourceSpecific = all.filter(r => r.channel_id === sourceChannel.id);

    if (!sourceSpecific.length)
      return message.channel.send({ embeds: [warn(`${author}: No channel-specific disabled commands found in ${sourceChannel}`)] });

    // Apply them to the target channel
    let copied = 0;
    for (const row of sourceSpecific) {
      await db.disableCommand(guild.id, row.command_name, targetChannel.id, author.id);
      copied++;
    }

    return message.channel.send({ embeds: [success(
      `${author}: Copied **${copied}** disabled command${copied !== 1 ? 's' : ''} from ${sourceChannel} → ${targetChannel}`
    )] });
  }
};
