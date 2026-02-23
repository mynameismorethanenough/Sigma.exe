/**
 * checkPerm — Permission check with fake permission + owner bypass support
 *
 * Priority:
 *   0. Bot Owner (matchalatte_with_banana) → ALWAYS true, no check needed
 *   1. Server owner → true
 *   2. User fake DENY → false
 *   3. User fake GRANT → true
 *   4. Role fake DENY → false
 *   5. Role fake GRANT → true
 *   6. Real Discord permission
 */

const db = require('../database/db');
const { isOwner } = require('./owner');

const PERM_MAP = {
  administrator:    'Administrator',
  manage_guild:     'ManageGuild',
  manage_channels:  'ManageChannels',
  manage_roles:     'ManageRoles',
  manage_messages:  'ManageMessages',
  manage_webhooks:  'ManageWebhooks',
  manage_nicknames: 'ManageNicknames',
  manage_emojis:    'ManageEmojisAndStickers',
  kick_members:     'KickMembers',
  ban_members:      'BanMembers',
  moderate_members: 'ModerateMembers',
  mention_everyone: 'MentionEveryone',
  view_audit_log:   'ViewAuditLog',
  deafen_members:   'DeafenMembers',
  move_members:     'MoveMembers',
};

async function checkPerm(member, perm) {
  // ── OWNER PERK: bypass ALL permission checks globally ────────
  if (isOwner(member.id)) return true;

  if (member.id === member.guild.ownerId) return true;

  const allFP = await db.getFakePerms(member.guild.id).catch(() => ({ users: {}, roles: {} }));
  const users  = allFP.users ?? {};
  const roles  = allFP.roles ?? {};
  const userFP = users[member.id] ?? { grant: [], deny: [] };

  if (userFP.deny?.includes(perm))  return false;
  if (userFP.grant?.includes(perm)) return true;

  const memberRoleIds = [...member.roles.cache.keys()];
  for (const roleId of memberRoleIds) {
    if (roles[roleId]?.deny?.includes(perm)) return false;
  }
  for (const roleId of memberRoleIds) {
    if (roles[roleId]?.grant?.includes(perm)) return true;
  }

  const djsPerm = PERM_MAP[perm];
  if (djsPerm) return member.permissions.has(djsPerm);
  return false;
}

module.exports = { checkPerm, PERM_MAP };
