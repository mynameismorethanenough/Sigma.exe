const { EmbedBuilder, StickerFormatType } = require('discord.js');
const { base, warn, success, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

const FORMAT = {
  [StickerFormatType.PNG]:    'PNG',
  [StickerFormatType.APNG]:   'APNG (Animated)',
  [StickerFormatType.Lottie]: 'Lottie (Animated)',
  [StickerFormatType.GIF]:    'GIF (Animated)',
};

module.exports = {
  name: 'sticker',
  aliases: ['stickers', 'st'],
  category: 'information',

  run: async (client, message, args, prefix) => {
    const sub = args[0]?.toLowerCase();

    // ── add ──────────────────────────────────────────────────────
    if (sub === 'add') {
      if (!message.member.permissions.has('ManageGuildExpressions'))
        return message.channel.send({ embeds: [warn(`${message.author}: You need **Manage Expressions** to add stickers`)] });

      const name = args[1];
      if (!name) return message.channel.send({ embeds: [warn(`${message.author}: Provide a name — \`${prefix}sticker add <name>\``)] });

      // Source: attachment or URL
      const attachment = message.attachments.first();
      const url = attachment?.url ?? (args[2] && args[2].startsWith('http') ? args[2] : null);
      if (!url) return message.channel.send({ embeds: [warn(`${message.author}: Attach an image or provide a URL — \`${prefix}sticker add <name> <url>\``)] });

      const validExt = /\.(png|apng|gif)(\?|$)/i.test(url);
      if (!validExt && !attachment) return message.channel.send({ embeds: [warn(`${message.author}: Stickers must be PNG, APNG, or GIF`)] });

      const sticker = await message.guild.stickers.create({
        file: url,
        name,
        tags: name.slice(0, 200),
        description: `Added by ${message.author.tag}`,
      }).catch(e => ({ error: e.message }));

      if (sticker.error) return message.channel.send({ embeds: [warn(`${message.author}: Failed to add sticker — ${sticker.error}`)] });

      return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(Colors.success)
        .setTitle('✅ Sticker Added')
        .setThumbnail(sticker.url)
        .addFields(
          { name: 'Name', value: sticker.name, inline: true },
          { name: 'ID',   value: `\`${sticker.id}\``, inline: true },
          { name: 'Format', value: FORMAT[sticker.format] ?? 'Unknown', inline: true },
        )
        .setFooter({ text: `Added by ${message.author.tag}` })
        .setTimestamp()] });
    }

    // ── rename ───────────────────────────────────────────────────
    if (sub === 'rename') {
      if (!message.member.permissions.has('ManageGuildExpressions'))
        return message.channel.send({ embeds: [warn(`${message.author}: You need **Manage Expressions** to rename stickers`)] });

      // Accept sticker attachment OR sticker ID
      const stickerAttachment = message.stickers.first();
      const stickerId = stickerAttachment?.id ?? args[1];
      const newName = stickerAttachment ? args[1] : args[2];

      if (!stickerId || !newName)
        return message.channel.send({ embeds: [warn(`${message.author}: Send a sticker with the message, or: \`${prefix}sticker rename <id> <new name>\``)] });

      const sticker = await message.guild.stickers.fetch(stickerId).catch(() => null);
      if (!sticker) return message.channel.send({ embeds: [warn(`${message.author}: Sticker not found in this server`)] });

      const oldName = sticker.name;
      await sticker.edit({ name: newName }).catch(e => ({ error: e.message }));

      return message.channel.send({ embeds: [success(`${message.author}: Renamed sticker **${oldName}** → **${newName}**`)] });
    }

    // ── list / default ───────────────────────────────────────────
    await message.guild.stickers.fetch();
    const stickers = message.guild.stickers.cache;

    if (!stickers.size)
      return message.channel.send({ embeds: [base(Colors.neutral).setDescription(`📭 This server has no stickers`)] });

    const list = [...stickers.values()].map((s, i) =>
      `\`${i+1}.\` **${s.name}** — \`${s.id}\` — ${FORMAT[s.format] ?? 'Unknown'}`
    ).join('\n');

    return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(Colors.info)
      .setAuthor({ name: `${message.guild.name} — Stickers`, iconURL: message.guild.iconURL({ dynamic: true }) })
      .setDescription(list.length > 4000 ? list.slice(0, 4000) + '\n...' : list)
      .setThumbnail(stickers.first()?.url ?? null)
      .setFooter({ text: `${stickers.size} sticker${stickers.size !== 1 ? 's' : ''} • ${prefix}sticker add <name> [url/attach] • ${prefix}sticker rename <id> <name>` })
      .setTimestamp()] });
  }
};
