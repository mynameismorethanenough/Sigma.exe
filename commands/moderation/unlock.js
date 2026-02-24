/**
 * unlock — Unlock channels
 * unlock [#ch]    — unlock one channel (default: current)
 * unlock all      — unlock all channels that are locked, skipping ignore list
 */
const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors, success } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'unlock',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_channels')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // UNLOCK ALL
    if (sub === 'all') {
      await db.ensureGuild(guild.id, guild.name);
      const ignoreList = await db.getLockdownIgnoreList(guild.id);
      const ignoredIds = new Set(ignoreList.map(r => r.channel_id));
      const textChannels = guild.channels.cache.filter(c => (c.type === 0 || c.type === 5) && !ignoredIds.has(c.id));
      const statusMsg = await message.channel.send({ embeds: [base(Colors.success).setDescription(`🔓 Unlocking **${textChannels.size}** channels...`)] });
      let unlocked = 0, failed = 0;
      for (const [, ch] of textChannels) {
        const ok = await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }, { reason: `Unlock All by ${author.tag}` }).then(() => true).catch(() => false);
        if (ok) unlocked++; else failed++;
      }
      return statusMsg.edit({ embeds: [base(Colors.success).setTitle('🔓 Server Unlocked')
        .addFields(
          { name: '✅ Unlocked', value: `${unlocked}`, inline: true },
          { name: '❌ Failed',   value: `${failed}`,   inline: true },
          { name: '🚫 Skipped', value: `${ignoredIds.size}`, inline: true },
        )] });
    }

    // UNLOCK [#ch]
    const channel = message.mentions.channels.first() ?? message.channel;
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
    return message.channel.send({ embeds: [success(`${author}: 🔓 ${channel} has been **unlocked**`)] });
  }
};
