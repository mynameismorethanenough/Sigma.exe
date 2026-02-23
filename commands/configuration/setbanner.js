/**
 * setbanner — Change the server banner via URL or attachment
 * Requires: Manage Guild + Server Level 2 (for banner support)
 */
const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'setbanner',
  aliases: ['serverbanner-set', 'changebanner', 'guildbanner-set'],
  category: 'configuration',

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [warn(`${message.author}: I'm missing **Manage Guild** permission`)] });

    // Check server has banner feature (Tier 2+)
    if (!message.guild.features.includes('BANNER')) {
      return message.channel.send({ embeds: [warn(`${message.author}: Your server needs **Level 2 Boost** (7 boosts) to set a banner`)] });
    }

    const attachment = message.attachments.first();
    const url = attachment?.url ?? args[0];

    // ,setbanner clear — remove current banner
    if (args[0]?.toLowerCase() === 'clear' || args[0]?.toLowerCase() === 'remove') {
      try {
        await message.guild.setBanner(null, `Cleared by ${message.author.tag}`);
        return message.channel.send({ embeds: [success(`${message.author}: Server banner removed`)] });
      } catch (err) {
        return message.channel.send({ embeds: [warn(`${message.author}: Failed — ${err.message.slice(0, 100)}`)] });
      }
    }

    if (!url) return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('🎨 Set Server Banner')
      .setDescription([
        `\`${prefix}setbanner <url>\` — set banner from URL`,
        `\`${prefix}setbanner\` (with attachment) — set banner from file`,
        `\`${prefix}setbanner clear\` — remove current banner`,
        '',
        '**Supported formats:** PNG, JPG, GIF (animated requires Level 3)',
        '**Recommended size:** 960×540 (16:9)',
        '**Requires:** Server Boost Level 2',
      ].join('\n'))] });

    try {
      const old = message.guild.bannerURL({ size: 512 });
      await message.guild.setBanner(url, `Changed by ${message.author.tag}`);
      const newBanner = message.guild.bannerURL({ size: 1024, dynamic: true });

      return message.channel.send({ embeds: [success(`${message.author}: Server banner updated!`)
        .setImage(newBanner ?? url)
        .addFields(
          { name: '🎨 New Banner', value: newBanner ? `[View](${newBanner})` : '`Set`', inline: true },
          { name: '🕐 Previous',   value: old ? `[View](${old})` : '`None`', inline: true },
        )] });
    } catch (err) {
      return message.channel.send({ embeds: [warn(`${message.author}: Failed to update banner — ${err.message.slice(0, 100)}`)] });
    }
  }
};
