const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { missingPerm, base, Colors, warn } = require('../../utils/embeds');

module.exports = {
  name: 'createembed',
  aliases: ['ce', 'embed'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });

    if (!args[0]) return message.channel.send({ embeds: [base(Colors.warn)
      .setTitle('createembed help')
      .setDescription('Create a custom embed using JSON')
      .addFields({ name: '**Usage**', value: `\`\`\`${prefix}createembed {"title":"Hello","description":"World","color":"#ff0000"}\`\`\`` },
                 { name: '**Fields**', value: '`title` `description` `color` `thumbnail` `image` `footer`' })] });

    const raw = message.content.slice(message.content.indexOf(args[0]));
    try {
      const data = JSON.parse(raw);
      const embed = new EmbedBuilder();
      if (data.title)       embed.setTitle(data.title.slice(0, 256));
      if (data.description) embed.setDescription(data.description.slice(0, 4096));
      if (data.color)       embed.setColor(data.color);
      if (data.thumbnail)   embed.setThumbnail(data.thumbnail);
      if (data.image)       embed.setImage(data.image);
      if (data.footer)      embed.setFooter({ text: data.footer.slice(0, 2048) });
      if (data.fields && Array.isArray(data.fields)) {
        for (const f of data.fields.slice(0, 25)) {
          if (f.name && f.value) embed.addFields({ name: f.name, value: f.value, inline: !!f.inline });
        }
      }
      await message.delete().catch(() => {});
      return message.channel.send({ embeds: [embed] });
    } catch {
      return message.channel.send({ embeds: [warn(`${message.author}: Invalid JSON — check your syntax`)] });
    }
  }
};
