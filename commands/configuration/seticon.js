/**
 * seticon — Change the server icon via URL or attachment
 * Requires: Manage Guild
 */
const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'seticon',
  aliases: ['servericon', 'changeicon', 'guildicon-set'],
  category: 'configuration',

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [warn(`${message.author}: I'm missing **Manage Guild** permission`)] });

    // Resolve icon: attachment → URL arg → no args
    const attachment = message.attachments.first();
    const url = attachment?.url ?? args[0];

    if (!url) return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('🖼️ Set Server Icon')
      .setDescription([
        `\`${prefix}seticon <url>\` — set icon from URL`,
        `\`${prefix}seticon\` (with attachment) — set icon from file`,
        '',
        '**Supported formats:** PNG, JPG, GIF (animated — requires Server Level 1)',
      ].join('\n'))] });

    const validExt = /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url);
    if (!validExt && !attachment)
      return message.channel.send({ embeds: [warn(`${message.author}: URL must point to a PNG, JPG, GIF, or WebP image`)] });

    try {
      const old = message.guild.iconURL({ dynamic: true, size: 256 });
      await message.guild.setIcon(url, `Changed by ${message.author.tag}`);
      const newIcon = message.guild.iconURL({ dynamic: true, size: 256 });

      return message.channel.send({ embeds: [success(`${message.author}: Server icon updated!`)
        .setThumbnail(newIcon)
        .addFields(
          { name: '🖼️ New Icon', value: `[View](${newIcon})`, inline: true },
          { name: '🕐 Previous', value: old ? `[View](${old})` : '`None`', inline: true },
        )] });
    } catch (err) {
      return message.channel.send({ embeds: [warn(`${message.author}: Failed to update icon — ${err.message.slice(0, 100)}`)] });
    }
  }
};
