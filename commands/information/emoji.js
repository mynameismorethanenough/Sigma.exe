const { EmbedBuilder } = require('discord.js');
const { base, warn, success, Colors } = require('../../utils/embeds');

// Parse a custom emoji string like <:name:id> or <a:name:id>
function parseEmoji(str) {
  const match = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (!match) return null;
  return { animated: !!match[1], name: match[2], id: match[3] };
}

module.exports = {
  name: 'emoji',
  aliases: ['emote', 'em'],
  category: 'information',

  run: async (client, message, args, prefix) => {
    const sub = args[0]?.toLowerCase();

    // ── emoji add ──────────────────────────────────────────────
    if (sub === 'add') {
      if (!message.member.permissions.has('ManageGuildExpressions'))
        return message.channel.send({ embeds: [warn(`${message.author}: You need **Manage Expressions** to add emojis`)] });

      // ,emoji add <emoji/url> <name>
      const input = args[1];
      const name  = args[2] ?? args[1]; // if no URL, name might be arg[1] when emoji is arg[1]
      if (!input) return message.channel.send({ embeds: [warn(`${message.author}: Usage: \`${prefix}emoji add <emoji or url> <name>\``)] });

      let imageUrl;
      let emojiName = args[2] ?? null;

      // Could be a custom emoji, unicode won't work (Discord API only supports custom)
      const parsed = parseEmoji(input);
      if (parsed) {
        imageUrl  = `https://cdn.discordapp.com/emojis/${parsed.id}.${parsed.animated ? 'gif' : 'png'}`;
        emojiName = emojiName ?? parsed.name;
      } else if (input.startsWith('http')) {
        imageUrl  = input;
        emojiName = emojiName ?? 'emoji';
      } else {
        return message.channel.send({ embeds: [warn(`${message.author}: Provide a custom emoji or image URL. Usage: \`${prefix}emoji add <emoji or url> <name>\``)] });
      }

      if (!emojiName) return message.channel.send({ embeds: [warn(`${message.author}: Provide a name — \`${prefix}emoji add <emoji/url> <name>\``)] });
      emojiName = emojiName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);

      const created = await message.guild.emojis.create({ attachment: imageUrl, name: emojiName }).catch(e => ({ error: e.message }));
      if (created.error) return message.channel.send({ embeds: [warn(`${message.author}: Failed — ${created.error}`)] });

      return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(Colors.success)
        .setTitle('✅ Emoji Added')
        .setThumbnail(`https://cdn.discordapp.com/emojis/${created.id}.${created.animated ? 'gif' : 'png'}`)
        .addFields(
          { name: 'Name',   value: `:${created.name}:`,      inline: true },
          { name: 'ID',     value: `\`${created.id}\``,      inline: true },
          { name: 'Type',   value: created.animated ? 'Animated' : 'Static', inline: true },
          { name: 'Usage',  value: `\`<${created.animated ? 'a' : ''}:${created.name}:${created.id}>\`` },
        )
        .setFooter({ text: `Added by ${message.author.tag}` })
        .setTimestamp()] });
    }

    // ── emoji stats ────────────────────────────────────────────
    if (sub === 'stats') {
      const emojis    = message.guild.emojis.cache;
      const animated  = emojis.filter(e => e.animated);
      const staticE   = emojis.filter(e => !e.animated);
      // Tier limits
      const tier = message.guild.premiumTier;
      const LIMITS = { 0: 50, 1: 100, 2: 150, 3: 250 };
      const limit = LIMITS[tier] ?? 50;

      const topStatic   = [...staticE.values()].slice(0, 10).map(e => `${e}`).join(' ') || 'None';
      const topAnimated = [...animated.values()].slice(0, 10).map(e => `${e}`).join(' ') || 'None';

      return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(Colors.info)
        .setAuthor({ name: `${message.guild.name} — Emoji Stats`, iconURL: message.guild.iconURL({ dynamic: true }) })
        .addFields(
          { name: '📊 Overview', value: [
            `**Total:** ${emojis.size} / ${limit * 2}`,
            `**Static:** ${staticE.size} / ${limit}`,
            `**Animated:** ${animated.size} / ${limit}`,
            `**Boost Tier:** ${tier} (limit: ${limit} each)`,
          ].join('\n'), inline: false },
          { name: `🖼️ Static Emojis [${staticE.size}]`,   value: topStatic,   inline: false },
          { name: `✨ Animated Emojis [${animated.size}]`, value: topAnimated, inline: false },
        )
        .setFooter({ text: `Use ${prefix}emoji add <emoji/url> <name> to add` })
        .setTimestamp()] });
    }

    // ── emoji <name or :emoji:> — show large ──────────────────
    const query = args.join(' ');
    if (!query) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle(`${prefix}emoji — Subcommands`)
        .addFields(
          { name: `\`${prefix}emoji <name>\``,           value: 'Show a large version of a server emoji',         inline: false },
          { name: `\`${prefix}emoji add <emoji/url> <name>\``, value: 'Add a new emoji to the server',            inline: false },
          { name: `\`${prefix}emoji stats\``,            value: 'View emoji usage stats for this server',         inline: false },
        )
        .setFooter({ text: 'Alias: emote, em' })] });
    }

    // Try to find by custom emoji syntax first
    const parsed = parseEmoji(query);
    let emoji;
    if (parsed) {
      emoji = message.guild.emojis.cache.get(parsed.id);
      // If not in this server, just build the URL directly
      if (!emoji) {
        const url = `https://cdn.discordapp.com/emojis/${parsed.id}.${parsed.animated ? 'gif' : 'png'}?size=512`;
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(Colors.info)
          .setTitle(`:${parsed.name}:`)
          .setImage(url)
          .addFields(
            { name: 'ID',   value: `\`${parsed.id}\``, inline: true },
            { name: 'Type', value: parsed.animated ? 'Animated' : 'Static', inline: true },
            { name: 'CDN',  value: `[Open](${url})`, inline: true },
          )] });
      }
    } else {
      // Search by name
      const q = query.replace(/:/g, '').toLowerCase();
      emoji = message.guild.emojis.cache.find(e => e.name.toLowerCase() === q)
           ?? message.guild.emojis.cache.find(e => e.name.toLowerCase().includes(q));
    }

    if (!emoji) return message.channel.send({ embeds: [warn(`${message.author}: Emoji \`${query}\` not found in this server`)] });

    const url      = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=512`;
    const created  = Math.floor(emoji.createdTimestamp / 1000);

    return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(Colors.info)
      .setTitle(`:${emoji.name}:`)
      .setImage(url)
      .addFields(
        { name: 'ID',        value: `\`${emoji.id}\``,                       inline: true },
        { name: 'Type',      value: emoji.animated ? '✨ Animated' : '🖼️ Static', inline: true },
        { name: 'Managed',   value: emoji.managed ? 'Yes (Twitch/Integration)' : 'No', inline: true },
        { name: 'Usage',     value: `\`<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>\``, inline: false },
        { name: 'Created',   value: `<t:${created}:F> (<t:${created}:R>)`, inline: false },
        { name: 'CDN Link',  value: `[Open full size](${url})`, inline: true },
      )
      .setFooter({ text: `${message.guild.name}` })
      .setTimestamp()] });
  }
};
