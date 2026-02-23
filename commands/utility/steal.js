const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'steal',
  aliases: ['emojisteal', 'addemoji'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_emojis')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_emojis')] });

    if (!args[0]) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${message.author}: Provide an emoji to steal\n\`\`\`Syntax: ${prefix}steal <emoji> [name]\nExample: ${prefix}steal :pog: poggers\`\`\``)] });

    const match = args[0].match(/^<(a?):(\w+):(\d+)>$/);
    if (!match) return message.channel.send({ embeds: [warn(`${message.author}: Provide a **custom emoji** (built-in emojis cannot be stolen)`)] });

    const [, animated, emojiName, emojiId] = match;
    const ext = animated ? 'gif' : 'png';
    const url = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}`;
    const name = args[1] ?? emojiName;

    const emoji = await message.guild.emojis.create({ attachment: url, name }).catch(e => {
      message.channel.send({ embeds: [warn(`${message.author}: Failed to add emoji: \`${e.message}\``)] });
      return null;
    });
    if (!emoji) return;
    return message.channel.send({ embeds: [success(`${message.author}: Added emoji **${name}** — ${emoji}`)] });
  }
};
