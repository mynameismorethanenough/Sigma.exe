/**
 * guildCreate — fires when the bot is invited to a server
 *
 * 1. Log who added the bot and when (stored in guild_join_log)
 * 2. Enforce server whitelist — if the guild is NOT whitelisted, leave immediately
 *    and DM the owner with instructions to get whitelisted
 */

const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('../database/db');
const { OWNER_ID, OWNER_TAG } = require('../utils/owner');

const PANEL_COLOR  = 0xf5c518;
const DANGER_COLOR = 0xed4245;
const OK_COLOR     = 0x57f287;

module.exports = (client) => {
  client.on('guildCreate', async (guild) => {
    // ── Step 1: Detect who invited the bot via audit log ──────
    let inviterId  = null;
    let inviterTag = null;

    try {
      await new Promise(r => setTimeout(r, 1500)); // wait for audit log to populate
      const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.BotAdd });
      for (const entry of logs.entries.values()) {
        if (entry.target?.id === client.user.id && Date.now() - entry.createdTimestamp < 30_000) {
          inviterId  = entry.executor?.id   ?? null;
          inviterTag = entry.executor?.tag  ?? entry.executor?.username ?? null;
          break;
        }
      }
    } catch { /* audit log fetch may fail without perms */ }

    // ── Step 2: Log the join to DB ────────────────────────────
    try {
      await db.logGuildJoin(guild.id, guild.name, inviterId, inviterTag, guild.memberCount);
    } catch { /* non-fatal */ }

    console.log(`[GuildCreate] Joined: ${guild.name} (${guild.id}) | Inviter: ${inviterTag ?? 'Unknown'} (${inviterId ?? 'N/A'}) | Members: ${guild.memberCount}`);

    // ── Step 3: Notify bot owner via DM ───────────────────────
    try {
      const owner = await client.users.fetch(OWNER_ID);
      await owner.send({ embeds: [new EmbedBuilder()
        .setColor(PANEL_COLOR)
        .setTitle(`🆕 Bot Added to New Server`)
        .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
        .addFields(
          { name: '🏠 Server',     value: `**${guild.name}**\n\`${guild.id}\``,                  inline: true },
          { name: '👥 Members',    value: `\`${guild.memberCount}\``,                              inline: true },
          { name: '👑 Guild Owner',value: `<@${guild.ownerId}> \`(${guild.ownerId})\``,           inline: true },
          { name: '👤 Inviter',    value: inviterId ? `<@${inviterId}> \`(${inviterId})\`` : '`Unknown — no audit log access`', inline: false },
          { name: '📅 Joined At',  value: `<t:${Math.floor(Date.now()/1000)}:F>`,                 inline: false },
        )
        .setFooter({ text: `Use: ,owner whitelist add ${guild.id} <reason>  to whitelist this server` })
        .setTimestamp(),
      ]});
    } catch { /* DM may fail if owner has DMs closed */ }

    // ── Step 4: Whitelist check ───────────────────────────────
    const whitelisted = await db.isServerWhitelisted(guild.id).catch(() => false);

    if (!whitelisted) {
      // Send a message to the first available text channel explaining why we left
      const channel = guild.channels.cache
        .filter(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages'))
        .sort((a, b) => a.position - b.position)
        .first();

      if (channel) {
        try {
          await channel.send({ embeds: [new EmbedBuilder()
            .setColor(DANGER_COLOR)
            .setTitle('🚫 Server Not Whitelisted')
            .setDescription([
              `**${client.user.username}** operates on an **invite-only, whitelist basis.**`,
              '',
              'This server has not been approved to use this bot. The bot will now leave automatically.',
              '',
              '**Want access?**',
              `Contact the bot owner: **${OWNER_TAG}**`,
              `Or DM the bot owner directly with your server ID: \`${guild.id}\``,
            ].join('\n'))
            .setFooter({ text: `Server ID: ${guild.id}` })
            .setTimestamp(),
          ]});
        } catch { /* channel may not be writable */ }
      }

      // Leave the guild
      await guild.leave().catch(() => {});
      console.log(`[GuildCreate] LEFT non-whitelisted server: ${guild.name} (${guild.id})`);

      // Notify owner that we left
      try {
        const owner = await client.users.fetch(OWNER_ID);
        await owner.send({ embeds: [new EmbedBuilder()
          .setColor(DANGER_COLOR)
          .setDescription(`⛔ Left **${guild.name}** \`(${guild.id})\` — not whitelisted.\nUse \`,owner whitelist add ${guild.id} <reason>\` to approve it.`),
        ]});
      } catch { /* silent */ }

      return;
    }

    // ── Whitelisted: set up guild in DB ───────────────────────
    try {
      await db.ensureGuild(guild.id, guild.name);
    } catch { /* non-fatal */ }
  });

  // ── guildDelete: log when bot is removed ──────────────────
  client.on('guildDelete', async (guild) => {
    console.log(`[GuildDelete] Left/kicked: ${guild.name} (${guild.id})`);
    try {
      const owner = await client.users.fetch(OWNER_ID);
      await owner.send({ embeds: [new EmbedBuilder()
        .setColor(DANGER_COLOR)
        .setTitle('📤 Bot Removed from Server')
        .addFields(
          { name: '🏠 Server',  value: `**${guild.name}**\n\`${guild.id}\``, inline: true },
          { name: '👥 Members', value: `\`${guild.memberCount ?? 'N/A'}\``,  inline: true },
          { name: '📅 At',      value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
        )
        .setFooter({ text: 'The server whitelist entry is kept in case they re-add the bot' })
        .setTimestamp(),
      ]});
    } catch { /* silent */ }
  });

  console.log('🏠 GuildCreate / GuildDelete events loaded');
};
