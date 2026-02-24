const { EmbedBuilder } = require('discord.js');
const { base, Colors } = require('../../utils/embeds');
const { OWNER_ID, OWNER_TAG } = require('../../utils/owner');
const db = require('../../database/db');
const os = require('os');

module.exports = {
  name: 'botinfo',
  category: 'information',
  run: async (client, message) => {
    const uptime  = Math.floor(process.uptime());
    const hours   = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    const mem     = process.memoryUsage();

    let ownerAvatarURL = null;
    try {
      const owner = await client.users.fetch(OWNER_ID, { force: true });
      ownerAvatarURL = owner.displayAvatarURL({ size: 256, dynamic: true });
    } catch {}

    // ── Guild-specific join log ───────────────────────────────
    const joinLog = await db.getGuildJoinLog(message.guild.id).catch(() => null);
    const wlEntry = await db.getServerWhitelistEntry(message.guild.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(Colors.info)
      .setTitle(`📊 ${client.user.username} Bot Info`)
      .setThumbnail(ownerAvatarURL ?? client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🤖 Bot Stats',  inline: true, value:
          `**Ping:** \`${client.ws.ping}ms\`\n` +
          `**Uptime:** \`${hours}h ${minutes}m ${seconds}s\`\n` +
          `**Servers:** \`${client.guilds.cache.size}\`\n` +
          `**Users:** \`${client.users.cache.size}\``
        },
        { name: '💾 System',     inline: true, value:
          `**Platform:** \`${os.platform().toUpperCase()}\`\n` +
          `**Node.js:** \`${process.version}\`\n` +
          `**Memory:** \`${Math.round(mem.heapUsed/1024/1024)}MB / ${Math.round(mem.heapTotal/1024/1024)}MB\``
        },
        { name: '👑 Owner',      inline: false, value:
          `**${OWNER_TAG}** (\`${OWNER_ID}\`)\n> Creator & developer of this bot 🍵`
        },
      );

    // ── Bot addition info for this server ─────────────────────
    if (joinLog) {
      const joinedAt  = Math.floor(new Date(joinLog.joined_at).getTime() / 1000);
      const inviterStr = joinLog.inviter_id
        ? `<@${joinLog.inviter_id}> \`(${joinLog.inviter_id})\`\n> Tag: \`${joinLog.inviter_tag ?? 'Unknown'}\``
        : '`Unknown — no audit log access at join time`';

      embed.addFields({
        name: '📋 Added to This Server',
        value:
          `**Added by:** ${inviterStr}\n` +
          `**Date:** <t:${joinedAt}:F> (<t:${joinedAt}:R>)\n` +
          `**Members at join:** \`${joinLog.member_count}\``,
      });
    }

    if (wlEntry) {
      const wlAt = Math.floor(new Date(wlEntry.added_at).getTime() / 1000);
      embed.addFields({
        name: '🛡️ Whitelist',
        value: `✅ Whitelisted <t:${wlAt}:R> by <@${wlEntry.added_by}>\n> ${wlEntry.reason ?? 'No reason'}`,
      });
    }

    embed.setFooter({ text: `Made with 🍵 by ${OWNER_TAG}` });
    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
