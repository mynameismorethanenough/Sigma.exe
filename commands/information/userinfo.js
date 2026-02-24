const { PermissionFlagsBits, ActivityType } = require('discord.js');
const { base, Colors } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');
const db = require('../../database/db');

// ── Badge map ───────────────────────────────────────────────────
const BADGES = {
  Staff:                      '<:staff:1>       Discord Staff',
  Partner:                    '🤝 Discord Partner',
  BugHunterLevel1:            '🐛 Bug Hunter',
  BugHunterLevel2:            '🔸 Bug Hunter Gold',
  HypeSquad:                  '🏆 HypeSquad Events',
  HypeSquadOnlineHouse1:      '🏠 HypeSquad Bravery',
  HypeSquadOnlineHouse2:      '💜 HypeSquad Brilliance',
  HypeSquadOnlineHouse3:      '💚 HypeSquad Balance',
  EarlyNitroSubscriber:       '💎 Early Nitro Supporter',
  EarlySupporter:             '💎 Early Supporter',
  VerifiedBot:                '✅ Verified Bot',
  VerifiedDeveloper:          '🔧 Verified Bot Developer',
  CertifiedModerator:         '🛡️ Discord Moderator',
  ActiveDeveloper:            '⚡ Active Developer',
  PremiumEarlySupporter:      '💎 Early Supporter',
};

// ── Presence emoji ──────────────────────────────────────────────
const STATUS_EMOJI = {
  online:    '🟢',
  idle:      '🟡',
  dnd:       '🔴',
  offline:   '⚫',
  invisible: '⚫',
};
const STATUS_LABEL = {
  online:    'Online',
  idle:      'Idle',
  dnd:       'Do Not Disturb',
  offline:   'Offline',
  invisible: 'Invisible',
};

// ── Activity type labels ────────────────────────────────────────
const ACTIVITY_TYPE = {
  [ActivityType.Playing]:   '🎮 Playing',
  [ActivityType.Streaming]: '📺 Streaming',
  [ActivityType.Listening]: '🎵 Listening to',
  [ActivityType.Watching]:  '👀 Watching',
  [ActivityType.Competing]: '🏆 Competing in',
  [ActivityType.Custom]:    '💬 Status',
};

// ── Key permission flags to show ────────────────────────────────
const KEY_PERMS = [
  ['Administrator',     '👑 Administrator'],
  ['ManageGuild',       '⚙️ Manage Server'],
  ['ManageRoles',       '🎭 Manage Roles'],
  ['ManageChannels',    '📁 Manage Channels'],
  ['ManageMessages',    '📝 Manage Messages'],
  ['BanMembers',        '🔨 Ban Members'],
  ['KickMembers',       '👢 Kick Members'],
  ['ModerateMembers',   '⏱️ Timeout Members'],
  ['MentionEveryone',   '📣 Mention Everyone'],
  ['ManageNicknames',   '✏️ Manage Nicknames'],
  ['ManageWebhooks',    '🪝 Manage Webhooks'],
  ['ManageEmojisAndStickers', '🤩 Manage Emojis'],
];

// Age formatter
function formatAge(ms) {
  const d = Math.floor(ms / 86400000);
  const y = Math.floor(d / 365);
  const mo = Math.floor((d % 365) / 30);
  const rd = d % 30;
  const parts = [];
  if (y)  parts.push(`${y}y`);
  if (mo) parts.push(`${mo}mo`);
  if (rd || !parts.length) parts.push(`${rd}d`);
  return parts.join(' ');
}

module.exports = {
  name: 'userinfo',
  aliases: ['ui', 'whois', 'info', 'user'],

  run: async (client, message, args) => {
    // ── Resolve member ────────────────────────────────────────────
    let member = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0])
      ?? (args.length
          ? message.guild.members.cache.find(m =>
              m.user.username.toLowerCase() === args.join(' ').toLowerCase() ||
              (m.nickname?.toLowerCase() === args.join(' ').toLowerCase())
            )
          : null)
      ?? message.member;

    // Try to fetch if not cached
    if (!member && args[0]) {
      member = await message.guild.members.fetch(args[0]).catch(() => null) ?? message.member;
    }

    const user = await client.users.fetch(member.id, { force: true }).catch(() => member.user);

    // ── Fetch data in parallel ────────────────────────────────────
    const [flags, infractions] = await Promise.all([
      user.fetchFlags().catch(() => null),
      db.getUserInfractions(message.guild.id, user.id).catch(() => []),
    ]);

    // ── Badges ───────────────────────────────────────────────────
    const badgeList = (flags?.toArray() ?? []).map(f => BADGES[f]).filter(Boolean);
    if (member.id === message.guild.ownerId) badgeList.unshift('👑 Server Owner');
    else if (member.permissions.has(PermissionFlagsBits.Administrator)) badgeList.unshift('⚙️ Server Admin');
    else if (member.permissions.has(PermissionFlagsBits.ManageGuild)) badgeList.unshift('🛡️ Server Moderator');
    if (member.premiumSinceTimestamp) badgeList.push('🚀 Server Booster');

    // ── Presence & Activity ──────────────────────────────────────
    const presence = member.presence;
    const status   = presence?.status ?? 'offline';
    const statusStr = `${STATUS_EMOJI[status] ?? '⚫'} ${STATUS_LABEL[status] ?? 'Offline'}`;

    let activityStr = 'None';
    if (presence?.activities?.length) {
      const act = presence.activities.find(a => a.type !== ActivityType.Custom) ?? presence.activities[0];
      const label = ACTIVITY_TYPE[act.type] ?? '🎮';
      if (act.type === ActivityType.Custom) {
        activityStr = act.state ? `${act.emoji?.toString() ?? ''} ${act.state}`.trim() : 'None';
      } else {
        activityStr = `${label} **${act.name}**`;
        if (act.details) activityStr += `\n> ${act.details}`;
      }
    }

    // ── Join position ────────────────────────────────────────────
    const joinPos = [...message.guild.members.cache.values()]
      .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
      .findIndex(m => m.id === user.id) + 1;

    // ── Timestamps ───────────────────────────────────────────────
    const created  = Math.floor(user.createdTimestamp / 1000);
    const joined   = Math.floor(member.joinedTimestamp / 1000);
    const boosted  = member.premiumSinceTimestamp ? Math.floor(member.premiumSinceTimestamp / 1000) : null;
    const accountAge = formatAge(Date.now() - user.createdTimestamp);
    const memberAge  = formatAge(Date.now() - member.joinedTimestamp);

    // ── Roles ────────────────────────────────────────────────────
    const allRoles = member.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position);
    const roleDisplay = allRoles.map(r => `${r}`).slice(0, 20);
    const roleOverflow = Math.max(0, allRoles.size - 20);

    // ── Permissions ──────────────────────────────────────────────
    const keyPerms = KEY_PERMS
      .filter(([flag]) => member.permissions.has(flag))
      .map(([, label]) => label);

    // ── Avatar info ──────────────────────────────────────────────
    const avatar    = user.displayAvatarURL({ dynamic: true, size: 4096 });
    const isAnimated = user.avatar?.startsWith('a_') ?? false;
    const hasCustom  = !!user.avatar;

    // ── Infractions summary ──────────────────────────────────────
    const infCount = { warn: 0, mute: 0, kick: 0, ban: 0, jail: 0 };
    for (const i of infractions) infCount[i.type] = (infCount[i.type] ?? 0) + 1;
    const infStr = Object.entries(infCount).filter(([,v]) => v > 0)
      .map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(' · ') || 'Clean record ✅';

    // ── Timeout info ─────────────────────────────────────────────
    const timedOut = member.communicationDisabledUntilTimestamp
      && member.communicationDisabledUntilTimestamp > Date.now();

    // ── Build embed ───────────────────────────────────────────────
    const embed = base(member.displayHexColor || Colors.bleed)
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setTitle(
        [
          user.bot ? '🤖' : null,
          user.tag,
          member.nickname ? `(${member.nickname})` : null,
        ].filter(Boolean).join(' ')
      )
      .setDescription(
        [
          badgeList.length ? badgeList.join(' · ') : null,
          timedOut ? `⏱️ **Timed out** until <t:${Math.floor(member.communicationDisabledUntilTimestamp/1000)}:R>` : null,
        ].filter(Boolean).join('\n') || null
      )
      .setThumbnail(avatar)
      .addFields(
        // Row 1 — Identity
        {
          name: '🪪 ID / Status',
          value: [
            `**User ID:** \`${user.id}\``,
            `**Status:** ${statusStr}`,
            `**Account type:** ${user.bot ? 'Bot 🤖' : 'Human 👤'}`,
          ].join('\n'),
          inline: true
        },
        {
          name: '🎮 Activity',
          value: activityStr,
          inline: true
        },
        {
          name: '🏆 Join Position',
          value: `**#${joinPos}** of ${message.guild.memberCount}`,
          inline: true
        },

        // Row 2 — Timestamps
        {
          name: '📅 Created Account',
          value: `<t:${created}:F>\n<t:${created}:R>\n*(${accountAge} ago)*`,
          inline: true
        },
        {
          name: '📥 Joined Server',
          value: `<t:${joined}:F>\n<t:${joined}:R>\n*(${memberAge} ago)*`,
          inline: true
        },
        {
          name: '🚀 Boosting Since',
          value: boosted
            ? `<t:${boosted}:F>\n<t:${boosted}:R>`
            : 'Not boosting',
          inline: true
        },

        // Row 3 — Avatar
        {
          name: '🖼️ Avatar',
          value: [
            `**Type:** ${isAnimated ? 'Animated GIF' : hasCustom ? 'Static Image' : 'Default'}`,
            `[Open Full Size](${avatar})`,
            user.bannerURL() ? `[Open Banner](${user.bannerURL({ size: 2048 })})` : null,
          ].filter(Boolean).join('\n'),
          inline: true
        },

        // Row 4 — Infractions
        {
          name: '📋 Infractions',
          value: infStr,
          inline: true
        },

        // Row 5 — Permissions
        ...(keyPerms.length ? [{
          name: `🔑 Key Permissions`,
          value: keyPerms.join('\n'),
          inline: true
        }] : []),

        // Row 6 — Roles
        {
          name: `🎭 Roles [${allRoles.size}]`,
          value: allRoles.size
            ? roleDisplay.join(' ') + (roleOverflow ? ` and **${roleOverflow}** more…` : '')
            : 'No roles',
          inline: false
        },
      );

    // Banner image at bottom
    if (user.bannerURL()) embed.setImage(user.bannerURL({ size: 2048 }));

    embed.setFooter({ text: `Requested by ${message.author.tag}` }).setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }
};
