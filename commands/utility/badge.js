/**
 * badge — Reward members for setting the server tag in their Discord profile
 *
 * badge                         — view your badges
 * badge role                    — list all badge roles
 * badge role add @role <name> [emoji]   — register a role as a badge
 * badge role remove @role       — unregister a badge role
 * badge role list               — list all badge roles
 * badge sync                    — sync your badges based on your current roles
 * badge sync @user              — (admin) sync another member's badges
 * badge message <text>          — set the badge reward message (admin)
 * badge message view            — view the current reward message
 */
const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

const BADGE_COLOR = 0xffd700;

module.exports = {
  name: 'badge',
  aliases: ['badges', 'badgecmd'],
  category: 'utility',

  run: async (client, message, args, prefix) => {
    await db.ensureGuild(message.guild.id, message.guild.name);
    const { guild, author, member } = message;
    const sub = args[0]?.toLowerCase();

    const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild);

    // ── Help / own badges ─────────────────────────────────────
    if (!sub) {
      const myBadges = await db.getMemberBadges(guild.id, author.id).catch(() => []);
      const config   = await db.getBadgeConfig(guild.id).catch(() => null);

      const badgeStr = myBadges.length
        ? myBadges.map(b => `${b.badge_emoji ?? '🏅'} **${b.badge_name}**`).join('\n')
        : '`No badges yet — use `,badge sync` to check`';

      return message.channel.send({ embeds: [base(BADGE_COLOR)
        .setTitle(`🏅 ${author.username}'s Badges`)
        .setThumbnail(author.displayAvatarURL({ dynamic: true }))
        .setDescription(badgeStr)
        .addFields({ name: '📋 Commands', value: [
          `\`${prefix}badge sync\` — sync your badges`,
          `\`${prefix}badge role list\` — view all badge roles`,
          ...(isAdmin ? [
            `\`${prefix}badge role add @role <name> [emoji]\` — add badge role`,
            `\`${prefix}badge role remove @role\` — remove badge role`,
            `\`${prefix}badge message <text>\` — set reward message`,
          ] : []),
        ].join('\n') })
        .setFooter({ text: guild.name + ' • Badges are tied to your server roles' })
      ]});
    }

    // ── ROLE subcommands ──────────────────────────────────────
    if (sub === 'role' || sub === 'roles') {
      const action = args[1]?.toLowerCase();

      // badge role list
      if (!action || action === 'list') {
        const badgeRoles = await db.getBadgeRoles(guild.id).catch(() => []);
        if (!badgeRoles.length)
          return message.channel.send({ embeds: [base(BADGE_COLOR).setDescription(`📭 No badge roles configured.\nUse \`${prefix}badge role add @role <name>\` to add one.`)] });

        const lines = badgeRoles.map((br, i) => {
          const role = guild.roles.cache.get(br.role_id);
          return `\`${i + 1}.\` ${br.badge_emoji} **${br.badge_name}** → ${role ?? `<@&${br.role_id}>`}`;
        });
        return message.channel.send({ embeds: [base(BADGE_COLOR)
          .setTitle(`🏅 Badge Roles (${badgeRoles.length})`)
          .setDescription(lines.join('\n'))
        ]});
      }

      // Admin-only below
      if (!isAdmin)
        return message.channel.send({ embeds: [missingPerm(author, 'manage_guild')] });

      // badge role add @role <name> [emoji]
      if (action === 'add') {
        const role = message.mentions.roles.first();
        if (!role)
          return message.channel.send({ embeds: [warn(`${author}: Mention a role — \`${prefix}badge role add @role <badge name> [emoji]\``)] });

        const rest   = args.slice(2).filter(a => !a.startsWith('<@'));
        const emoji  = rest.find(a => /^\p{Emoji}/u.test(a) || a.match(/^<:.+:\d+>$/)) ?? null;
        const nameArr = rest.filter(a => a !== emoji);
        const name   = nameArr.join(' ') || role.name;

        if (!name)
          return message.channel.send({ embeds: [warn(`${author}: Provide a badge name — \`${prefix}badge role add @role <name> [emoji]\``)] });

        await db.addBadgeRole(guild.id, role.id, name, emoji ?? '🏅', author.id);
        return message.channel.send({ embeds: [success(`${author}: Badge role added!\n> ${emoji ?? '🏅'} **${name}** → ${role}`)] });
      }

      // badge role remove @role
      if (action === 'remove' || action === 'delete') {
        const role = message.mentions.roles.first();
        if (!role)
          return message.channel.send({ embeds: [warn(`${author}: Mention a role — \`${prefix}badge role remove @role\``)] });

        const removed = await db.removeBadgeRole(guild.id, role.id);
        if (!removed)
          return message.channel.send({ embeds: [warn(`${author}: ${role} is not a badge role`)] });
        return message.channel.send({ embeds: [success(`${author}: Badge role **${role.name}** removed`)] });
      }

      return message.channel.send({ embeds: [warn(`${author}: Unknown action. Use \`list\`, \`add\`, or \`remove\``)] });
    }

    // ── SYNC ──────────────────────────────────────────────────
    if (sub === 'sync') {
      const targetMember = (isAdmin && message.mentions.members.first()) ?? member;
      const badgeRoles   = await db.getBadgeRoles(guild.id).catch(() => []);

      if (!badgeRoles.length)
        return message.channel.send({ embeds: [warn(`${author}: No badge roles configured — ask an admin to set them up first`)] });

      // Find which badge roles the member currently has
      const memberRoleIds = [...targetMember.roles.cache.keys()];
      const earned = badgeRoles.filter(br => memberRoleIds.includes(br.role_id));

      // Sync to DB
      await db.syncMemberBadges(guild.id, targetMember.id, earned.map(br => br.role_id));

      const isSelf = targetMember.id === author.id;
      if (!earned.length) {
        return message.channel.send({ embeds: [base(BADGE_COLOR)
          .setDescription(`📭 ${isSelf ? 'You have' : `**${targetMember.user.tag}** has`} no badge roles yet\n> Earn badge roles to unlock badges!`)] });
      }

      const badgeStr = earned.map(b => `${b.badge_emoji} **${b.badge_name}**`).join('\n');
      return message.channel.send({ embeds: [base(BADGE_COLOR)
        .setTitle(`✅ Badges Synced — ${earned.length} badge${earned.length !== 1 ? 's' : ''}`)
        .setDescription(badgeStr)
        .setFooter({ text: isSelf ? 'Your badges are up to date!' : `Synced for ${targetMember.user.tag}` })
      ]});
    }

    // ── MESSAGE ───────────────────────────────────────────────
    if (sub === 'message' || sub === 'msg') {
      const action = args[1]?.toLowerCase();

      // view
      if (action === 'view' || action === 'show') {
        const config = await db.getBadgeConfig(guild.id).catch(() => null);
        if (!config?.badge_message)
          return message.channel.send({ embeds: [base(BADGE_COLOR).setDescription(`📭 No badge message set\nUse \`${prefix}badge message <text>\` to set one`)] });
        return message.channel.send({ embeds: [base(BADGE_COLOR)
          .setTitle('🏅 Badge Message')
          .setDescription(`\`\`\`${config.badge_message}\`\`\``)
          .setFooter({ text: 'Variables: {user} {badge} {guild.name}' })] });
      }

      // set
      if (!isAdmin)
        return message.channel.send({ embeds: [missingPerm(author, 'manage_guild')] });

      const msg = args.slice(1).join(' ');
      if (!msg)
        return message.channel.send({ embeds: [warn(`${author}: Provide a message — \`${prefix}badge message <text>\`\nVariables: \`{user}\` \`{badge}\` \`{guild.name}\``)] });

      await db.setBadgeConfig(guild.id, { badge_message: msg });
      return message.channel.send({ embeds: [success(`${author}: Badge message set!\n\`\`\`${msg}\`\`\``)] });
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}badge\` for help.`)] });
  }
};
