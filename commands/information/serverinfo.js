const { ChannelType, GuildVerificationLevel, GuildExplicitContentFilter, GuildDefaultMessageNotifications, GuildNSFWLevel } = require('discord.js');
const { base, Colors } = require('../../utils/embeds');

// ── Lookup maps ─────────────────────────────────────────────────
const VERIFY = {
  [GuildVerificationLevel.None]:     '🔓 None',
  [GuildVerificationLevel.Low]:      '📧 Low — must have verified email',
  [GuildVerificationLevel.Medium]:   '⏱️ Medium — registered for 5+ minutes',
  [GuildVerificationLevel.High]:     '📱 High — member for 10+ minutes',
  [GuildVerificationLevel.VeryHigh]: '☎️ Highest — must have phone',
};

const CONTENT_FILTER = {
  [GuildExplicitContentFilter.Disabled]:           '🔴 Disabled',
  [GuildExplicitContentFilter.MembersWithoutRoles]:'🟡 Members without roles',
  [GuildExplicitContentFilter.AllMembers]:         '🟢 All members',
};

const NOTIF = {
  [GuildDefaultMessageNotifications.AllMessages]: 'All Messages',
  [GuildDefaultMessageNotifications.OnlyMentions]: 'Only @mentions',
};

const NSFW = {
  [GuildNSFWLevel.Default]:        '⬜ Default',
  [GuildNSFWLevel.Explicit]:       '🔞 Explicit',
  [GuildNSFWLevel.Safe]:           '✅ Safe',
  [GuildNSFWLevel.AgeRestricted]:  '🔞 Age Restricted',
};

const BOOST_TIER = {
  0: '🔹 No Boost',
  1: '🔷 Tier 1',
  2: '💠 Tier 2',
  3: '💎 Tier 3',
};

// Feature flag icons
const FEATURE_ICONS = {
  COMMUNITY:                     '🏘️ Community',
  VERIFIED:                      '✅ Verified',
  PARTNERED:                     '🤝 Partnered',
  DISCOVERABLE:                  '🔍 Discoverable',
  FEATURABLE:                    '⭐ Featurable',
  INVITE_SPLASH:                 '🖼️ Invite Splash',
  BANNER:                        '🏳️ Server Banner',
  ANIMATED_ICON:                 '🌀 Animated Icon',
  ANIMATED_BANNER:               '🌀 Animated Banner',
  NEWS:                          '📰 Announcement Channels',
  GUILD_ONBOARDING:              '🚪 Onboarding',
  WELCOME_SCREEN_ENABLED:        '👋 Welcome Screen',
  PREVIEW_ENABLED:               '👁️ Preview Enabled',
  TICKETED_EVENTS_ENABLED:       '🎟️ Ticketed Events',
  MONETIZATION_ENABLED:          '💰 Monetization',
  MEMBER_VERIFICATION_GATE_ENABLED: '🛡️ Member Screening',
  PRIVATE_THREADS:               '🔒 Private Threads',
  ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE: '💳 Role Subscriptions',
  RAID_ALERTS_ENABLED:           '🚨 Raid Alerts',
  AUTO_MODERATION:               '🤖 AutoMod',
  SOUNDBOARD:                    '🔊 Soundboard',
};

// Age string
function formatAge(ms) {
  const d = Math.floor(ms / 86400000);
  const y = Math.floor(d / 365);
  const mo = Math.floor((d % 365) / 30);
  const rd = d % 30;
  const parts = [];
  if (y)  parts.push(`${y} year${y > 1 ? 's' : ''}`);
  if (mo) parts.push(`${mo} month${mo > 1 ? 's' : ''}`);
  if (rd || !parts.length) parts.push(`${rd} day${rd !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

module.exports = {
  name: 'serverinfo',
  aliases: ['si', 'guildinfo', 'gi'],

  run: async (client, message, args) => {
    // Support ,serverinfo <guild id>
    let guild = message.guild;
    if (args[0] && /^\d{17,20}$/.test(args[0])) {
      const found = client.guilds.cache.get(args[0]);
      if (!found) return message.channel.send({ embeds: [require('../../utils/embeds').warn(`${message.author}: I'm not in a server with ID \`${args[0]}\``)] });
      guild = found;
    }

    // Fetch owner and ensure member cache is populated
    const [owner] = await Promise.all([
      guild.fetchOwner().catch(() => null),
      guild.members.fetch().catch(() => {}),
    ]);

    // ── Member counts ─────────────────────────────────────────────
    const totalMembers = guild.memberCount;
    const bots         = guild.members.cache.filter(m => m.user.bot).size;
    const humans       = totalMembers - bots;
    const online       = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const idle         = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
    const dnd          = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;
    const offline      = guild.members.cache.filter(m => !m.presence || m.presence.status === 'offline').size;
    const boosters     = guild.members.cache.filter(m => m.premiumSinceTimestamp).size;

    // ── Channel counts ────────────────────────────────────────────
    const ch = guild.channels.cache;
    const textCount     = ch.filter(c => c.type === ChannelType.GuildText).size;
    const voiceCount    = ch.filter(c => c.type === ChannelType.GuildVoice).size;
    const categoryCount = ch.filter(c => c.type === ChannelType.GuildCategory).size;
    const stageCount    = ch.filter(c => c.type === ChannelType.GuildStageVoice).size;
    const forumCount    = ch.filter(c => c.type === ChannelType.GuildForum).size;
    const announceCount = ch.filter(c => c.type === ChannelType.GuildAnnouncement).size;
    const totalChannels = textCount + voiceCount + stageCount + forumCount + announceCount;

    // ── Emojis ────────────────────────────────────────────────────
    const staticEmojis   = guild.emojis.cache.filter(e => !e.animated).size;
    const animatedEmojis = guild.emojis.cache.filter(e => e.animated).size;
    const totalEmojis    = staticEmojis + animatedEmojis;
    const stickerCount   = guild.stickers.cache.size;

    // ── Roles ─────────────────────────────────────────────────────
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position);

    // ── Features ──────────────────────────────────────────────────
    const features = guild.features
      .map(f => FEATURE_ICONS[f] ?? `\`${f.toLowerCase().replace(/_/g,' ')}\``)
      .sort();

    // ── Timestamps ────────────────────────────────────────────────
    const created    = Math.floor(guild.createdTimestamp / 1000);
    const ageStr     = formatAge(Date.now() - guild.createdTimestamp);

    // ── Special channels ──────────────────────────────────────────
    const systemChannel = guild.systemChannel ? `${guild.systemChannel}` : 'Not set';
    const afkChannel    = guild.afkChannel    ? `${guild.afkChannel} (${guild.afkTimeout}s)` : 'Not set';
    const rulesChannel  = guild.rulesChannel  ? `${guild.rulesChannel}` : 'Not set';

    // ── Boost info ────────────────────────────────────────────────
    const boostCount = guild.premiumSubscriptionCount ?? 0;
    const boostTier  = guild.premiumTier;
    const boostPerks = [
      boostTier >= 1 ? '🎨 Custom Emoji (100) · Animated Icon · 128kbps' : null,
      boostTier >= 2 ? '🖼️ Server Banner · 256kbps · 50MB uploads' : null,
      boostTier >= 3 ? '💎 100MB uploads · 384kbps · Animated Banner · Vanity URL' : null,
    ].filter(Boolean).join('\n') || 'No active perks';

    // ── Build embed ───────────────────────────────────────────────
    const color = message.member.displayHexColor && message.member.displayHexColor !== '#000000'
      ? message.member.displayHexColor
      : Colors.bleed;

    const embed = base(color)
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setTitle(
        [
          guild.name,
          guild.vanityURLCode ? `(discord.gg/${guild.vanityURLCode})` : null,
        ].filter(Boolean).join(' ')
      )
      .setDescription(
        [
          guild.description ? `> ${guild.description}` : null,
          `🗓️ Created <t:${created}:D> — **${ageStr}** old`,
        ].filter(Boolean).join('\n')
      )
      .setThumbnail(guild.iconURL({ dynamic: true, size: 4096 }))

      // Row 1 — Core info
      .addFields(
        {
          name: '👑 Ownership',
          value: [
            `**Owner:** ${owner ? `${owner.user.tag}` : `<@${guild.ownerId}>`}`,
            `**Owner ID:** \`${guild.ownerId}\``,
            `**Server ID:** \`${guild.id}\``,
          ].join('\n'),
          inline: true
        },
        {
          name: '👥 Members',
          value: [
            `**Total:** ${totalMembers.toLocaleString()}`,
            `**Humans:** ${humans.toLocaleString()} · **Bots:** ${bots}`,
            `🟢 ${online} · 🟡 ${idle} · 🔴 ${dnd} · ⚫ ${offline}`,
          ].join('\n'),
          inline: true
        },
        {
          name: '🚀 Boost Status',
          value: [
            `${BOOST_TIER[boostTier] ?? `Tier ${boostTier}`}`,
            `**${boostCount}** boost${boostCount !== 1 ? 's' : ''} · **${boosters}** booster${boosters !== 1 ? 's' : ''}`,
          ].join('\n'),
          inline: true
        },

        // Row 2 — Channels
        {
          name: `📁 Channels [${totalChannels}]`,
          value: [
            `💬 Text: **${textCount}**`,
            `🔊 Voice: **${voiceCount}**`,
            `📢 Announce: **${announceCount}**`,
            `🏟️ Stage: **${stageCount}**`,
            `📋 Forum: **${forumCount}**`,
            `📂 Categories: **${categoryCount}**`,
          ].join(' · '),
          inline: false
        },

        // Row 3 — Security
        {
          name: '🛡️ Security',
          value: [
            `**Verification:** ${VERIFY[guild.verificationLevel] ?? 'Unknown'}`,
            `**Content Filter:** ${CONTENT_FILTER[guild.explicitContentFilter] ?? 'Unknown'}`,
            `**NSFW Level:** ${NSFW[guild.nsfwLevel] ?? 'Unknown'}`,
            `**2FA Required:** ${guild.mfaLevel === 1 ? '✅ Yes' : '❌ No'}`,
          ].join('\n'),
          inline: true
        },
        {
          name: '⚙️ Settings',
          value: [
            `**Notifications:** ${NOTIF[guild.defaultMessageNotifications] ?? 'Unknown'}`,
            `**Locale:** \`${guild.preferredLocale}\``,
            `**Max Members:** ${guild.maximumMembers?.toLocaleString() ?? 'Unknown'}`,
          ].join('\n'),
          inline: true
        },
        {
          name: '📌 Special Channels',
          value: [
            `**System:** ${systemChannel}`,
            `**AFK:** ${afkChannel}`,
            `**Rules:** ${rulesChannel}`,
          ].join('\n'),
          inline: true
        },

        // Row 4 — Roles & Emojis
        {
          name: `🎭 Roles [${roles.size}]`,
          value: roles.size
            ? roles.map(r => `${r}`).slice(0, 10).join(' ')
              + (roles.size > 10 ? ` and **${roles.size - 10}** more` : '')
            : 'None',
          inline: false
        },
        {
          name: `😄 Emojis [${totalEmojis}]`,
          value: [
            `**Static:** ${staticEmojis}`,
            `**Animated:** ${animatedEmojis}`,
            `**Stickers:** ${stickerCount}`,
          ].join(' · '),
          inline: true
        },

        // Row 5 — Assets
        {
          name: '🖼️ Assets',
          value: [
            guild.iconURL()   ? `[Icon](${guild.iconURL({ size: 2048, dynamic: true })})` : null,
            guild.bannerURL() ? `[Banner](${guild.bannerURL({ size: 2048 })})` : null,
            guild.splashURL() ? `[Invite Splash](${guild.splashURL({ size: 2048 })})` : null,
          ].filter(Boolean).join(' · ') || 'No assets set',
          inline: true
        },
      );

    // Boost perks (only if boosted)
    if (boostTier > 0) {
      embed.addFields({
        name: '✨ Active Boost Perks',
        value: boostPerks,
        inline: false
      });
    }

    // Features
    if (features.length) {
      embed.addFields({
        name: `🏷️ Server Features [${features.length}]`,
        value: features.join(' · '),
        inline: false
      });
    }

    // Banner as image
    if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 2048 }));

    embed
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }
};
