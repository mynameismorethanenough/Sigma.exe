/**
 * owner — Bot owner control panel (absolute power)
 * Only accessible by: matchalatte_with_banana (1365744417465696437)
 *
 * Subcommands:
 *   owner / panel            — dashboard
 *   owner perks              — list perks
 *   owner noprefix           — toggle no-prefix mode
 *   owner eval <code>        — run JavaScript
 *   owner guilds [page]      — list all servers
 *   owner leave <guildId>    — force-leave a server
 *   owner stats              — runtime stats
 *   owner setstatus <t> <txt>— change bot activity
 *   owner setavatar <url>    — change avatar
 *   owner broadcast <msg>    — DM all guild owners
 *   owner dm <id> <msg>      — DM any user
 *   owner resetprefix <gid>  — reset server prefix
 *   owner blacklist <add/remove/list>
 *   owner gban <id> [reason] — ban from ALL servers
 *   owner gunban <id>        — unban from ALL servers
 *   owner massban <ids...>   — ban many users in current server
 *   owner lock <guildId> <channelId>    — remote channel lock
 *   owner unlock <guildId> <channelId>  — remote channel unlock
 *   owner antinuke <guildId> <enable/disable/status>
 *   owner spy <guildId>      — view any server's full config
 *   owner shutdown           — stop the bot
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isOwner, OWNER_PERKS, isNoPrefixEnabled, toggleNoPrefix } = require('../../utils/owner');
const db = require('../../database/db');
const os = require('os');

const PANEL_COLOR  = 0xf5c518;
const DANGER_COLOR = 0xed4245;
const INFO_COLOR   = 0x5865f2;
const OK_COLOR     = 0x57f287;

function formatUptime(secs) {
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

function panelEmbed(client, user) {
  return new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setAuthor({ name: `👑 Owner Panel — ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
    .setTitle(`${client.user.username} — Owner Control Panel`)
    .setDescription([
      `> Welcome back, **matchalatte_with_banana** 🍵  •  No-prefix: ${isNoPrefixEnabled() ? '**ON** ✅' : '**OFF** ❌'}`,
      '> You have **absolute power** over this bot and every server it\'s in.',
      '',
      '**📊 Quick Stats**',
      `> Servers: \`${client.guilds.cache.size}\`  |  Users: \`${client.users.cache.size}\`  |  Ping: \`${client.ws.ping}ms\``,
      `> Memory: \`${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\`  |  Uptime: \`${formatUptime(process.uptime())}\``,
    ].join('\n'))
    .addFields(
      { name: '⚡ Core Commands', inline: true, value: [
        '`owner eval <code>`',
        '`owner guilds [page]`',
        '`owner leave <id>`',
        '`owner broadcast <msg>`',
        '`owner dm <id> <msg>`',
      ].join('\n') },
      { name: '💀 Power Commands', inline: true, value: [
        '`owner gban <id> [reason]`',
        '`owner gunban <id>`',
        '`owner massban <id> [id]...`',
        '`owner lock <gId> <chId>`',
        '`owner unlock <gId> <chId>`',
      ].join('\n') },
      { name: '🛡️ Remote Control', inline: true, value: [
        '`owner antinuke <gId> <on/off>`',
        '`owner spy <guildId>`',
        '`owner resetprefix <gId>`',
        '`owner blacklist add/remove/list`',
        '`owner shutdown`',
      ].join('\n') },
    )
    .setFooter({ text: `Owner: matchalatte_with_banana • ${new Date().toUTCString()}` })
    .setTimestamp();
}

function perksEmbed(user) {
  return new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setAuthor({ name: `👑 Owner Perks — ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setTitle('✨ Your Exclusive Perks')
    .setDescription(OWNER_PERKS.join('\n'))
    .setFooter({ text: 'These perks are active globally at all times' })
    .setTimestamp();
}

function panelRows() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('op_perks').setLabel('✨ Perks').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('op_guilds').setLabel('🌐 Guilds').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('op_stats').setLabel('📊 Stats').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('op_blacklist').setLabel('🔇 Blacklist').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('op_noprefix')
      .setLabel(isNoPrefixEnabled() ? '⚡ No-Prefix: ON' : '⚡ No-Prefix: OFF')
      .setStyle(isNoPrefixEnabled() ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('op_home').setLabel('🏠 Refresh').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

module.exports = {
  name: 'owner',
  aliases: ['op', 'ownerpanel'],
  category: 'owner',

  run: async (client, message, args) => {
    if (!isOwner(message.author.id)) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
          .setDescription('❌ This command is restricted to the **bot owner** only.')]
      });
    }

    const { author, channel } = message;
    const sub = args[0]?.toLowerCase();

    // ── PANEL ─────────────────────────────────────────────────
    if (!sub || sub === 'panel') {
      const msg = await channel.send({ embeds: [panelEmbed(client, author)], components: panelRows() });
      const col = msg.createMessageComponentCollector({
        filter: i => i.user.id === author.id, time: 120_000,
      });
      col.on('collect', async i => {
        if (i.customId === 'op_home') return i.update({ embeds: [panelEmbed(client, author)], components: panelRows() });
        if (i.customId === 'op_perks') return i.update({ embeds: [perksEmbed(author)], components: panelRows() });
        if (i.customId === 'op_noprefix') { toggleNoPrefix(); return i.update({ embeds: [panelEmbed(client, author)], components: panelRows() }); }
        if (i.customId === 'op_guilds') {
          const lines = [...client.guilds.cache.values()].slice(0, 15).map((g, idx) =>
            `\`${idx+1}.\` **${g.name}** \`${g.id}\` — \`${g.memberCount}\` members`);
          return i.update({ embeds: [new EmbedBuilder().setColor(INFO_COLOR)
            .setTitle(`🌐 Servers (${client.guilds.cache.size})`).setDescription(lines.join('\n'))], components: panelRows() });
        }
        if (i.customId === 'op_stats') {
          const mem = process.memoryUsage();
          return i.update({ embeds: [new EmbedBuilder().setColor(INFO_COLOR).setTitle('📊 Runtime Stats')
            .addFields(
              { name: '🤖 Bot',    inline: true, value: `**Guilds:** \`${client.guilds.cache.size}\`\n**Users:** \`${client.users.cache.size}\`\n**Ping:** \`${client.ws.ping}ms\`\n**Uptime:** \`${formatUptime(process.uptime())}\`` },
              { name: '💾 Memory', inline: true, value: `**Heap:** \`${Math.round(mem.heapUsed/1024/1024)}MB / ${Math.round(mem.heapTotal/1024/1024)}MB\`\n**RSS:** \`${Math.round(mem.rss/1024/1024)}MB\`` },
              { name: '🖥️ System', inline: true, value: `**Platform:** \`${os.platform()}\`\n**CPUs:** \`${os.cpus().length}\`\n**RAM:** \`${Math.round(os.freemem()/1024/1024/1024)}/${Math.round(os.totalmem()/1024/1024/1024)} GB\`` },
            )], components: panelRows() });
        }
        if (i.customId === 'op_blacklist') {
          const bl = await db.getBlacklist().catch(() => []);
          const desc = bl.length ? bl.slice(0,20).map((b,idx) => `\`${idx+1}.\` <@${b.user_id}> \`${b.user_id}\`\n> ${b.reason}`).join('\n') : '`No users blacklisted`';
          return i.update({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
            .setTitle(`🔇 Global Blacklist (${bl.length})`).setDescription(desc)], components: panelRows() });
        }
      });
      col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
      return;
    }

    // ── PERKS ─────────────────────────────────────────────────
    if (sub === 'perks') return channel.send({ embeds: [perksEmbed(author)] });

    // ── NOPREFIX ──────────────────────────────────────────────
    if (sub === 'noprefix' || sub === 'np') {
      const nowOn = toggleNoPrefix();
      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(nowOn ? OK_COLOR : 0x36393f)
        .setTitle(`⚡ No-Prefix Mode: ${nowOn ? 'ON ✅' : 'OFF ❌'}`)
        .setDescription(nowOn ? 'Run any command without a prefix.' : 'No-prefix mode disabled.')
        .setFooter({ text: 'Resets on restart' })] });
    }

    // ── EVAL ──────────────────────────────────────────────────
    if (sub === 'eval' || sub === 'e') {
      const code = args.slice(1).join(' ');
      if (!code) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('`owner eval <code>`')] });
      try {
        let result = eval(code);
        if (result instanceof Promise) result = await result;
        if (typeof result !== 'string') result = require('util').inspect(result, { depth: 1 });
        const clean = result.replace(process.env.TOKEN ?? '', '[TOKEN]');
        return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setTitle('✅ Eval')
          .addFields({ name: 'Input', value: `\`\`\`js\n${code.slice(0,900)}\n\`\`\`` }, { name: 'Output', value: `\`\`\`js\n${clean.slice(0,900)}\n\`\`\`` })] });
      } catch (err) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setTitle('❌ Eval Error')
          .addFields({ name: 'Input', value: `\`\`\`js\n${code.slice(0,900)}\n\`\`\`` }, { name: 'Error', value: `\`\`\`\n${err.message.slice(0,900)}\n\`\`\`` })] });
      }
    }

    // ── GUILDS ────────────────────────────────────────────────
    if (sub === 'guilds' || sub === 'servers') {
      const page = parseInt(args[1]) || 1, PER = 15;
      const all  = [...client.guilds.cache.values()];
      const pages = Math.ceil(all.length / PER);
      const lines = all.slice((page-1)*PER, page*PER).map((g,i) =>
        `\`${(page-1)*PER+i+1}.\` **${g.name}** \`${g.id}\` — **${g.memberCount}** members`);
      return channel.send({ embeds: [new EmbedBuilder().setColor(INFO_COLOR)
        .setTitle(`🌐 All Servers (${all.length})`).setDescription(lines.join('\n') || 'None')
        .setFooter({ text: `Page ${page}/${pages}` })] });
    }

    // ── LEAVE ─────────────────────────────────────────────────
    if (sub === 'leave') {
      const g = client.guilds.cache.get(args[1]);
      if (!g) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Server \`${args[1]}\` not found`)] });
      const name = g.name; await g.leave();
      return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription(`✅ Left **${name}**`)] });
    }

    // ── STATS ─────────────────────────────────────────────────
    if (sub === 'stats') {
      const mem = process.memoryUsage();
      return channel.send({ embeds: [new EmbedBuilder().setColor(INFO_COLOR).setTitle('📊 Deep Runtime Stats')
        .addFields(
          { name: '🤖 Bot',    inline: true, value: `**Guilds:** \`${client.guilds.cache.size}\`\n**Users:** \`${client.users.cache.size}\`\n**Ping:** \`${client.ws.ping}ms\`\n**Uptime:** \`${formatUptime(process.uptime())}\`` },
          { name: '💾 Memory', inline: true, value: `**Heap:** \`${Math.round(mem.heapUsed/1024/1024)}MB / ${Math.round(mem.heapTotal/1024/1024)}MB\`\n**RSS:** \`${Math.round(mem.rss/1024/1024)}MB\`\n**External:** \`${Math.round(mem.external/1024/1024)}MB\`` },
          { name: '🖥️ System', inline: true, value: `**Platform:** \`${os.platform()}\`\n**CPUs:** \`${os.cpus().length}\`\n**RAM:** \`${Math.round(os.freemem()/1024/1024/1024)}/${Math.round(os.totalmem()/1024/1024/1024)} GB\`` },
          { name: '📦 Runtime', value: `**Node:** \`${process.version}\`  |  **Discord.js:** \`v14\`  |  **PID:** \`${process.pid}\`` },
        )] });
    }

    // ── SETSTATUS ─────────────────────────────────────────────
    if (sub === 'setstatus' || sub === 'status') {
      const type = args[1]?.toUpperCase(), text = args.slice(2).join(' ');
      const TYPES = { PLAYING: 0, STREAMING: 1, LISTENING: 2, WATCHING: 3, COMPETING: 5 };
      if (!type || !text || !(type in TYPES))
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription(`Usage: \`owner setstatus <type> <text>\`\nTypes: ${Object.keys(TYPES).map(t => `\`${t}\``).join(' ')}`)] });
      client.user.setPresence({ activities: [{ name: text, type: TYPES[type] }], status: 'online' });
      return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription(`✅ Status → **${type}** \`${text}\``)] });
    }

    // ── SETAVATAR ─────────────────────────────────────────────
    if (sub === 'setavatar' || sub === 'avatar') {
      const url = args[1] ?? message.attachments.first()?.url;
      if (!url) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner setavatar <url>`')] });
      try {
        await client.user.setAvatar(url);
        return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription('✅ Avatar updated!').setThumbnail(client.user.displayAvatarURL({ dynamic: true }))] });
      } catch (err) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ ${err.message}`)] });
      }
    }

    // ── BROADCAST ─────────────────────────────────────────────
    if (sub === 'broadcast') {
      const msg = args.slice(1).join(' ');
      if (!msg) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner broadcast <message>`')] });
      const st = await channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription(`📡 Broadcasting to **${client.guilds.cache.size}** owners...`)] });
      let sent = 0, failed = 0;
      for (const g of client.guilds.cache.values()) {
        try {
          const owner = await g.fetchOwner();
          await owner.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setTitle(`📣 Message from ${client.user.username}`).setDescription(msg).addFields({ name: 'Server', value: g.name }).setFooter({ text: 'From: matchalatte_with_banana' })] });
          sent++;
        } catch { failed++; }
      }
      return st.edit({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription(`✅ Done! Sent: **${sent}** | Failed: **${failed}**`)] });
    }

    // ── DM ────────────────────────────────────────────────────
    if (sub === 'dm') {
      const userId = args[1], msg = args.slice(2).join(' ');
      if (!userId || !msg) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner dm <userId> <message>`')] });
      try {
        const user = await client.users.fetch(userId);
        await user.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setTitle(`📩 Message from ${client.user.username}`).setDescription(msg).setFooter({ text: 'From the bot owner' })] });
        return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription(`✅ DM sent to **${user.tag}**`)] });
      } catch (err) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Failed: ${err.message}`)] });
      }
    }

    // ── RESETPREFIX ───────────────────────────────────────────
    if (sub === 'resetprefix') {
      const guildId = args[1];
      if (!guildId) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner resetprefix <guildId>`')] });
      await db.setPrefix(guildId, ',').catch(() => {});
      const g = client.guilds.cache.get(guildId);
      return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription(`✅ Prefix reset for **${g?.name ?? guildId}**`)] });
    }

    // ── BLACKLIST ─────────────────────────────────────────────
    if (sub === 'blacklist' || sub === 'bl') {
      const action = args[1]?.toLowerCase();
      if (!action || action === 'list') {
        const bl = await db.getBlacklist().catch(() => []);
        const desc = bl.length ? bl.slice(0,25).map((b,i) => `\`${i+1}.\` <@${b.user_id}> \`${b.user_id}\`\n> ${b.reason}`).join('\n') : '`No users blacklisted`';
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setTitle(`🔇 Global Blacklist (${bl.length})`).setDescription(desc)] });
      }
      if (action === 'add') {
        const userId = args[2], reason = args.slice(3).join(' ') || 'No reason';
        if (!userId) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('`owner blacklist add <userId> [reason]`')] });
        if (userId === author.id) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription("❌ Can't blacklist yourself")] });
        const user = await client.users.fetch(userId).catch(() => null);
        await db.addBlacklist(userId, reason, author.id);
        return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription(`✅ **${user?.tag ?? userId}** blacklisted\n> ${reason}`)] });
      }
      if (action === 'remove') {
        const userId = args[2];
        if (!userId) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('`owner blacklist remove <userId>`')] });
        const removed = await db.removeBlacklist(userId);
        if (!removed) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ \`${userId}\` not in blacklist`)] });
        const user = await client.users.fetch(userId).catch(() => null);
        return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription(`✅ **${user?.tag ?? userId}** unblacklisted`)] });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // NEW ABSOLUTE POWER COMMANDS
    // ═══════════════════════════════════════════════════════════

    // ── GBAN — ban user from ALL servers ─────────────────────
    if (sub === 'gban') {
      const targetId = args[1]?.replace(/^<@!?(\d+)>$/, '$1');
      const reason   = args.slice(2).join(' ') || 'Global ban by bot owner';
      if (!targetId || !/^\d{17,20}$/.test(targetId))
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner gban <userId> [reason]`')] });
      if (targetId === author.id)
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription("❌ Can't gban yourself")] });

      const target = await client.users.fetch(targetId).catch(() => null);
      const st = await channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
        .setDescription(`💀 Global banning **${target?.tag ?? targetId}** from **${client.guilds.cache.size}** servers...`)] });

      let banned = 0, failed = 0;
      for (const g of client.guilds.cache.values()) {
        const ok = await g.bans.create(targetId, { deleteMessageSeconds: 0, reason: `[GBan] ${reason}` }).then(() => true).catch(() => false);
        if (ok) banned++; else failed++;
      }
      await db.addBlacklist(targetId, `[GBan] ${reason}`, author.id).catch(() => {});
      return st.edit({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
        .setTitle('💀 Global Ban Complete')
        .addFields(
          { name: '✅ Banned',   value: `${banned}`,                              inline: true },
          { name: '❌ Failed',   value: `${failed}`,                              inline: true },
          { name: 'Total',       value: `${client.guilds.cache.size}`,            inline: true },
          { name: 'Target',      value: `${target?.tag ?? targetId} \`(${targetId})\`` },
          { name: 'Reason',      value: reason },
          { name: '🔒 Also',     value: 'User added to global blacklist to prevent future interaction.' },
        )] });
    }

    // ── GUNBAN — unban user from ALL servers ─────────────────
    if (sub === 'gunban') {
      const targetId = args[1]?.replace(/^<@!?(\d+)>$/, '$1');
      if (!targetId || !/^\d{17,20}$/.test(targetId))
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner gunban <userId>`')] });

      const target = await client.users.fetch(targetId).catch(() => null);
      const st = await channel.send({ embeds: [new EmbedBuilder().setColor(INFO_COLOR)
        .setDescription(`🔓 Global unbanning **${target?.tag ?? targetId}** from all servers...`)] });

      let unbanned = 0, failed = 0;
      for (const g of client.guilds.cache.values()) {
        const ok = await g.bans.remove(targetId, 'Global unban by bot owner').then(() => true).catch(() => false);
        if (ok) unbanned++; else failed++;
        await new Promise(r => setTimeout(r, 300));
      }
      await db.removeBlacklist(targetId).catch(() => {});
      return st.edit({ embeds: [new EmbedBuilder().setColor(OK_COLOR)
        .setTitle('🔓 Global Unban Complete')
        .addFields(
          { name: '✅ Unbanned', value: `${unbanned}`, inline: true },
          { name: '❌ Failed',   value: `${failed}`,   inline: true },
          { name: 'Target',      value: `${target?.tag ?? targetId} \`(${targetId})\`` },
          { name: '🔓 Also',     value: 'User removed from global blacklist.' },
        )] });
    }

    // ── MASSBAN — ban many users in current server ───────────
    if (sub === 'massban') {
      const ids    = args.slice(1).map(a => a.replace(/^<@!?(\d+)>$/, '$1')).filter(a => /^\d{17,20}$/.test(a));
      const reason = 'Mass ban by bot owner';
      if (!ids.length)
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner massban <id1> <id2> <id3>...`')] });

      const { guild } = message;
      const st = await channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`💀 Banning **${ids.length}** users from **${guild.name}**...`)] });
      let banned = 0, failed = 0;
      for (const id of ids) {
        const ok = await guild.bans.create(id, { deleteMessageSeconds: 0, reason }).then(() => true).catch(() => false);
        if (ok) banned++; else failed++;
      }
      return st.edit({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
        .setTitle('💀 Mass Ban Complete')
        .addFields({ name: '✅ Banned', value: `${banned}`, inline: true }, { name: '❌ Failed', value: `${failed}`, inline: true })] });
    }

    // ── LOCK — remote channel lock ────────────────────────────
    if (sub === 'lock') {
      const [, guildId, channelId] = args;
      if (!guildId || !channelId)
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner lock <guildId> <channelId>`')] });

      const g  = client.guilds.cache.get(guildId);
      if (!g) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Guild \`${guildId}\` not found`)] });
      const ch = g.channels.cache.get(channelId);
      if (!ch) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Channel \`${channelId}\` not found in **${g.name}**`)] });

      await ch.permissionOverwrites.edit(g.roles.everyone, { SendMessages: false }, { reason: 'Remote lock by bot owner' });
      return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR)
        .setTitle('🔒 Channel Locked Remotely')
        .addFields({ name: 'Server', value: g.name, inline: true }, { name: 'Channel', value: `#${ch.name}`, inline: true })] });
    }

    // ── UNLOCK — remote channel unlock ────────────────────────
    if (sub === 'unlock') {
      const [, guildId, channelId] = args;
      if (!guildId || !channelId)
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner unlock <guildId> <channelId>`')] });

      const g  = client.guilds.cache.get(guildId);
      if (!g) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Guild \`${guildId}\` not found`)] });
      const ch = g.channels.cache.get(channelId);
      if (!ch) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Channel \`${channelId}\` not found`)] });

      await ch.permissionOverwrites.edit(g.roles.everyone, { SendMessages: null }, { reason: 'Remote unlock by bot owner' });
      return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR)
        .setTitle('🔓 Channel Unlocked Remotely')
        .addFields({ name: 'Server', value: g.name, inline: true }, { name: 'Channel', value: `#${ch.name}`, inline: true })] });
    }

    // ── ANTINUKE — remote antinuke control ───────────────────
    if (sub === 'antinuke' || sub === 'an') {
      const guildId = args[1];
      const action  = args[2]?.toLowerCase();
      if (!guildId)
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner antinuke <guildId> <enable/disable/status>`')] });

      const g = client.guilds.cache.get(guildId);
      if (!g) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Guild \`${guildId}\` not found`)] });

      await db.ensureGuild(guildId, g.name);
      const cfg = await db.getAntinukeConfig(guildId);

      if (action === 'enable') {
        await db.q('UPDATE antinuke_config SET enabled=TRUE WHERE guild_id=$1', [guildId]);
        return channel.send({ embeds: [new EmbedBuilder().setColor(OK_COLOR).setDescription(`✅ Antinuke **enabled** in **${g.name}**`)] });
      }
      if (action === 'disable') {
        await db.q('UPDATE antinuke_config SET enabled=FALSE WHERE guild_id=$1', [guildId]);
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`⛔ Antinuke **disabled** in **${g.name}**`)] });
      }

      // Status
      return channel.send({ embeds: [new EmbedBuilder().setColor(INFO_COLOR)
        .setTitle(`🛡️ ${g.name} — Antinuke Status`)
        .addFields(
          { name: 'Status',     value: cfg.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: 'Punishment', value: cfg.punishment ?? 'ban',                     inline: true },
          { name: 'Guild ID',   value: `\`${guildId}\``,                            inline: true },
        )] });
    }

    // ── SPY — view any server's full config ──────────────────
    if (sub === 'spy') {
      const guildId = args[1];
      if (!guildId)
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner spy <guildId>`')] });

      const g = client.guilds.cache.get(guildId);
      if (!g) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Guild \`${guildId}\` not found`)] });

      await db.ensureGuild(guildId, g.name);
      const [gData, settings, jailCfg, staffRoles, antinukeCfg, joinLog, wlEntry] = await Promise.all([
        db.getGuild(guildId),
        db.getSettings(guildId),
        db.getJailConfig(guildId).catch(() => null),
        db.getStaffRoles(guildId).catch(() => []),
        db.getAntinukeConfig(guildId).catch(() => null),
        db.getGuildJoinLog(guildId).catch(() => null),
        db.getServerWhitelistEntry(guildId).catch(() => null),
      ]);

      const ch  = id => id ? `<#${id}>` : '`Not set`';
      const rol = id => id ? `<@&${id}>` : '`Not set`';

      return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR)
        .setAuthor({ name: `🕵️ Spy: ${g.name}`, iconURL: g.iconURL({ dynamic: true }) ?? undefined })
        .setThumbnail(g.iconURL({ dynamic: true }) ?? null)
        .addFields(
          { name: '📊 Server',     inline: true, value: `**Members:** \`${g.memberCount}\`\n**Owner:** <@${g.ownerId}>\n**Boost Level:** \`${g.premiumTier}\`\n**Created:** <t:${Math.floor(g.createdTimestamp/1000)}:R>` },
          { name: '⚙️ Config',     inline: true, value: `**Prefix:** \`${gData?.prefix ?? ','}\`\n**Mod Log:** ${ch(gData?.log_channel)}\n**Anti-Invite:** \`${settings?.antiinvite ? 'On' : 'Off'}\`` },
          { name: '🛡️ Antinuke',  inline: true, value: `**Status:** ${antinukeCfg?.enabled ? '🟢 On' : '🔴 Off'}\n**Punishment:** \`${antinukeCfg?.punishment ?? 'ban'}\`` },
          { name: '🔒 Mod Roles',  inline: true, value: `**Muted:** ${rol(settings?.muted_role_id)}\n**IMuted:** ${rol(settings?.imuted_role_id)}\n**RMuted:** ${rol(settings?.rmuted_role_id)}` },
          { name: '🔐 Jail',       inline: true, value: `**Role:** ${rol(jailCfg?.jail_role_id)}\n**Channel:** ${ch(jailCfg?.jail_channel_id)}` },
          { name: '👥 Staff Roles', value: staffRoles.length ? staffRoles.map(r => `<@&${r.role_id}>`).join(', ') : '`None set`' },
          { name: '📈 Stats',      value: `**Channels:** \`${g.channels.cache.size}\`  |  **Roles:** \`${g.roles.cache.size}\`  |  **Bots:** \`${g.members.cache.filter(m => m.user.bot).size}\`` },
          { name: '📋 Added By',   value: joinLog?.inviter_id ? `<@${joinLog.inviter_id}> \`(${joinLog.inviter_id})\` — \`${joinLog.inviter_tag ?? 'Unknown'}\`\nJoined: <t:${Math.floor(new Date(joinLog.joined_at).getTime()/1000)}:F>` : '`Unknown — no join log`' },
          { name: '🛡️ Whitelist', value: wlEntry ? `✅ Added by <@${wlEntry.added_by}> <t:${Math.floor(new Date(wlEntry.added_at).getTime()/1000)}:R>\n> ${wlEntry.reason}` : '🚫 Not whitelisted' },
        )] });
    }

    // ── SHUTDOWN ──────────────────────────────────────────────
    if (sub === 'shutdown' || sub === 'stop') {
      await channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
        .setTitle('🔌 Shutting Down...').setDescription('Goodbye! 🍵')
        .setFooter({ text: 'Requested by matchalatte_with_banana' })] });
      await client.destroy();
      process.exit(0);
    }

    return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription(`❓ Unknown subcommand. Run \`owner panel\` for the dashboard.`)] });
  }
};
