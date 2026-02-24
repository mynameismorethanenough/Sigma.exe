/**
 * whitelist — Server whitelist management (owner-only)
 *
 * Usage:
 *   ,whitelist add <guildId> [reason]   — whitelist a server
 *   ,whitelist remove <guildId>         — remove from whitelist (bot will leave on next invite)
 *   ,whitelist list [page]              — list all whitelisted servers
 *   ,whitelist check [guildId]          — check if a server is whitelisted (defaults to current)
 *   ,whitelist info <guildId>           — full info about a whitelisted server
 *   ,whitelist kick <guildId>           — remove from whitelist AND force-leave the server
 */

const { EmbedBuilder } = require('discord.js');
const { isOwner } = require('../../utils/owner');
const db = require('../../database/db');

const GOLD   = 0xf5c518;
const GREEN  = 0x57f287;
const RED    = 0xed4245;
const BLUE   = 0x5865f2;
const PER    = 10;

module.exports = {
  name: 'whitelist',
  aliases: ['wl', 'serverwhitelist'],
  category: 'owner',

  run: async (client, message, args) => {
    if (!isOwner(message.author.id)) {
      return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(RED)
        .setDescription('❌ Only the **bot owner** can manage the server whitelist.')] });
    }

    const sub    = args[0]?.toLowerCase();
    const { channel, author } = message;

    // ── LIST ──────────────────────────────────────────────────
    if (!sub || sub === 'list') {
      const page  = parseInt(args[1]) || 1;
      const all   = await db.getServerWhitelist().catch(() => []);
      const pages = Math.ceil(all.length / PER) || 1;
      const slice = all.slice((page - 1) * PER, page * PER);

      const lines = slice.map((r, i) => {
        const g    = client.guilds.cache.get(r.guild_id);
        const when = Math.floor(new Date(r.added_at).getTime() / 1000);
        const name = g ? `**${g.name}**` : `\`${r.guild_id}\``;
        return `\`${(page-1)*PER+i+1}.\` ${name} \`(${r.guild_id})\`\n> Reason: ${r.reason} • Added by <@${r.added_by}> <t:${when}:R>`;
      });

      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(`🛡️ Whitelisted Servers (${all.length})`)
        .setDescription(lines.length ? lines.join('\n\n') : '`No servers whitelisted yet`')
        .setFooter({ text: `Page ${page}/${pages} • ,whitelist list <page>` })
        .setTimestamp()] });
    }

    // ── ADD ───────────────────────────────────────────────────
    if (sub === 'add') {
      const guildId = args[1];
      const reason  = args.slice(2).join(' ') || 'Approved by owner';

      if (!guildId || !/^\d{17,20}$/.test(guildId)) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(GOLD)
          .setDescription('Usage: `,whitelist add <guildId> [reason]`\n> The guild ID is a 17-20 digit number')] });
      }

      await db.addServerWhitelist(guildId, author.id, reason);

      const g = client.guilds.cache.get(guildId);
      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(GREEN)
        .setTitle('✅ Server Whitelisted')
        .setThumbnail(g?.iconURL({ dynamic: true }) ?? null)
        .addFields(
          { name: '🏠 Server',  value: g ? `**${g.name}**\n\`${guildId}\`` : `\`${guildId}\` (not yet joined)`, inline: true },
          { name: '👥 Members', value: g ? `\`${g.memberCount}\`` : '`N/A`',                                      inline: true },
          { name: '📝 Reason',  value: reason,                                                                     inline: false },
        )
        .setFooter({ text: `Whitelisted by ${author.username}` })
        .setTimestamp()] });
    }

    // ── REMOVE ────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const guildId = args[1];
      if (!guildId || !/^\d{17,20}$/.test(guildId)) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(GOLD).setDescription('Usage: `,whitelist remove <guildId>`')] });
      }

      const removed = await db.removeServerWhitelist(guildId);
      const g       = client.guilds.cache.get(guildId);

      if (!removed) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(RED)
          .setDescription(`❌ Server \`${guildId}\` was not in the whitelist.`)] });
      }

      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(RED)
        .setTitle('🗑️ Server Removed from Whitelist')
        .setDescription(g
          ? `**${g.name}** \`(${guildId})\` is no longer whitelisted. The bot will leave if re-invited.`
          : `\`${guildId}\` removed from whitelist.`)
        .setFooter({ text: 'The bot stays in the server until manually removed or kicked. Use ,whitelist kick to force-leave.' })
        .setTimestamp()] });
    }

    // ── KICK — remove from whitelist AND leave ────────────────
    if (sub === 'kick') {
      const guildId = args[1];
      if (!guildId || !/^\d{17,20}$/.test(guildId)) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(GOLD).setDescription('Usage: `,whitelist kick <guildId>`\nRemoves whitelist AND forces the bot to leave.')] });
      }

      await db.removeServerWhitelist(guildId).catch(() => {});
      const g = client.guilds.cache.get(guildId);

      if (!g) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(RED)
          .setDescription(`❌ Bot is not in server \`${guildId}\` or server not found.`)] });
      }

      const name = g.name;
      const mc   = g.memberCount;

      // Warn the server before leaving
      const ch = g.channels.cache
        .filter(c => c.isTextBased() && c.permissionsFor(g.members.me)?.has('SendMessages'))
        .sort((a, b) => a.position - b.position)
        .first();
      if (ch) {
        await ch.send({ embeds: [new EmbedBuilder()
          .setColor(RED)
          .setTitle('🚫 Bot Whitelist Revoked')
          .setDescription('This server\'s whitelist access has been revoked by the bot owner. The bot is now leaving.')
          .setTimestamp()] }).catch(() => {});
      }

      await g.leave().catch(() => {});

      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(RED)
        .setTitle('📤 Kicked + Whitelisted Removed')
        .addFields(
          { name: '🏠 Server',  value: `**${name}** \`(${guildId})\``, inline: true },
          { name: '👥 Members', value: `\`${mc}\``,                    inline: true },
        )
        .setFooter({ text: 'Bot has left the server' })
        .setTimestamp()] });
    }

    // ── CHECK ─────────────────────────────────────────────────
    if (sub === 'check') {
      const guildId = args[1] ?? message.guild.id;
      if (!/^\d{17,20}$/.test(guildId)) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(GOLD).setDescription('Usage: `,whitelist check [guildId]` (defaults to current server)')] });
      }

      const entry = await db.getServerWhitelistEntry(guildId).catch(() => null);
      const g     = client.guilds.cache.get(guildId);

      if (!entry) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(RED)
          .setDescription(`🚫 **${g?.name ?? guildId}** \`(${guildId})\` is **NOT** whitelisted.`)] });
      }

      const when = Math.floor(new Date(entry.added_at).getTime() / 1000);
      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(GREEN)
        .setTitle(`✅ ${g?.name ?? guildId} — Whitelisted`)
        .setThumbnail(g?.iconURL({ dynamic: true }) ?? null)
        .addFields(
          { name: '🆔 Guild ID',    value: `\`${guildId}\``,              inline: true },
          { name: '👥 Members',     value: g ? `\`${g.memberCount}\`` : '`N/A`', inline: true },
          { name: '📅 Whitelisted', value: `<t:${when}:F>`,               inline: false },
          { name: '👤 Added By',    value: `<@${entry.added_by}>`,        inline: true },
          { name: '📝 Reason',      value: entry.reason ?? 'No reason',   inline: true },
        )
        .setTimestamp()] });
    }

    // ── INFO (full server details) ────────────────────────────
    if (sub === 'info') {
      const guildId = args[1];
      if (!guildId || !/^\d{17,20}$/.test(guildId)) {
        return channel.send({ embeds: [new EmbedBuilder().setColor(GOLD).setDescription('Usage: `,whitelist info <guildId>`')] });
      }

      const [entry, joinLog] = await Promise.all([
        db.getServerWhitelistEntry(guildId).catch(() => null),
        db.getGuildJoinLog(guildId).catch(() => null),
      ]);

      const g = client.guilds.cache.get(guildId);

      const embed = new EmbedBuilder()
        .setColor(entry ? GREEN : RED)
        .setTitle(`🔍 Server Info: ${g?.name ?? guildId}`)
        .setThumbnail(g?.iconURL({ dynamic: true }) ?? null);

      if (g) {
        embed.addFields(
          { name: '🏠 Name',      value: g.name,                                     inline: true },
          { name: '👥 Members',   value: `\`${g.memberCount}\``,                      inline: true },
          { name: '👑 Owner',     value: `<@${g.ownerId}> \`(${g.ownerId})\``,        inline: true },
          { name: '📅 Created',   value: `<t:${Math.floor(g.createdTimestamp/1000)}:R>`, inline: true },
          { name: '🔒 Boost Lvl', value: `\`${g.premiumTier}\``,                      inline: true },
          { name: '📺 Channels',  value: `\`${g.channels.cache.size}\``,              inline: true },
        );
      }

      if (joinLog) {
        const when = Math.floor(new Date(joinLog.joined_at).getTime() / 1000);
        embed.addFields({
          name: '📋 Join Log',
          value: [
            `**Inviter:** ${joinLog.inviter_id ? `<@${joinLog.inviter_id}> \`(${joinLog.inviter_id})\`` : '`Unknown`'}`,
            `**Inviter Tag:** \`${joinLog.inviter_tag ?? 'Unknown'}\``,
            `**Joined:** <t:${when}:F>`,
            `**Members at join:** \`${joinLog.member_count}\``,
          ].join('\n'),
        });
      }

      embed.addFields({
        name: '🛡️ Whitelist',
        value: entry
          ? `✅ Whitelisted <t:${Math.floor(new Date(entry.added_at).getTime()/1000)}:R> by <@${entry.added_by}>\n> ${entry.reason}`
          : '🚫 Not whitelisted',
      });

      return channel.send({ embeds: [embed.setTimestamp()] });
    }

    // ── Help ──────────────────────────────────────────────────
    return channel.send({ embeds: [new EmbedBuilder()
      .setColor(GOLD)
      .setTitle('🛡️ Server Whitelist Management')
      .setDescription([
        '`,whitelist add <guildId> [reason]`  — whitelist a server',
        '`,whitelist remove <guildId>`         — remove from whitelist',
        '`,whitelist kick <guildId>`           — remove whitelist + force-leave',
        '`,whitelist list [page]`              — list all whitelisted servers',
        '`,whitelist check [guildId]`          — check if current/specified server is whitelisted',
        '`,whitelist info <guildId>`           — full info: join log, inviter, whitelist status',
      ].join('\n'))
      .setFooter({ text: 'Non-whitelisted servers are auto-left on invite' })] });
  }
};
