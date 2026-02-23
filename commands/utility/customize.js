/**
 * customize — Customize the bot's presence/appearance in this server
 *
 * What gets customized: how the BOT appears / speaks for this server
 *
 * customize activity <type> <text>   — set the bot's activity/game status
 * customize activity clear           — clear activity
 * customize status <text>            — set the bot's profile "About Me" / status text
 * customize status clear             — clear status
 * customize bio <text>               — set the bot's bio for this server (shown in ,botinfo)
 * customize bio clear
 * customize avatar <url/attach>      — change the bot's avatar
 * customize banner <url/attach>      — change the bot's banner
 *
 * Requires: Manage Guild
 */
const { EmbedBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

const COLOR = 0x9b59b6;
const MAX_BIO = 190;
const MAX_STATUS = 128;

const ACTIVITY_TYPES = {
  playing:   ActivityType.Playing,
  watching:  ActivityType.Watching,
  listening: ActivityType.Listening,
  competing: ActivityType.Competing,
  streaming: ActivityType.Streaming,
};

module.exports = {
  name: 'customize',
  aliases: ['customise', 'botcustomize'],
  category: 'configuration',

  run: async (client, message, args, prefix) => {
    const { guild, author, member } = message;

    if (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !isOwner(author.id))
      return message.channel.send({ embeds: [missingPerm(author, 'manage_guild')] });

    await db.ensureGuild(guild.id, guild.name);
    const sub = args[0]?.toLowerCase();

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(COLOR)
        .setTitle('🎨 Bot Customization')
        .setDescription('Customize how the bot appears and presents itself in this server.')
        .addFields(
          { name: '🎮 Activity Status', inline: false, value: [
            `\`${prefix}customize activity <type> <text>\` — set what the bot is doing`,
            `> Types: \`playing\` \`watching\` \`listening\` \`competing\` \`streaming\``,
            `\`${prefix}customize activity clear\` — clear the activity`,
            `💡 \`${prefix}customize activity watching your server\``,
          ].join('\n') },
          { name: '📝 Profile Status', inline: false, value: [
            `\`${prefix}customize status <text>\` — set the bot's About Me / status text`,
            `\`${prefix}customize status clear\` — clear it`,
            `> Max ${MAX_STATUS} characters`,
          ].join('\n') },
          { name: '💬 Server Bio', inline: false, value: [
            `\`${prefix}customize bio <text>\` — set a bio shown in \`,botinfo\` for this server`,
            `\`${prefix}customize bio clear\` — clear bio`,
            `> Max ${MAX_BIO} characters`,
          ].join('\n') },
          { name: '🖼️ Avatar & Banner', inline: false, value: [
            `\`${prefix}customize avatar <url>\` or attach image — change bot's avatar`,
            `\`${prefix}customize banner <url>\` or attach image — change bot's banner`,
            `> ⚠️ Avatar/banner changes apply globally across all servers`,
          ].join('\n') },
        )
        .setFooter({ text: 'Requires: Manage Guild' })
      ]});
    }

    // ── ACTIVITY ──────────────────────────────────────────────
    if (sub === 'activity' || sub === 'game') {
      const next = args[1]?.toLowerCase();

      if (next === 'clear' || next === 'remove' || next === 'reset') {
        client.user.setActivity(null);
        await db.setProfile(guild.id, client.user.id, { activity_status: null });
        return message.channel.send({ embeds: [success(`${author}: Bot activity cleared`)] });
      }

      if (!next || !ACTIVITY_TYPES[next]) {
        return message.channel.send({ embeds: [warn(`${author}: Provide a valid type — \`${prefix}customize activity <type> <text>\`\nTypes: ${Object.keys(ACTIVITY_TYPES).map(t => `\`${t}\``).join(' ')}`)] });
      }

      const text = args.slice(2).join(' ');
      if (!text)
        return message.channel.send({ embeds: [warn(`${author}: Provide the activity text — \`${prefix}customize activity ${next} <text>\``)] });

      client.user.setActivity(text, { type: ACTIVITY_TYPES[next] });
      await db.setProfile(guild.id, client.user.id, { activity_status: `${next}:${text}` });

      return message.channel.send({ embeds: [base(COLOR)
        .setTitle('✅ Activity Updated')
        .addFields(
          { name: 'Type', value: `\`${next}\``, inline: true },
          { name: 'Text', value: text, inline: true },
        )
        .setFooter({ text: '⚠️ Activity resets on bot restart' })
      ]});
    }

    // ── STATUS (About Me) ─────────────────────────────────────
    if (sub === 'status' || sub === 'aboutme') {
      const next = args[1]?.toLowerCase();

      if (next === 'clear' || next === 'remove' || next === 'reset') {
        await db.setProfile(guild.id, client.user.id, { profile_status: null });
        return message.channel.send({ embeds: [success(`${author}: Profile status cleared`)] });
      }

      const text = args.slice(1).join(' ');
      if (!text)
        return message.channel.send({ embeds: [warn(`${author}: Provide a status text — \`${prefix}customize status <text>\``)] });
      if (text.length > MAX_STATUS)
        return message.channel.send({ embeds: [warn(`${author}: Status too long — max **${MAX_STATUS}** chars (yours: ${text.length})`)] });

      await db.setProfile(guild.id, client.user.id, { profile_status: text });
      return message.channel.send({ embeds: [success(`${author}: Profile status saved!\n> \`${text}\``)
        .setFooter({ text: 'Shown in ,botinfo for this server' })
      ]});
    }

    // ── BIO ───────────────────────────────────────────────────
    if (sub === 'bio') {
      const next = args[1]?.toLowerCase();

      if (next === 'clear' || next === 'remove' || next === 'reset') {
        await db.setProfile(guild.id, client.user.id, { bio: null });
        return message.channel.send({ embeds: [success(`${author}: Bot bio cleared for **${guild.name}**`)] });
      }

      const text = args.slice(1).join(' ');
      if (!text)
        return message.channel.send({ embeds: [warn(`${author}: Provide a bio — \`${prefix}customize bio <text>\``)] });
      if (text.length > MAX_BIO)
        return message.channel.send({ embeds: [warn(`${author}: Bio too long — max **${MAX_BIO}** chars (yours: ${text.length})`)] });

      await db.setProfile(guild.id, client.user.id, { bio: text });
      return message.channel.send({ embeds: [base(COLOR)
        .setTitle('✅ Bio Set')
        .setDescription(`\`\`\`${text}\`\`\``)
        .setFooter({ text: `Shown in ,botinfo for ${guild.name}` })
      ]});
    }

    // ── AVATAR ────────────────────────────────────────────────
    if (sub === 'avatar' || sub === 'av') {
      const next = args[1]?.toLowerCase();
      if (next === 'clear' || next === 'reset') {
        return message.channel.send({ embeds: [warn(`${author}: Bot avatar can't be cleared — provide a new image to replace it`)] });
      }

      const attachment = message.attachments.first();
      const url = attachment?.url ?? args[1];

      if (!url)
        return message.channel.send({ embeds: [warn(`${author}: Provide a URL or attach an image — \`${prefix}customize avatar <url>\``)] });

      try {
        await client.user.setAvatar(url);
        return message.channel.send({ embeds: [base(COLOR)
          .setTitle('✅ Bot Avatar Updated')
          .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setDescription('Bot avatar has been updated globally across all servers.')
        ]});
      } catch (err) {
        return message.channel.send({ embeds: [warn(`${author}: Failed to update avatar — ${err.message.slice(0, 150)}`)] });
      }
    }

    // ── BANNER ────────────────────────────────────────────────
    if (sub === 'banner') {
      const next = args[1]?.toLowerCase();
      if (next === 'clear' || next === 'reset') {
        try {
          await client.user.setBanner(null);
          return message.channel.send({ embeds: [success(`${author}: Bot banner removed`)] });
        } catch (err) {
          return message.channel.send({ embeds: [warn(`${author}: Failed — ${err.message.slice(0, 100)}`)] });
        }
      }

      const attachment = message.attachments.first();
      const url = attachment?.url ?? args[1];

      if (!url)
        return message.channel.send({ embeds: [warn(`${author}: Provide a URL or attach an image — \`${prefix}customize banner <url>\``)] });

      try {
        await client.user.setBanner(url);
        return message.channel.send({ embeds: [base(COLOR)
          .setTitle('✅ Bot Banner Updated')
          .setImage(url)
          .setDescription('Bot banner updated globally.')
        ]});
      } catch (err) {
        return message.channel.send({ embeds: [warn(`${author}: Failed — ${err.message.slice(0, 150)}\n> Note: Bot accounts may need to be verified to set banners.`)] });
      }
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}customize\` for help.`)] });
  }
};
