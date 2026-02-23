const db = require('../database/db');

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

module.exports = (client) => {

  // ── Ready ──────────────────────────────────────────────────────
  client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is ready!`);
    console.log(`📡 Serving ${client.guilds.cache.size} guilds`);

    // Sync all guilds
    for (const guild of client.guilds.cache.values()) {
      await db.ensureGuild(guild.id, guild.name).catch(() => {});
    }

    // Cache all invites for invite tracking
    for (const guild of client.guilds.cache.values()) {
      try {
        const invites = await guild.invites.fetch();
        const map = new Map();
        for (const invite of invites.values()) map.set(invite.code, invite.uses);
        client.inviteCache.set(guild.id, map);
      } catch { /* missing perms, skip */ }
    }

    // ── Birthday announcer — check every hour at :00 ────────────
    async function checkBirthdays() {
      for (const guild of client.guilds.cache.values()) {
        try {
          const cfg  = await require('../database/db').getBirthdayConfig(guild.id);
          if (!cfg?.channel_id) continue;
          const ch   = guild.channels.cache.get(cfg.channel_id);
          if (!ch?.isTextBased()) continue;
          const rows = await require('../database/db').getTodayBirthdays(guild.id);
          for (const row of rows) {
            const member = await guild.members.fetch(row.user_id).catch(() => null);
            if (!member) continue;
            const msg = (cfg.message ?? 'Happy Birthday {user}! 🎂')
              .replace('{user}',   `${member}`)
              .replace('{name}',   member.user.username)
              .replace('{server}', guild.name);
            await ch.send({ content: `🎂 ${msg}` }).catch(() => {});
            // Give birthday role if configured
            if (cfg.role_id) {
              const role = guild.roles.cache.get(cfg.role_id);
              if (role) await member.roles.add(role).catch(() => {});
              // Remove role after 24h
              setTimeout(async () => {
                const m = await guild.members.fetch(member.id).catch(() => null);
                if (m && role) await m.roles.remove(role).catch(() => {});
              }, 86400000);
            }
          }
        } catch { /* silent */ }
      }
    }

    // Run at next full hour, then every hour
    const now = new Date();
    const msToNextHour = (3600 - (now.getMinutes() * 60 + now.getSeconds())) * 1000;
    setTimeout(() => {
      checkBirthdays();
      setInterval(checkBirthdays, 3600000);
    }, msToNextHour);

    client.user.setPresence({
      activities: [{ name: `${client.guilds.cache.size} servers | ,help`, type: 3 }],
      status: 'dnd',
    });

    // Set bot bio / about me (credits to Korpse)
    try {
      await client.rest.patch('/users/@me', {
        body: { bio: 'Made with love by Korpse ♡\n@matchalatte_with_banana' }
      });
    } catch { /* bio update not supported for all bot tiers — skip silently */ }

    // Auto-unjail check every minute
    setInterval(async () => {
      try {
        const expired = await db.getExpiredJails();
        for (const jail of expired) {
          const guild = client.guilds.cache.get(jail.guild_id);
          if (!guild) continue;
          const cfg = await db.getJailConfig(jail.guild_id).catch(() => null);
          if (!cfg?.jail_role_id) continue;

          const member = await guild.members.fetch(jail.user_id).catch(() => null);
          const prevRoles = jail.previous_roles ? JSON.parse(jail.previous_roles) : [];
          await db.unjailMember(jail.guild_id, jail.user_id);

          if (member) {
            // Restore all saved roles atomically — do NOT check manageable, just attempt all
            const rolesToRestore = prevRoles
              .map(id => guild.roles.cache.get(id))
              .filter(r => r && r.id !== guild.id);
            await member.roles.set(rolesToRestore, '[Auto-unjail] Time expired').catch(async () => {
              // Fallback: remove jail role + add each role individually
              const jailRole = guild.roles.cache.get(cfg.jail_role_id);
              if (jailRole) await member.roles.remove(jailRole).catch(() => {});
              for (const role of rolesToRestore) {
                await member.roles.add(role).catch(() => {});
              }
            });
            const guildData = await db.getGuild(jail.guild_id).catch(() => null);
            if (guildData?.log_channel) {
              const ch = guild.channels.cache.get(guildData.log_channel);
              ch?.send({ embeds: [{ color: 0xa3eb7b, description: `🔓 **${member.user.tag}** has been automatically unjailed (time expired)`, timestamp: new Date().toISOString() }] }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('[Auto-unjail] Error:', err.message);
      }
    }, 60_000);
  });

  // ── Guild join ─────────────────────────────────────────────────
  client.on('guildCreate', async guild => {
    await db.ensureGuild(guild.id, guild.name).catch(() => {});

    // Cache invites
    try {
      const invites = await guild.invites.fetch();
      const map = new Map();
      for (const invite of invites.values()) map.set(invite.code, invite.uses);
      client.inviteCache.set(guild.id, map);
    } catch {}

    let ch;
    for (const channel of guild.channels.cache.values()) {
      if (channel.isTextBased() && channel.permissionsFor(guild.members.me)?.has('SendMessages')) { ch = channel; break; }
    }
    ch?.send({ embeds: [{ color: 0x95a5a6, thumbnail: { url: client.user.displayAvatarURL({ size: 2048 }) }, title: `Getting started with ${client.user.username}`, description: `My default prefix is \`,\` — change it with \`,prefix <new>\``, fields: [{ name: '🔨 Moderation', value: '`,ban` `,kick` `,mute` `,jail`', inline: true }, { name: '🛡️ Security', value: '`,antinuke`', inline: true }, { name: '📋 Logs', value: '`,logs channel #channel`', inline: true }] }] }).catch(() => {});
  });

  // ── Snipe: deleted messages ─────────────────────────────────
  client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot || message.partial) return;
    const imageUrl = message.attachments.first()?.proxyURL ?? null;
    await db.setSnipe(message.channel.id, message.content ?? '', message.author.tag, message.author.displayAvatarURL({ dynamic: true }), imageUrl).catch(() => {});

    const guildData = await db.getGuild(message.guild.id).catch(() => null);
    if (!guildData?.log_channel) return;
    const logCh = message.guild.channels.cache.get(guildData.log_channel);
    logCh?.send({ embeds: [{ color: 0xfe6464, author: { name: message.author.tag, icon_url: message.author.displayAvatarURL({ dynamic: true }) }, title: '🗑️ Message Deleted', description: message.content || '*[attachment only]*', footer: { text: `#${message.channel.name} • ID: ${message.author.id}` }, timestamp: new Date().toISOString() }] }).catch(() => {});
  });

  // ── Member join: welcome, autorole, joindm, invite tracking ────
  client.on('guildMemberAdd', async member => {
    const { guild } = member;
    await db.ensureGuild(guild.id, guild.name).catch(() => {});
    const settings = await db.getSettings(guild.id).catch(() => null);

    // Autorole
    if (settings?.autorole_id) {
      const role = guild.roles.cache.get(settings.autorole_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    // Auto-nickname
    if (settings?.autonick_format) {
      const nick = settings.autonick_format
        .replace('{name}', member.user.username)
        .replace('{tag}',  member.user.tag)
        .replace('{id}',   member.id)
        .slice(0, 32);
      await member.setNickname(nick, 'Autonick').catch(() => {});
    }

    // Welcome message
    if (settings?.welcome_channel && settings?.welcome_message) {
      const ch = guild.channels.cache.get(settings.welcome_channel);
      if (ch?.isTextBased()) {
        const count = guild.memberCount;
        const msg = settings.welcome_message
          .replace('{user}', `<@${member.id}>`)
          .replace('{user.name}', member.user.username)
          .replace('{user.tag}', member.user.tag)
          .replace('{user.id}', member.id)
          .replace('{membercount}', count)
          .replace('{membercount.ordinal}', ordinal(count))
          .replace('{guild.name}', guild.name)
          .replace('{guild.id}', guild.id);
        ch.send(msg).catch(() => {});
      }
    }

    // Join DM
    if (settings?.joindm_message) {
      const msg = settings.joindm_message
        .replace('{user.mention}', `<@${member.id}>`)
        .replace('{user}', member.user.username)
        .replace('{user.tag}', member.user.tag)
        .replace('{guild.name}', guild.name)
        .replace('{guild.id}', guild.id);
      member.user.send(msg).catch(() => {});
    }

    // ── Invite tracking ──────────────────────────────────────────
    try {
      const newInvites = await guild.invites.fetch();
      const cachedMap = client.inviteCache.get(guild.id) ?? new Map();
      let usedCode = null, inviterId = null;

      for (const invite of newInvites.values()) {
        const cached = cachedMap.get(invite.code) ?? 0;
        if (invite.uses > cached) {
          usedCode = invite.code;
          inviterId = invite.inviter?.id ?? null;
          break;
        }
      }

      // Update cache
      const updatedMap = new Map();
      for (const invite of newInvites.values()) updatedMap.set(invite.code, invite.uses);
      client.inviteCache.set(guild.id, updatedMap);

      if (usedCode && inviterId) {
        await db.logInviteUse(guild.id, member.id, inviterId, usedCode).catch(() => {});
      }
    } catch { /* missing perms */ }

    // Log
    const guildData = await db.getGuild(guild.id).catch(() => null);
    if (guildData?.log_channel) {
      const logCh = guild.channels.cache.get(guildData.log_channel);
      const created = Math.floor(member.user.createdTimestamp / 1000);
      logCh?.send({ embeds: [{ color: 0xa3eb7b, author: { name: member.user.tag, icon_url: member.user.displayAvatarURL({ dynamic: true }) }, description: `<@${member.id}> joined **${guild.name}**\n> Account created <t:${created}:R>`, footer: { text: `Members: ${guild.memberCount}` }, timestamp: new Date().toISOString() }] }).catch(() => {});
    }
  });

  // ── Member leave log ───────────────────────────────────────────
  client.on('guildMemberRemove', async member => {
    const guildData = await db.getGuild(member.guild.id).catch(() => null);
    if (!guildData?.log_channel) return;
    const logCh = member.guild.channels.cache.get(guildData.log_channel);
    logCh?.send({ embeds: [{ color: 0xfe6464, author: { name: member.user.tag, icon_url: member.user.displayAvatarURL({ dynamic: true }) }, description: `<@${member.id}> left **${member.guild.name}**`, footer: { text: `Members: ${member.guild.memberCount}` }, timestamp: new Date().toISOString() }] }).catch(() => {});
  });

  // ── Voice state tracking ───────────────────────────────────────
  client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member?.id ?? oldState.member?.id;
    if (!userId || newState.member?.user.bot) return;

    const guildId = newState.guild.id;

    // Joined a channel
    if (!oldState.channelId && newState.channelId) {
      await db.openVoiceSession(guildId, userId, newState.channelId, newState.channel?.name ?? '').catch(() => {});
    }
    // Left a channel
    else if (oldState.channelId && !newState.channelId) {
      await db.closeVoiceSession(guildId, userId).catch(() => {});
    }
    // Switched channels
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await db.closeVoiceSession(guildId, userId).catch(() => {});
      await db.openVoiceSession(guildId, userId, newState.channelId, newState.channel?.name ?? '').catch(() => {});
    }
  });

  // ── Invite create/delete cache update ─────────────────────────
  client.on('inviteCreate', async invite => {
    if (!invite.guild) return;
    const map = client.inviteCache.get(invite.guild.id) ?? new Map();
    map.set(invite.code, invite.uses ?? 0);
    client.inviteCache.set(invite.guild.id, map);
    await db.upsertInvite(invite.guild.id, invite.code, invite.inviter?.id ?? null, invite.uses ?? 0).catch(() => {});
  });

  client.on('inviteDelete', async invite => {
    if (!invite.guild) return;
    const map = client.inviteCache.get(invite.guild.id);
    if (map) map.delete(invite.code);
  });
};
