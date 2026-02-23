/**
 * socialmedia (sm) — Social media feed announcement setup
 *
 * Configure channels to receive announcements when a social media account posts.
 * Currently supports: YouTube, Twitch, Twitter/X, TikTok, Reddit (manual)
 *
 * Note: actual feed polling requires separate webhook/RSS setup on your host.
 * This command manages the channel configuration and custom message templates.
 */

const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');
const { EmbedBuilder } = require('discord.js');

const PLATFORMS = ['youtube', 'twitch', 'twitter', 'tiktok', 'reddit', 'instagram'];
const PLATFORM_ICONS = {
  youtube: '📺', twitch: '🟣', twitter: '🐦', tiktok: '🎵', reddit: '🟠', instagram: '📸'
};

module.exports = {
  name: 'socialmedia',
  aliases: ['sm', 'social', 'feeds'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has('ManageGuild'))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    if (!args[0]) return message.channel.send({
      embeds: [base(Colors.neutral)
        .setTitle(`**${prefix}socialmedia**`)
        .setDescription('Set up social media feed announcements when accounts post new content')
        .addFields(
          {
            name: '**subcommands**',
            value: [
              `\`${prefix}sm add <platform> <handle> #channel\` — add a feed`,
              `\`${prefix}sm remove <platform> <handle>\` — remove a feed`,
              `\`${prefix}sm message <platform> <handle> <text>\` — set custom message`,
              `\`${prefix}sm list\` — view all configured feeds`,
              `\`${prefix}sm test <platform> <handle>\` — send a test post`,
              `\`${prefix}sm clear\` — remove all feeds`,
            ].join('\n')
          },
          {
            name: '**supported platforms**',
            value: PLATFORMS.map(p => `${PLATFORM_ICONS[p]} \`${p}\``).join('  ')
          },
          {
            name: '**message variables**',
            value: [
              '`{handle}` — account handle',
              '`{platform}` — platform name',
              '`{title}` — post title/name',
              '`{url}` — post URL',
              '`{channel}` — the configured channel',
            ].join('\n')
          },
          { name: '**aliases**', value: 'sm, social, feeds' }
        )]
    });

    await db.ensureGuild(message.guild.id, message.guild.name);
    const sub = args[0].toLowerCase();

    // ── add ────────────────────────────────────────────────────
    if (sub === 'add') {
      const platform = args[1]?.toLowerCase();
      const handle   = args[2];
      const channel  = message.mentions.channels.first();

      if (!platform || !PLATFORMS.includes(platform))
        return message.channel.send({ embeds: [warn(`${message.author}: Provide a valid platform: ${PLATFORMS.map(p => `\`${p}\``).join(' ')}`)] });
      if (!handle)
        return message.channel.send({ embeds: [warn(`${message.author}: Provide an account handle`)] });
      if (!channel)
        return message.channel.send({ embeds: [warn(`${message.author}: Mention a channel to post updates to`)] });

      await db.addSocialFeed(message.guild.id, platform, handle, channel.id);
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(Colors.success)
          .setDescription(`✅ ${message.author}: Added ${PLATFORM_ICONS[platform]} **${platform}/${handle}** → ${channel}`)
          .setFooter({ text: 'Feed notifications will be posted when a new upload/post is detected' })]
      });
    }

    // ── remove ─────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const platform = args[1]?.toLowerCase();
      const handle   = args[2];
      if (!platform || !handle)
        return message.channel.send({ embeds: [warn(`${message.author}: Usage: \`${prefix}sm remove <platform> <handle>\``)] });

      const removed = await db.removeSocialFeed(message.guild.id, platform, handle);
      return message.channel.send({ embeds: [removed
        ? success(`${message.author}: Removed **${platform}/${handle}** feed`)
        : warn(`${message.author}: No feed found for **${platform}/${handle}**`)] });
    }

    // ── message ────────────────────────────────────────────────
    if (sub === 'message' || sub === 'msg') {
      const platform = args[1]?.toLowerCase();
      const handle   = args[2];
      const msg      = args.slice(3).join(' ');
      if (!platform || !handle || !msg)
        return message.channel.send({ embeds: [warn(`${message.author}: Usage: \`${prefix}sm message <platform> <handle> <text>\``)] });

      await db.setSocialFeedMessage(message.guild.id, platform, handle, msg);
      return message.channel.send({
        embeds: [base(Colors.neutral)
          .setTitle(`${platform}/${handle} — custom message`)
          .setDescription(`\`\`\`${msg}\`\`\``)]
      });
    }

    // ── list ───────────────────────────────────────────────────
    if (sub === 'list') {
      const feeds = await db.getSocialFeeds(message.guild.id);
      if (!feeds.length)
        return message.channel.send({ embeds: [base(Colors.neutral).setDescription('No social media feeds configured')] });

      const grouped = {};
      for (const f of feeds) {
        if (!grouped[f.platform]) grouped[f.platform] = [];
        grouped[f.platform].push(f);
      }

      const fields = Object.entries(grouped).map(([platform, items]) => ({
        name: `${PLATFORM_ICONS[platform] ?? ''} ${platform}`,
        value: items.map(f => `\`${f.handle}\` → <#${f.channel_id}>${f.custom_message ? ' (custom msg)' : ''}`).join('\n'),
        inline: true
      }));

      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(Colors.neutral)
          .setTitle(`${message.guild.name} — Social Media Feeds`)
          .addFields(...fields)
          .setFooter({ text: `${feeds.length} feed(s) configured` })
          .setTimestamp()]
      });
    }

    // ── test ───────────────────────────────────────────────────
    if (sub === 'test') {
      const platform = args[1]?.toLowerCase();
      const handle   = args[2];
      if (!platform || !handle)
        return message.channel.send({ embeds: [warn(`${message.author}: Usage: \`${prefix}sm test <platform> <handle>\``)] });

      const feed = await db.getSocialFeed(message.guild.id, platform, handle);
      if (!feed)
        return message.channel.send({ embeds: [warn(`${message.author}: No feed found for **${platform}/${handle}**`)] });

      const ch = message.guild.channels.cache.get(feed.channel_id);
      if (!ch) return message.channel.send({ embeds: [warn(`${message.author}: Feed channel not found`)] });

      const customMsg = feed.custom_message
        ?.replace('{handle}', handle)
        ?.replace('{platform}', platform)
        ?.replace('{title}', 'Test Post')
        ?.replace('{url}', `https://${platform}.com/${handle}`)
        ?? null;

      const testEmbed = new EmbedBuilder()
        .setColor(Colors.info)
        .setAuthor({ name: `${PLATFORM_ICONS[platform] ?? ''} ${platform} — ${handle}` })
        .setTitle('🧪 Test Post')
        .setDescription(`This is a preview of how **${platform}/${handle}** posts will look in ${ch}.`)
        .setFooter({ text: 'This is a test notification' })
        .setTimestamp();

      await ch.send({ content: customMsg ?? undefined, embeds: [testEmbed] });
      return message.channel.send({ embeds: [success(`${message.author}: Test notification sent to ${ch}`)] });
    }

    // ── clear ──────────────────────────────────────────────────
    if (sub === 'clear') {
      await db.clearSocialFeeds(message.guild.id);
      return message.channel.send({ embeds: [success(`${message.author}: All social media feeds cleared`)] });
    }

    return message.channel.send({ embeds: [warn(`${message.author}: Unknown subcommand. Use \`${prefix}sm\` for help`)] });
  }
};
