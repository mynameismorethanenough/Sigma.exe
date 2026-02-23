/**
 * fakepermissions — Set fake permissions for roles/users
 *
 * fakepermissions list
 * fakepermissions add (role/@user) (permission)
 * fakepermissions remove (role/@user) (permission)
 * fakepermissions reset                           — clear all in server
 * fakepermissions reset (role/@user)              — clear for one entity
 */
const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

const VALID_PERMS = [
  'administrator', 'manage_guild', 'manage_channels', 'manage_roles',
  'manage_messages', 'manage_webhooks', 'manage_nicknames', 'manage_emojis',
  'kick_members', 'ban_members', 'moderate_members', 'mention_everyone',
  'view_audit_log', 'deafen_members', 'move_members',
];

async function resolveTarget(message, client, idArg) {
  const userMention = message.mentions.users.first();
  if (userMention) return { kind: 'user', id: userMention.id, label: userMention.tag };
  const roleMention = message.mentions.roles.first();
  if (roleMention) return { kind: 'role', id: roleMention.id, label: `@${roleMention.name}` };
  if (!idArg || !/^\d{17,20}$/.test(idArg)) return null;
  const roleById = message.guild.roles.cache.get(idArg);
  if (roleById) return { kind: 'role', id: roleById.id, label: `@${roleById.name}` };
  const userById = await client.users.fetch(idArg).catch(() => null);
  if (userById) return { kind: 'user', id: userById.id, label: userById.tag };
  return null;
}

module.exports = {
  name: 'fakepermissions',
  aliases: ['fakeperm', 'fp', 'fakepermission'],
  category: 'configuration',

  run: async (client, message, args, prefix) => {
    const { guild, author } = message;
    // Only server owner can manage fake permissions
    if (message.author.id !== guild.ownerId) {
      const { isOwner } = require('../../utils/owner');
      if (!isOwner(message.author.id))
        return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: Only the **server owner** can manage fake permissions`)] });
    }

    await db.ensureGuild(guild.id, guild.name);
    const sub = args[0]?.toLowerCase();

    if (!sub) return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('🔑 Fake Permissions')
      .setDescription('Override bot-level permissions for users or roles without touching real Discord permissions.\n> **Priority:** User deny > User grant > Role deny > Role grant > Real Discord perm')
      .addFields(
        { name: '📋 Subcommands', value: [
          `\`${prefix}fakepermissions list\` — view all overrides`,
          `\`${prefix}fakepermissions add @role/@user <perm>\` — grant a permission`,
          `\`${prefix}fakepermissions remove @role/@user <perm>\` — deny/revoke`,
          `\`${prefix}fakepermissions reset\` — clear ALL overrides in server`,
          `\`${prefix}fakepermissions reset @role/@user\` — clear for one`,
        ].join('\n') },
        { name: '🔑 Valid Permissions', value: VALID_PERMS.map(p => `\`${p}\``).join(' ') },
        { name: '💡 Example', value: `\`${prefix}fp add @Moderators kick_members\`` },
      )] });

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const all = await db.getFakePerms(guild.id);
      const users = all.users ?? {}, roles = all.roles ?? {};
      const hasUsers = Object.keys(users).length > 0;
      const hasRoles = Object.keys(roles).length > 0;
      if (!hasUsers && !hasRoles)
        return message.channel.send({ embeds: [base(Colors.neutral).setDescription('No fake permission overrides set in this server')] });
      const fields = [];
      if (hasUsers) {
        const lines = Object.entries(users).map(([uid, p]) => {
          const g = p.grant?.length ? `✅ ${p.grant.join(', ')}` : null;
          const d = p.deny?.length  ? `❌ ${p.deny.join(', ')}`  : null;
          return `<@${uid}>\n${[g,d].filter(Boolean).join('\n')}`;
        });
        fields.push({ name: '👤 User Overrides', value: lines.join('\n\n').slice(0, 1024) });
      }
      if (hasRoles) {
        const lines = Object.entries(roles).map(([rid, p]) => {
          const g = p.grant?.length ? `✅ ${p.grant.join(', ')}` : null;
          const d = p.deny?.length  ? `❌ ${p.deny.join(', ')}`  : null;
          return `<@&${rid}>\n${[g,d].filter(Boolean).join('\n')}`;
        });
        fields.push({ name: '🏷️ Role Overrides', value: lines.join('\n\n').slice(0, 1024) });
      }
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle(`${guild.name} — Fake Permission Overrides`)
        .addFields(...fields)
        .setFooter({ text: `${Object.keys(users).length} user(s) • ${Object.keys(roles).length} role(s)` })] });
    }

    // ── RESET ─────────────────────────────────────────────────
    if (sub === 'reset' || sub === 'clear') {
      if (!args[1]) {
        // Reset everything
        await db.clearAllFakePerms(guild.id, 'user', null);
        await db.clearAllFakePerms(guild.id, 'role', null);
        // Wipe the JSONB column cleanly
        const { q } = require('../../database/db');
        await db.setFakePerm?.(guild.id, '_reset_', '_reset_', 'grant', null).catch(() => {});
        // More reliable: update directly
        try { await require('../../database/db').q('UPDATE guild_settings SET fake_permissions=$1 WHERE guild_id=$2', ['{}', guild.id]); } catch {}
        return message.channel.send({ embeds: [success(`${author}: All fake permissions cleared for **${guild.name}**`)] });
      }
      const target = await resolveTarget(message, client, args[1]);
      if (!target) return message.channel.send({ embeds: [warn(`${author}: Mention a user or role, or provide their ID`)] });
      await db.clearAllFakePerms(guild.id, target.kind, target.id);
      return message.channel.send({ embeds: [success(`${author}: All fake permission overrides cleared for **${target.label}**`)] });
    }

    // ── ADD (grant) ───────────────────────────────────────────
    if (sub === 'add' || sub === 'grant') {
      const target = await resolveTarget(message, client, args[1]);
      if (!target) return message.channel.send({ embeds: [warn(`${author}: Mention a user/role — \`${prefix}fakepermissions add @role <perm>\``)] });
      const perm = args.find((a, i) => i > 0 && !a.startsWith('<') && !a.match(/^\d{17,20}$/))?.toLowerCase();
      if (!perm) return message.channel.send({ embeds: [warn(`${author}: Provide a permission name — e.g. \`kick_members\``)] });
      if (!VALID_PERMS.includes(perm)) return message.channel.send({ embeds: [warn(`${author}: Invalid permission \`${perm}\`\nValid: ${VALID_PERMS.map(p=>`\`${p}\``).join(' ')}`)] });
      if (target.kind === 'user' && target.id === guild.ownerId)
        return message.channel.send({ embeds: [warn(`${author}: The server owner cannot be overridden`)] });
      await db.setFakePerm(guild.id, target.kind, target.id, 'grant', perm);
      const icon = target.kind === 'role' ? '🏷️' : '👤';
      return message.channel.send({ embeds: [success(`${author}: ${icon} Granted \`${perm}\` to **${target.label}**`)] });
    }

    // ── REMOVE (deny/revoke) ──────────────────────────────────
    if (sub === 'remove' || sub === 'deny' || sub === 'revoke') {
      const target = await resolveTarget(message, client, args[1]);
      if (!target) return message.channel.send({ embeds: [warn(`${author}: Mention a user/role — \`${prefix}fakepermissions remove @role <perm>\``)] });
      const perm = args.find((a, i) => i > 0 && !a.startsWith('<') && !a.match(/^\d{17,20}$/))?.toLowerCase();
      if (!perm) return message.channel.send({ embeds: [warn(`${author}: Provide a permission name`)] });
      if (!VALID_PERMS.includes(perm)) return message.channel.send({ embeds: [warn(`${author}: Invalid permission \`${perm}\``)] });
      await db.clearFakePerm(guild.id, target.kind, target.id, perm);
      const icon = target.kind === 'role' ? '🏷️' : '👤';
      return message.channel.send({ embeds: [success(`${author}: ${icon} Removed \`${perm}\` override from **${target.label}**`)] });
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}fakepermissions\` for help.`)] });
  }
};
