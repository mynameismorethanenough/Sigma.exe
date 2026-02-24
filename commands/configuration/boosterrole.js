/**
 * boosterrole — Server booster custom role system
 *
 * ADMIN (Manage Guild):
 *   boosterrole setup              — enable/setup the system for this server
 *   boosterrole disable            — disable the system
 *   boosterrole share max <n>      — set max shares allowed per booster
 *   boosterrole cleanup            — remove roles for ex-boosters
 *
 * BOOSTER (anyone with Nitro boost):
 *   boosterrole                    — view your booster role info
 *   boosterrole create             — create your custom booster role
 *   boosterrole rename <name>      — rename your role
 *   boosterrole color #hex         — set role color
 *   boosterrole icon <emoji/url>   — set role icon (requires Boost Level 2)
 *   boosterrole share @user        — share your role with someone
 *   boosterrole share remove @user — remove a share
 *   boosterrole delete             — delete your booster role
 */

const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, success, warn, Colors } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

const BOOST_COLOR = 0xf47fff;

function isBooster(member) { return !!member.premiumSince; }

module.exports = {
  name: 'boosterrole',
  aliases: ['br', 'boostrrole', 'boosterroles'],
  category: 'configuration',

  run: async (client, message, args, prefix) => {
    const { guild, author, member } = message;
    const sub = args[0]?.toLowerCase();

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [warn(`${author}: I need **Manage Roles** permission to manage booster roles`)] });

    await db.ensureGuild(guild.id, guild.name);

    const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild);

    // ── SETUP (admin) ─────────────────────────────────────────
    if (sub === 'setup' || sub === 'enable') {
      if (!isAdmin) return message.channel.send({ embeds: [missingPerm(author, 'manage_guild')] });

      // Upsert the config row with enabled=true
      await db.setBoosterRoleConfig(guild.id, 'enabled', true);
      return message.channel.send({ embeds: [base(BOOST_COLOR)
        .setTitle('🌸 Booster Role System Enabled')
        .setDescription([
          '✅ The booster role system is now **active** in this server.',
          '',
          'Boosters can now run:',
          `> \`${prefix}boosterrole create\` — create their custom role`,
          `> \`${prefix}boosterrole rename <n>\` — rename it`,
          `> \`${prefix}boosterrole color #hex\` — change its color`,
          `> \`${prefix}boosterrole share @user\` — share with someone`,
          '',
          `**Admin:** \`${prefix}boosterrole share max <n>\` — set max shares (default: 3)`,
          `**Admin:** \`${prefix}boosterrole cleanup\` — remove ex-booster roles`,
        ].join('\n'))
      ]});
    }

    // ── DISABLE (admin) ────────────────────────────────────────
    if (sub === 'disable') {
      if (!isAdmin) return message.channel.send({ embeds: [missingPerm(author, 'manage_guild')] });
      await db.setBoosterRoleConfig(guild.id, 'enabled', false);
      return message.channel.send({ embeds: [warn(`${author}: Booster role system **disabled** — existing roles are kept but no new ones can be created`)] });
    }

    // Load config — if no row yet, system is considered disabled
    const cfg = await db.getBoosterRoleConfig(guild.id);
    // If there's never been a setup (no DB row), cfg returns the default {enabled: true}
    // We check the actual DB to see if it's been configured
    const cfgRow = await db.getBoosterRoleConfigRaw(guild.id);
    const isEnabled = cfgRow ? cfgRow.enabled : false; // if no row exists yet = not set up
    const maxShares = cfgRow?.max_shares ?? 3;

    // ── SHARE MAX (admin) ──────────────────────────────────────
    if (sub === 'share' && args[1]?.toLowerCase() === 'max') {
      if (!isAdmin) return message.channel.send({ embeds: [missingPerm(author, 'manage_guild')] });
      const n = parseInt(args[2]);
      if (isNaN(n) || n < 0 || n > 20)
        return message.channel.send({ embeds: [warn(`${author}: Provide a number 0–20`)] });
      await db.setBoosterRoleConfig(guild.id, 'max_shares', n);
      return message.channel.send({ embeds: [success(`${author}: Max booster role shares set to **${n}**`)] });
    }

    // ── CLEANUP (admin) ────────────────────────────────────────
    if (sub === 'cleanup') {
      if (!isAdmin) return message.channel.send({ embeds: [missingPerm(author, 'manage_guild')] });
      const statusMsg = await message.channel.send({ embeds: [base(BOOST_COLOR).setDescription('🔍 Scanning for expired booster roles...')] });
      const all = await db.getAllBoosterRoles(guild.id);
      let cleaned = 0;
      for (const record of all) {
        const m = await guild.members.fetch(record.user_id).catch(() => null);
        if (!m || !isBooster(m)) {
          const role = guild.roles.cache.get(record.role_id);
          if (role) await role.delete('Cleanup: member no longer boosting').catch(() => {});
          await db.removeBoosterRole(guild.id, record.user_id);
          cleaned++;
        }
      }
      return statusMsg.edit({ embeds: [success(`${author}: Cleaned **${cleaned}** expired booster role${cleaned !== 1 ? 's' : ''}`)] });
    }

    // ── All commands below require system to be enabled ────────
    if (!isEnabled) {
      return message.channel.send({ embeds: [base(Colors.warn)
        .setTitle('🌸 Booster Role System')
        .setDescription([
          '⚠️ The booster role system is **not set up** in this server.',
          '',
          isAdmin
            ? `An admin can enable it with:\n> \`${prefix}boosterrole setup\``
            : `Ask a server admin to run \`${prefix}boosterrole setup\``,
        ].join('\n'))
      ]});
    }

    // ── VIEW (no sub) ─────────────────────────────────────────
    if (!sub) {
      const record = await db.getBoosterRole(guild.id, author.id);

      if (!record) {
        return message.channel.send({ embeds: [base(BOOST_COLOR)
          .setTitle('🌸 Booster Role System')
          .setDescription([
            isBooster(member)
              ? `🎉 You're a **Nitro Booster!**\n> Run \`${prefix}boosterrole create\` to claim your custom role!`
              : `You're not a **server booster**.\n> Boost this server to unlock a custom role!`,
          ].join('\n'))
          .addFields({ name: '📋 Commands', value: [
            `\`${prefix}boosterrole create\` — create your custom role`,
            `\`${prefix}boosterrole rename <n>\` — rename it`,
            `\`${prefix}boosterrole color #hex\` — set color`,
            `\`${prefix}boosterrole icon <emoji/url>\` — set icon (Level 2)`,
            `\`${prefix}boosterrole share @user\` — share with someone`,
            `\`${prefix}boosterrole delete\` — delete your role`,
          ].join('\n') })
        ]});
      }

      const role = guild.roles.cache.get(record.role_id);
      if (!role) {
        await db.removeBoosterRole(guild.id, author.id);
        return message.channel.send({ embeds: [warn(`${author}: Your booster role no longer exists — run \`${prefix}boosterrole create\` to make a new one`)] });
      }

      const shares = await db.getBoosterShares(guild.id, author.id);
      return message.channel.send({ embeds: [base(role.color || BOOST_COLOR)
        .setTitle(`🌸 ${author.username}'s Booster Role`)
        .addFields(
          { name: '🏷️ Role',    value: `${role}`,             inline: true },
          { name: '🎨 Color',   value: `\`${role.hexColor}\``, inline: true },
          { name: '👥 Members', value: `${role.members.size}`, inline: true },
          { name: `🤝 Shared (${shares.length}/${maxShares})`,
            value: shares.length ? shares.map(s => `<@${s.target_user_id}>`).join(', ') : '`None`' },
        )
      ]});
    }

    // ── CREATE ────────────────────────────────────────────────
    if (sub === 'create' || sub === 'link') {
      if (!isBooster(member))
        return message.channel.send({ embeds: [warn(`${author}: You must be a **Nitro Booster** to create a booster role`)] });

      const existing = await db.getBoosterRole(guild.id, author.id);
      if (existing) {
        const role = guild.roles.cache.get(existing.role_id);
        if (role) return message.channel.send({ embeds: [warn(`${author}: You already have a booster role: ${role}\n> Use \`${prefix}boosterrole\` to view it`)] });
        await db.removeBoosterRole(guild.id, author.id); // stale record, allow recreation
      }

      const botRole = guild.members.me.roles.highest;
      const newRole = await guild.roles.create({
        name:   `${author.username}'s Role`,
        color:  BOOST_COLOR,
        reason: `Booster role for ${author.tag}`,
      }).catch(e => { throw new Error(e.message); });

      await newRole.setPosition(Math.max(1, botRole.rawPosition - 1)).catch(() => {});
      await member.roles.add(newRole).catch(() => {});
      await db.setBoosterRole(guild.id, author.id, newRole.id);

      return message.channel.send({ embeds: [base(BOOST_COLOR)
        .setAuthor({ name: `${author.username} — Booster Role Created`, iconURL: author.displayAvatarURL({ dynamic: true }) })
        .setDescription([
          `✅ Created ${newRole}`,
          '',
          `> \`${prefix}boosterrole rename <n>\` — rename it`,
          `> \`${prefix}boosterrole color #hex\` — set color`,
          `> \`${prefix}boosterrole icon <emoji>\` — set icon`,
          `> \`${prefix}boosterrole share @user\` — share it`,
        ].join('\n'))
      ]});
    }

    // ── RENAME ────────────────────────────────────────────────
    if (sub === 'rename') {
      const newName = args.slice(1).join(' ');
      if (!newName || newName.length > 100)
        return message.channel.send({ embeds: [warn(`${author}: \`${prefix}boosterrole rename <name>\` — max 100 chars`)] });

      const record = await db.getBoosterRole(guild.id, author.id);
      if (!record) return message.channel.send({ embeds: [warn(`${author}: No booster role — run \`${prefix}boosterrole create\``)] });
      const role = guild.roles.cache.get(record.role_id);
      if (!role) return message.channel.send({ embeds: [warn(`${author}: Your booster role was not found`)] });

      await role.setName(newName, `Booster rename by ${author.tag}`);
      return message.channel.send({ embeds: [success(`${author}: Booster role renamed to **${newName}**`)] });
    }

    // ── COLOR ─────────────────────────────────────────────────
    if (sub === 'color' || sub === 'colour') {
      const hex = args[1]?.replace('#', '');
      if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex))
        return message.channel.send({ embeds: [warn(`${author}: \`${prefix}boosterrole color #rrggbb\` — must be a valid 6-digit hex`)] });

      const record = await db.getBoosterRole(guild.id, author.id);
      if (!record) return message.channel.send({ embeds: [warn(`${author}: No booster role — run \`${prefix}boosterrole create\``)] });
      const role = guild.roles.cache.get(record.role_id);
      if (!role) return message.channel.send({ embeds: [warn(`${author}: Your booster role was not found`)] });

      await role.setColor(`#${hex}`);
      return message.channel.send({ embeds: [new EmbedBuilder().setColor(parseInt(hex, 16))
        .setDescription(`✅ ${author}: Booster role color set to **#${hex}**`)] });
    }

    // ── ICON ──────────────────────────────────────────────────
    if (sub === 'icon') {
      if (guild.premiumTier < 2)
        return message.channel.send({ embeds: [warn(`${author}: Role icons require **Server Boost Level 2**`)] });

      const iconInput = args[1];
      if (!iconInput)
        return message.channel.send({ embeds: [warn(`${author}: \`${prefix}boosterrole icon <emoji or url>\``)] });

      const record = await db.getBoosterRole(guild.id, author.id);
      if (!record) return message.channel.send({ embeds: [warn(`${author}: No booster role — run \`${prefix}boosterrole create\``)] });
      const role = guild.roles.cache.get(record.role_id);
      if (!role) return message.channel.send({ embeds: [warn(`${author}: Your booster role was not found`)] });

      let icon = iconInput;
      const emojiMatch = iconInput.match(/^<a?:\w+:(\d+)>$/);
      if (emojiMatch) {
        const emoji = guild.emojis.cache.get(emojiMatch[1]);
        icon = emoji?.url ?? iconInput;
      }

      await role.setIcon(icon, `Booster icon by ${author.tag}`).catch(e => { throw new Error(e.message); });
      return message.channel.send({ embeds: [success(`${author}: Booster role icon updated`)] });
    }

    // ── SHARE ─────────────────────────────────────────────────
    if (sub === 'share') {
      const shareSub = args[1]?.toLowerCase();

      // share remove @user
      if (shareSub === 'remove' || shareSub === 'delete') {
        const target = message.mentions.users.first();
        if (!target) return message.channel.send({ embeds: [warn(`${author}: Mention a user to remove their share`)] });
        const record = await db.getBoosterRole(guild.id, author.id);
        if (!record) return message.channel.send({ embeds: [warn(`${author}: You don't have a booster role`)] });
        const removed = await db.removeBoosterShare(guild.id, author.id, target.id);
        if (!removed) return message.channel.send({ embeds: [warn(`${author}: **${target.username}** doesn't have a share of your role`)] });
        const role = guild.roles.cache.get(record.role_id);
        if (role) {
          const m = await guild.members.fetch(target.id).catch(() => null);
          if (m) await m.roles.remove(role).catch(() => {});
        }
        return message.channel.send({ embeds: [success(`${author}: Removed role share from **${target.username}**`)] });
      }

      // share @user
      const target = message.mentions.users.first();
      if (!target) return message.channel.send({ embeds: [warn(`${author}: Mention a user — \`${prefix}boosterrole share @user\``)] });
      if (target.id === author.id) return message.channel.send({ embeds: [warn(`${author}: You can't share your role with yourself`)] });

      const record = await db.getBoosterRole(guild.id, author.id);
      if (!record) return message.channel.send({ embeds: [warn(`${author}: No booster role — run \`${prefix}boosterrole create\``)] });

      const currentShares = await db.getBoosterShares(guild.id, author.id);
      if (currentShares.length >= maxShares)
        return message.channel.send({ embeds: [warn(`${author}: Max shares reached (**${maxShares}**) — remove a share first:\n> \`${prefix}boosterrole share remove @user\``)] });
      if (currentShares.some(s => s.target_user_id === target.id))
        return message.channel.send({ embeds: [warn(`${author}: **${target.username}** already has your role shared`)] });

      const role = guild.roles.cache.get(record.role_id);
      if (!role) return message.channel.send({ embeds: [warn(`${author}: Your booster role was not found`)] });

      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) return message.channel.send({ embeds: [warn(`${author}: That user is not in this server`)] });

      await targetMember.roles.add(role).catch(() => {});
      await db.addBoosterShare(guild.id, author.id, target.id);
      return message.channel.send({ embeds: [success(`${author}: Shared your booster role with **${target.username}** (${currentShares.length + 1}/${maxShares} shares used)`)] });
    }

    // ── DELETE ────────────────────────────────────────────────
    if (sub === 'delete' || sub === 'remove') {
      const record = await db.getBoosterRole(guild.id, author.id);
      if (!record) return message.channel.send({ embeds: [warn(`${author}: You don't have a booster role to delete`)] });
      const role = guild.roles.cache.get(record.role_id);
      if (role) await role.delete(`Deleted by ${author.tag}`).catch(() => {});
      await db.removeBoosterRole(guild.id, author.id);
      return message.channel.send({ embeds: [success(`${author}: Your booster role has been deleted`)] });
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}boosterrole\` for help.`)] });
  }
};
