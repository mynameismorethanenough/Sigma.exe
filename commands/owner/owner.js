/**
 * owner — Bot owner control panel
 * Only accessible by: matchalatte_with_banana (1365744417465696437)
 *
 * Subcommands:
 *   owner / owner panel      — show the full panel
 *   owner perks              — list all owner perks
 *   owner eval <code>        — execute JavaScript
 *   owner guilds [page]      — list all servers
 *   owner leave <guildId>    — force-leave a server
 *   owner stats              — detailed runtime stats
 *   owner setstatus <type> <text>  — change bot activity
 *   owner setavatar <url>    — change bot avatar
 *   owner broadcast <msg>    — DM all guild owners
 *   owner dm <userId> <msg>  — DM any user as the bot
 *   owner resetprefix <gid>  — reset a server's prefix
 *   owner blacklist add <id> [reason]   — globally block a user
 *   owner blacklist remove <id>         — unblock
 *   owner blacklist list                — view all
 *   owner shutdown           — stop the bot
 */

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { isOwner, OWNER_PERKS, isNoPrefixEnabled, toggleNoPrefix } = require('../../utils/owner');
const db = require('../../database/db');
const os = require('os');

const PANEL_COLOR  = 0xf5c518;  // golden
const DANGER_COLOR = 0xed4245;
const INFO_COLOR   = 0x5865f2;

// ── Embeds ────────────────────────────────────────────────────
function panelEmbed(client, user) {
  return new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setAuthor({ name: `👑 Owner Panel — ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
    .setTitle(`${client.user.username} — Owner Control Panel`)
    .setDescription([
      `> Welcome back, **matchalatte_with_banana** 🍵  •  No-prefix: ${isNoPrefixEnabled() ? '**ON** ✅' : '**OFF** ❌'}`,
      '> You have full control over this bot.',
      '',
      '**📊 Quick Stats**',
      `> Servers: \`${client.guilds.cache.size}\`  |  Users: \`${client.users.cache.size}\`  |  Ping: \`${client.ws.ping}ms\``,
      `> Memory: \`${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\`  |  Uptime: \`${formatUptime(process.uptime())}\``,
    ].join('\n'))
    .addFields(
      { name: '⚡ Commands', value: [
        '`owner eval <code>` — run JS',
        '`owner guilds` — list servers',
        '`owner leave <id>` — leave server',
        '`owner broadcast <msg>` — DM all owners',
        '`owner dm <id> <msg>` — DM any user',
      ].join('\n'), inline: true },
      { name: '🔧 Bot Control', value: [
        '`owner setstatus <type> <text>`',
        '`owner setavatar <url>`',
        '`owner resetprefix <guildId>`',
        '`owner blacklist add/remove/list`',
        '`owner shutdown`',
      ].join('\n'), inline: true },
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
  );
  return [row1, row2];
}

function formatUptime(secs) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

module.exports = {
  name: 'owner',
  aliases: ['op', 'ownerp', 'ownerpanel'],
  category: 'owner',

  run: async (client, message, args) => {
    // Hard block — owner only
    if (!isOwner(message.author.id)) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
          .setDescription('❌ This command is restricted to the **bot owner** only.')]
      });
    }

    const { author, channel, guild } = message;
    const sub = args[0]?.toLowerCase();

    // ── PANEL (no args / panel) ───────────────────────────────
    if (!sub || sub === 'panel') {
      const msg = await channel.send({ embeds: [panelEmbed(client, author)], components: panelRows() });

      const col = msg.createMessageComponentCollector({
        filter: i => i.user.id === author.id,
        time: 120_000,
      });

      col.on('collect', async i => {
        if (i.customId === 'op_perks') {
          return i.update({ embeds: [perksEmbed(author)], components: panelRows() });
        }
        if (i.customId === 'op_guilds') {
          const guilds = [...client.guilds.cache.values()].slice(0, 20);
          const lines  = guilds.map((g, idx) => `\`${idx + 1}.\` **${g.name}** — \`${g.id}\` — \`${g.memberCount}\` members`);
          return i.update({
            embeds: [new EmbedBuilder().setColor(INFO_COLOR)
              .setTitle(`🌐 Servers (${client.guilds.cache.size} total)`)
              .setDescription(lines.join('\n') || 'No servers')
              .setFooter({ text: client.guilds.cache.size > 20 ? `Showing first 20 • Use 'owner guilds' for all` : '' })],
            components: panelRows(),
          });
        }
        if (i.customId === 'op_stats') {
          const mem      = process.memoryUsage();
          const totalMem = os.totalmem();
          const embed    = new EmbedBuilder().setColor(INFO_COLOR)
            .setTitle('📊 Deep Runtime Stats')
            .addFields(
              { name: '🤖 Bot',    inline: true, value: `**Guilds:** \`${client.guilds.cache.size}\`\n**Users:** \`${client.users.cache.size}\`\n**Ping:** \`${client.ws.ping}ms\`\n**Uptime:** \`${formatUptime(process.uptime())}\`` },
              { name: '💾 Memory', inline: true, value: `**Heap Used:** \`${Math.round(mem.heapUsed/1024/1024)}MB\`\n**Heap Total:** \`${Math.round(mem.heapTotal/1024/1024)}MB\`\n**RSS:** \`${Math.round(mem.rss/1024/1024)}MB\`\n**External:** \`${Math.round(mem.external/1024/1024)}MB\`` },
              { name: '🖥️ System', inline: true, value: `**Platform:** \`${os.platform()}\`\n**CPUs:** \`${os.cpus().length}\`\n**Free RAM:** \`${Math.round(os.freemem()/1024/1024/1024)}GB\`\n**Total RAM:** \`${Math.round(totalMem/1024/1024/1024)}GB\`` },
              { name: '📦 Runtime', value: `**Node.js:** \`${process.version}\`  |  **Discord.js:** \`v14\`  |  **PID:** \`${process.pid}\`` },
            );
          return i.update({ embeds: [embed], components: panelRows() });
        }
        if (i.customId === 'op_noprefix') {
          const nowOn = toggleNoPrefix();
          return i.update({
            embeds: [panelEmbed(client, author)],
            components: panelRows(),
          });
        }
        if (i.customId === 'op_blacklist') {
          const bl = await db.getBlacklist().catch(() => []);
          const desc = bl.length
            ? bl.slice(0, 20).map((b, idx) => `\`${idx+1}.\` <@${b.user_id}> \`${b.user_id}\` — ${b.reason}`).join('\n')
            : '`No users blacklisted`';
          return i.update({
            embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setTitle(`🔇 Global Blacklist (${bl.length})`).setDescription(desc)],
            components: panelRows(),
          });
        }
      });

      col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
      return;
    }

    // ── PERKS ─────────────────────────────────────────────────
    if (sub === 'perks') {
      return channel.send({ embeds: [perksEmbed(author)] });
    }

    // ── NOPREFIX toggle ────────────────────────────────────────
    if (sub === 'noprefix' || sub === 'np') {
      const nowOn = toggleNoPrefix();
      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(nowOn ? 0x57f287 : 0x36393f)
        .setTitle(`⚡ No-Prefix Mode: ${nowOn ? 'ON ✅' : 'OFF ❌'}`)
        .setDescription(nowOn
          ? 'You can now run any command **without** the prefix — just type the command name directly.'
          : 'No-prefix mode disabled. Use the prefix again.')
        .setFooter({ text: 'Resets on bot restart • Toggle with ,owner noprefix' })
      ]});
    }

    // ── EVAL ──────────────────────────────────────────────────
    if (sub === 'eval' || sub === 'e') {
      const code = args.slice(1).join(' ');
      if (!code) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner eval <code>`')] });

      try {
        let result = eval(code);
        if (result instanceof Promise) result = await result;
        if (typeof result !== 'string') result = require('util').inspect(result, { depth: 1 });

        const clean = result.replace(process.env.TOKEN ?? '', '[TOKEN]');
        return channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287)
          .setTitle('✅ Eval Result')
          .addFields(
            { name: '📥 Input',  value: `\`\`\`js\n${code.slice(0, 900)}\n\`\`\`` },
            { name: '📤 Output', value: `\`\`\`js\n${clean.slice(0, 900)}\n\`\`\`` },
          )] });
      } catch (err) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
          .setTitle('❌ Eval Error')
          .addFields(
            { name: '📥 Input', value: `\`\`\`js\n${code.slice(0, 900)}\n\`\`\`` },
            { name: '💥 Error', value: `\`\`\`\n${err.message.slice(0, 900)}\n\`\`\`` },
          )] });
      }
    }

    // ── GUILDS ────────────────────────────────────────────────
    if (sub === 'guilds' || sub === 'servers') {
      const page  = parseInt(args[1]) || 1;
      const PER   = 15;
      const total = client.guilds.cache.size;
      const all   = [...client.guilds.cache.values()];
      const slice = all.slice((page - 1) * PER, page * PER);
      const pages = Math.ceil(total / PER);

      const lines = slice.map((g, i) =>
        `\`${(page - 1) * PER + i + 1}.\` **${g.name}** \`${g.id}\` — **${g.memberCount}** members`
      );

      return channel.send({ embeds: [new EmbedBuilder().setColor(INFO_COLOR)
        .setTitle(`🌐 All Servers (${total})`)
        .setDescription(lines.join('\n') || 'None')
        .setFooter({ text: `Page ${page}/${pages} • owner guilds <page>` })
      ]});
    }

    // ── LEAVE ─────────────────────────────────────────────────
    if (sub === 'leave') {
      const guildId = args[1];
      if (!guildId) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription('Usage: `owner leave <guildId>`')] });
      const g = client.guilds.cache.get(guildId);
      if (!g) return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Server \`${guildId}\` not found`)] });
      const name = g.name;
      await g.leave();
      return channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ Left server **${name}** (\`${guildId}\`)`)] });
    }

    // ── STATS ─────────────────────────────────────────────────
    if (sub === 'stats') {
      const mem = process.memoryUsage();
      return channel.send({ embeds: [new EmbedBuilder().setColor(INFO_COLOR)
        .setTitle('📊 Deep Runtime Stats')
        .setAuthor({ name: author.username, iconURL: author.displayAvatarURL({ dynamic: true }) })
        .addFields(
          { name: '🤖 Bot',    inline: true, value: `**Guilds:** \`${client.guilds.cache.size}\`\n**Users:** \`${client.users.cache.size}\`\n**Ping:** \`${client.ws.ping}ms\`\n**Uptime:** \`${formatUptime(process.uptime())}\`` },
          { name: '💾 Memory', inline: true, value: `**Heap:** \`${Math.round(mem.heapUsed/1024/1024)}MB / ${Math.round(mem.heapTotal/1024/1024)}MB\`\n**RSS:** \`${Math.round(mem.rss/1024/1024)}MB\`\n**External:** \`${Math.round(mem.external/1024/1024)}MB\`` },
          { name: '🖥️ System', inline: true, value: `**Platform:** \`${os.platform()}\`\n**CPUs:** \`${os.cpus().length}\`\n**RAM:** \`${Math.round(os.freemem()/1024/1024/1024)}/${Math.round(os.totalmem()/1024/1024/1024)} GB\`` },
          { name: '📦 Runtime', value: `**Node.js:** \`${process.version}\`  |  **Discord.js:** \`v14\`  |  **PID:** \`${process.pid}\`  |  **Env:** \`${process.env.NODE_ENV || 'development'}\`` },
        )
      ]});
    }

    // ── SETSTATUS ─────────────────────────────────────────────
    if (sub === 'setstatus' || sub === 'status') {
      const type = args[1]?.toUpperCase();
      const text = args.slice(2).join(' ');
      const VALID_TYPES = ['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING', 'STREAMING'];

      if (!type || !text || !VALID_TYPES.includes(type))
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR)
          .setDescription(`Usage: \`owner setstatus <type> <text>\`\nTypes: ${VALID_TYPES.map(t => `\`${t}\``).join(' ')}`)] });

      const typeMap = { PLAYING: 0, STREAMING: 1, LISTENING: 2, WATCHING: 3, COMPETING: 5 };
      client.user.setPresence({ activities: [{ name: text, type: typeMap[type] }], status: 'online' });
      return channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287)
        .setDescription(`✅ Status set to **${type}** \`${text}\``)] });
    }

    // ── SETAVATAR ─────────────────────────────────────────────
    if (sub === 'setavatar' || sub === 'avatar') {
      const url = args[1] ?? message.attachments.first()?.url;
      if (!url) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner setavatar <url>`')] });
      try {
        await client.user.setAvatar(url);
        return channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287)
          .setDescription('✅ Bot avatar updated!')
          .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))] });
      } catch (err) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Failed: ${err.message}`)] });
      }
    }

    // ── BROADCAST ─────────────────────────────────────────────
    if (sub === 'broadcast') {
      const msg = args.slice(1).join(' ');
      if (!msg) return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner broadcast <message>`')] });

      const status = await channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription(`📡 Broadcasting to **${client.guilds.cache.size}** server owners...`)] });

      let sent = 0, failed = 0;
      for (const g of client.guilds.cache.values()) {
        try {
          const owner = await g.fetchOwner();
          await owner.send({
            embeds: [new EmbedBuilder().setColor(PANEL_COLOR)
              .setTitle(`📣 Message from ${client.user.username}`)
              .setDescription(msg)
              .addFields({ name: 'Your Server', value: g.name })
              .setFooter({ text: `Sent by bot owner • matchalatte_with_banana` })]
          });
          sent++;
        } catch { failed++; }
      }
      return status.edit({ embeds: [new EmbedBuilder().setColor(0x57f287)
        .setDescription(`✅ Broadcast complete!\n> ✅ Sent: **${sent}**  ❌ Failed: **${failed}**`)] });
    }

    // ── DM ────────────────────────────────────────────────────
    if (sub === 'dm') {
      const userId = args[1];
      const msg    = args.slice(2).join(' ');
      if (!userId || !msg)
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner dm <userId> <message>`')] });
      try {
        const user = await client.users.fetch(userId);
        await user.send({
          embeds: [new EmbedBuilder().setColor(PANEL_COLOR)
            .setTitle(`📩 Message from ${client.user.username}`)
            .setDescription(msg)
            .setFooter({ text: 'Sent by the bot owner' })]
        });
        return channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ DM sent to **${user.tag}**`)] });
      } catch (err) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Failed to DM: ${err.message}`)] });
      }
    }

    // ── RESETPREFIX ───────────────────────────────────────────
    if (sub === 'resetprefix') {
      const guildId = args[1];
      if (!guildId)
        return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner resetprefix <guildId>`')] });
      try {
        await db.setPrefix(guildId, ',');
        const g = client.guilds.cache.get(guildId);
        return channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287)
          .setDescription(`✅ Prefix reset to \`,\` for **${g?.name ?? guildId}**`)] });
      } catch (err) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Failed: ${err.message}`)] });
      }
    }

    // ── BLACKLIST ─────────────────────────────────────────────
    if (sub === 'blacklist' || sub === 'bl') {
      const action = args[1]?.toLowerCase();

      if (!action || action === 'list') {
        const bl   = await db.getBlacklist().catch(() => []);
        const desc = bl.length
          ? bl.slice(0, 25).map((b, i) => `\`${i+1}.\` <@${b.user_id}> \`${b.user_id}\`\n> ${b.reason}`).join('\n')
          : '`No users are blacklisted`';
        return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
          .setTitle(`🔇 Global Blacklist (${bl.length})`)
          .setDescription(desc)] });
      }

      if (action === 'add') {
        const userId = args[2];
        const reason = args.slice(3).join(' ') || 'No reason';
        if (!userId)
          return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner blacklist add <userId> [reason]`')] });
        if (userId === author.id)
          return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription("❌ You can't blacklist yourself")] });

        try {
          const user = await client.users.fetch(userId).catch(() => null);
          await db.addBlacklist(userId, reason, author.id);
          return channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287)
            .setDescription(`✅ **${user?.tag ?? userId}** added to global blacklist\n> Reason: ${reason}`)] });
        } catch (err) {
          return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ Failed: ${err.message}`)] });
        }
      }

      if (action === 'remove') {
        const userId = args[2];
        if (!userId)
          return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Usage: `owner blacklist remove <userId>`')] });
        const removed = await db.removeBlacklist(userId);
        if (!removed)
          return channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR).setDescription(`❌ \`${userId}\` is not in the blacklist`)] });
        const user = await client.users.fetch(userId).catch(() => null);
        return channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287)
          .setDescription(`✅ **${user?.tag ?? userId}** removed from global blacklist`)] });
      }

      return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR).setDescription('Subcommands: `list` `add <id> [reason]` `remove <id>`')] });
    }

    // ── SHUTDOWN ──────────────────────────────────────────────
    if (sub === 'shutdown' || sub === 'stop') {
      await channel.send({ embeds: [new EmbedBuilder().setColor(DANGER_COLOR)
        .setTitle('🔌 Shutting Down...')
        .setDescription('Bot is shutting down gracefully. Goodbye! 🍵')
        .setFooter({ text: 'Requested by matchalatte_with_banana' })] });
      await client.destroy();
      process.exit(0);
    }

    // ── Unknown ───────────────────────────────────────────────
    return channel.send({ embeds: [new EmbedBuilder().setColor(PANEL_COLOR)
      .setDescription(`❓ Unknown subcommand. Run \`owner panel\` for the full panel.`)] });
  }
};
