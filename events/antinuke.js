const { AuditLogEvent } = require('discord.js');
const db = require('../database/db');
const { isOwner } = require('../utils/owner');
const { antinukeAlert } = require('../utils/embeds');

// ── Rate tracker ──────────────────────────────────────────────
const tracker = new Map();
const punished = new Map();
const messageCache = new Map();

function track(guildId, userId, action, limit, windowMs = 10_000) {
  if (!tracker.has(guildId)) tracker.set(guildId, new Map());
  const gMap = tracker.get(guildId);
  if (!gMap.has(userId)) gMap.set(userId, new Map());
  const uMap = gMap.get(userId);
  const now = Date.now();
  const entry = uMap.get(action) ?? { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 1; entry.resetAt = now + windowMs; }
  else entry.count++;
  uMap.set(action, entry);
  return entry.count >= limit;
}

function wasRecentlyPunished(guildId, userId) {
  return punished.get(guildId)?.has(userId) ?? false;
}

function markPunished(guildId, userId, ttlMs = 15_000) {
  if (!punished.has(guildId)) punished.set(guildId, new Set());
  punished.get(guildId).add(userId);
  setTimeout(() => punished.get(guildId)?.delete(userId), ttlMs);
}

async function punish(guild, executorId, punishment, reason) {
  if (executorId === guild.ownerId) return;
  if (executorId === guild.client.user.id) return;
  if (wasRecentlyPunished(guild.id, executorId)) return;
  markPunished(guild.id, executorId);
  try {
    switch (punishment) {
      case 'ban':
        await guild.bans.create(executorId, { reason, deleteMessageSeconds: 0 }); break;
      case 'kick': {
        const m = await guild.members.fetch(executorId).catch(() => null);
        if (m) await m.kick(reason); break;
      }
      case 'strip': {
        const m = await guild.members.fetch(executorId).catch(() => null);
        if (m) await m.roles.set([], reason); break;
      }
      case 'timeout': {
        const m = await guild.members.fetch(executorId).catch(() => null);
        if (m) await m.timeout(28 * 24 * 60 * 60 * 1000, reason); break;
      }
    }
    console.log(`[Antinuke] Punished ${executorId} in ${guild.name} — ${reason}`);
  } catch (err) {
    console.error(`[Antinuke] Failed to punish ${executorId}:`, err.message);
  }
}

async function sendAlert(guild, embed) {
  try {
    const cfg = await db.getGuild(guild.id);
    if (!cfg?.log_channel) return;
    const ch = guild.channels.cache.get(cfg.log_channel);
    if (ch?.isTextBased()) await ch.send({ embeds: [embed] });
  } catch { /* silent */ }
}

async function getExecutor(guild, auditAction, targetId = null, windowMs = 8000) {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 5, type: auditAction });
    for (const entry of logs.entries.values()) {
      if (Date.now() - entry.createdTimestamp > windowMs) continue;
      if (targetId && entry.target?.id && entry.target.id !== targetId) continue;
      return entry.executor;
    }
    return null;
  } catch { return null; }
}

module.exports = (client) => {

  // 1. ANTI CHANNEL DELETE
  client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const { guild } = channel;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(guild, AuditLogEvent.ChannelDelete, channel.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'channelDelete', cfg.channel_delete_limit)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass channel deletion');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Channel Delete', executor, target: `#${channel.name}`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 2. ANTI CHANNEL CREATE
  client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const { guild } = channel;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(guild, AuditLogEvent.ChannelCreate, channel.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'channelCreate', cfg.channel_create_limit)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass channel creation');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Channel Create', executor, target: `#${channel.name}`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 3. ANTI ROLE DELETE
  client.on('roleDelete', async (role) => {
    const { guild } = role;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(guild, AuditLogEvent.RoleDelete, role.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'roleDelete', cfg.role_delete_limit)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass role deletion');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Role Delete', executor, target: `@${role.name}`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 4. ANTI ROLE CREATE
  client.on('roleCreate', async (role) => {
    const { guild } = role;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(guild, AuditLogEvent.RoleCreate, role.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'roleCreate', cfg.role_create_limit)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass role creation');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Role Create', executor, target: `@${role.name}`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 5. ANTI ROLE RENAME
  client.on('roleUpdate', async (oldRole, newRole) => {
    const { guild } = newRole;
    if (oldRole.name === newRole.name) return;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'roleRename', cfg.role_rename_limit ?? 3)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass role renaming');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Role Rename', executor, target: `${oldRole.name} → ${newRole.name}`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 6. ANTI BAN
  client.on('guildBanAdd', async (ban) => {
    const { guild } = ban;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'ban', cfg.ban_limit)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass ban');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Ban', executor, target: ban.user.tag, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 7. ANTI KICK
  client.on('guildMemberRemove', async (member) => {
    if (member.user.bot) return;
    const { guild } = member;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    await new Promise(r => setTimeout(r, 800));
    const executor = await getExecutor(guild, AuditLogEvent.MemberKick, member.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'kick', cfg.kick_limit ?? 3)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass kick');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Kick', executor, target: member.user.tag, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 8. ANTI BOT ADD
  client.on('guildMemberAdd', async (member) => {
    if (!member.user.bot) return;
    const { guild } = member;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    await new Promise(r => setTimeout(r, 1500));
    const executor = await getExecutor(guild, AuditLogEvent.BotAdd, member.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'botAdd', cfg.bot_add_limit)) return;
    await member.kick('[Antinuke] Unauthorized bot addition').catch(() => {});
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Unauthorized bot addition');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Bot Add', executor, target: `${member.user.tag} (bot)`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 9. ANTI PRUNE
  client.on('guildAuditLogEntryCreate', async (entry, guild) => {
    if (entry.action !== AuditLogEvent.MemberPrune) return;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = entry.executor;
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    const pruned = entry.extra?.removed ?? 1;
    if (pruned < (cfg.prune_limit ?? 5)) return;
    await punish(guild, executor.id, cfg.punishment, `[Antinuke] Mass prune (${pruned} members)`);
    await sendAlert(guild, antinukeAlert({ action: 'Anti Prune', executor, target: `${pruned} members pruned`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 10. ANTI WEBHOOK CREATE
  client.on('webhooksUpdate', async (channel) => {
    if (!channel.guild) return;
    const { guild } = channel;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(guild, AuditLogEvent.WebhookCreate);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'webhookCreate', cfg.webhook_create_limit)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass webhook creation');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Webhook Create', executor, target: `#${channel.name}`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 11. ANTI SERVER RENAME + ANTI VANITY CHANGE
  client.on('guildUpdate', async (oldGuild, newGuild) => {
    const cfg = await db.getAntinukeConfig(newGuild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(newGuild, AuditLogEvent.GuildUpdate);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(newGuild.id, executor.id)) return;

    if (oldGuild.name !== newGuild.name) {
      if (track(newGuild.id, executor.id, 'serverRename', cfg.server_rename_limit ?? 2)) {
        await punish(newGuild, executor.id, cfg.punishment, '[Antinuke] Rapid server renaming');
        await sendAlert(newGuild, antinukeAlert({ action: 'Anti Server Rename', executor, target: `"${oldGuild.name}" → "${newGuild.name}"`, punishment: cfg.punishment, guildName: newGuild.name }));
      }
    }

    if ((cfg.vanity_enabled ?? true) && oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
      if (oldGuild.vanityURLCode) {
        await newGuild.setVanityCode(oldGuild.vanityURLCode, '[Antinuke] Unauthorized vanity change').catch(() => {});
      }
      await punish(newGuild, executor.id, cfg.punishment, '[Antinuke] Unauthorized vanity URL change');
      await sendAlert(newGuild, antinukeAlert({ action: 'Anti Vanity Change', executor, target: `/${oldGuild.vanityURLCode ?? 'none'} → /${newGuild.vanityURLCode ?? 'none'}`, punishment: cfg.punishment, guildName: newGuild.name }));
    }
  });

  // 12. ANTI INVITE DELETE
  client.on('inviteDelete', async (invite) => {
    if (!invite.guild) return;
    const { guild } = invite;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const executor = await getExecutor(guild, AuditLogEvent.InviteDelete);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (!track(guild.id, executor.id, 'inviteDelete', cfg.invite_delete_limit ?? 3)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Mass invite deletion');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Invite Delete', executor, target: invite.code, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 13. ANTI MENTION (mass ping)
  client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    const { guild } = message;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    if (await db.isWhitelisted(guild.id, message.author.id)) return;
    const mentionCount = message.mentions.users.size + message.mentions.roles.size
      + (message.mentions.everyone ? 1 : 0);
    if (mentionCount < (cfg.mention_limit ?? 10)) return;
    await message.delete().catch(() => {});
    await punish(guild, message.author.id, cfg.punishment, `[Antinuke] Mass mention (${mentionCount} pings)`);
    await sendAlert(guild, antinukeAlert({ action: 'Anti Mass Mention', executor: message.author, target: `${mentionCount} mentions in one message`, punishment: cfg.punishment, guildName: guild.name }));
  });

  // 14. ANTI GHOST PING — cache messages, detect on delete
  client.on('messageCreate', (message) => {
    if (!message.guild || message.author.bot) return;
    const hasMentions = message.mentions.users.size > 0 || message.mentions.roles.size > 0;
    if (!hasMentions) return;
    messageCache.set(message.id, {
      content:   message.content,
      mentions:  [...message.mentions.users.values()].map(u => u.tag),
      authorId:  message.author.id,
      authorTag: message.author.tag,
      guildId:   message.guild.id,
      channelId: message.channel.id,
    });
    setTimeout(() => messageCache.delete(message.id), 30_000);
  });

  client.on('messageDelete', async (message) => {
    if (!message.guild) return;
    const cached = messageCache.get(message.id);
    if (!cached) return;
    messageCache.delete(message.id);
    const cfg = await db.getAntinukeConfig(cached.guildId).catch(() => null);
    if (!cfg?.enabled || !(cfg.ghost_ping_enabled ?? true)) return;
    if (await db.isWhitelisted(cached.guildId, cached.authorId)) return;
    const guild = client.guilds.cache.get(cached.guildId);
    const channel = client.channels.cache.get(cached.channelId);
    if (!guild || !channel) return;
    const embed = antinukeAlert({
      action: 'Ghost Ping Detected',
      executor: { tag: cached.authorTag, id: cached.authorId },
      target: `Pinged: ${cached.mentions.slice(0, 5).join(', ')}`,
      punishment: 'alert only',
      guildName: guild.name,
    });
    await sendAlert(guild, embed);
    channel.send({ embeds: [embed] }).catch(() => {});
  });

  // 15. ANTI DANGEROUS ROLE ADD
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const { guild } = newMember;
    const cfg = await db.getAntinukeConfig(guild.id).catch(() => null);
    if (!cfg?.enabled) return;
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const dangerousPerms = ['Administrator', 'BanMembers', 'ManageGuild', 'ManageRoles', 'KickMembers', 'MentionEveryone'];
    const isDangerous = addedRoles.some(r => dangerousPerms.some(p => r.permissions.has(p)));
    if (!isDangerous) return;
    await new Promise(r => setTimeout(r, 1000));
    const executor = await getExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
    if (!executor || executor.id === client.user.id) return;
    if (await db.isWhitelisted(guild.id, executor.id)) return;
    if (newMember.id === guild.ownerId) return;
    if (!track(guild.id, executor.id, 'roleGrant', 2)) return;
    await punish(guild, executor.id, cfg.punishment, '[Antinuke] Dangerous permission grant');
    await sendAlert(guild, antinukeAlert({ action: 'Anti Dangerous Role Add', executor, target: newMember.user.tag, punishment: cfg.punishment, guildName: guild.name }));
  });

  console.log('🛡️  Antinuke loaded — 15 protections active');
};
