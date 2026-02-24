/**
 * resolve.js — Universal user/member resolution
 *
 * Accepts any of:
 *   • @mention
 *   • User ID (17-20 digit number)
 *   • Username (exact or partial, case-insensitive, searches guild cache)
 *   • DisplayName / server nickname (partial, case-insensitive)
 *   • username#discriminator (legacy tag)
 *
 * resolveUser(guild, client, arg)   → Discord.User | null
 * resolveMember(guild, client, arg) → GuildMember  | null
 *
 * For commands that still use message.mentions, pass mention first then
 * fall back to resolveMember(guild, client, args[0]).
 */

/**
 * Attempt to resolve a GuildMember from a string argument.
 * Tries (in order): mention extract → ID → username → displayName → tag.
 */
async function resolveMember(guild, client, arg) {
  if (!arg) return null;

  // Strip mention formatting: <@123> or <@!123>
  const cleanId = arg.replace(/^<@!?(\d{17,20})>$/, '$1');

  // ID lookup — fastest path
  if (/^\d{17,20}$/.test(cleanId)) {
    const cached = guild.members.cache.get(cleanId);
    if (cached) return cached;
    return guild.members.fetch(cleanId).catch(() => null);
  }

  // Ensure guild member cache is warm (fetches up to limit)
  if (guild.members.cache.size < 2) {
    await guild.members.fetch().catch(() => {});
  }

  const lower = arg.toLowerCase().trim();

  // Exact username match
  let found = guild.members.cache.find(m =>
    m.user.username.toLowerCase() === lower ||
    m.user.tag.toLowerCase() === lower
  );
  if (found) return found;

  // Exact display-name (server nickname) match
  found = guild.members.cache.find(m =>
    (m.nickname ?? '').toLowerCase() === lower
  );
  if (found) return found;

  // Exact global display name match
  found = guild.members.cache.find(m =>
    (m.user.globalName ?? '').toLowerCase() === lower
  );
  if (found) return found;

  // Partial username match
  found = guild.members.cache.find(m =>
    m.user.username.toLowerCase().includes(lower)
  );
  if (found) return found;

  // Partial nickname match
  found = guild.members.cache.find(m =>
    (m.nickname ?? '').toLowerCase().includes(lower)
  );
  if (found) return found;

  // Global fetch by ID as last resort
  if (/^\d{17,20}$/.test(arg)) {
    return guild.members.fetch(arg).catch(() => null);
  }

  return null;
}

/**
 * Resolve a User (not necessarily in the guild) from a string argument.
 * Useful for hackban / hardban / unban where the user may not be a member.
 */
async function resolveUser(client, arg) {
  if (!arg) return null;

  const cleanId = arg.replace(/^<@!?(\d{17,20})>$/, '$1');

  if (/^\d{17,20}$/.test(cleanId)) {
    return client.users.cache.get(cleanId) ?? client.users.fetch(cleanId).catch(() => null);
  }

  const lower = arg.toLowerCase().trim();

  // Check user cache by username/tag
  return client.users.cache.find(u =>
    u.username.toLowerCase() === lower ||
    u.tag.toLowerCase() === lower ||
    (u.globalName ?? '').toLowerCase() === lower
  ) ?? null;
}

/**
 * Helper: get the first resolvable target from a message.
 * Tries message.mentions.members.first() then resolveMember(guild, client, args[0]).
 */
async function getTarget(message, args, client) {
  return (
    message.mentions.members?.first() ??
    await resolveMember(message.guild, client, args[0]) ??
    null
  );
}

/**
 * Helper: get a User (non-member) from message.
 * For commands that operate on non-present users (ban by ID, etc.)
 */
async function getTargetUser(message, args, client) {
  return (
    message.mentions.users?.first() ??
    await resolveUser(client, args[0]) ??
    null
  );
}

module.exports = { resolveMember, resolveUser, getTarget, getTargetUser };
