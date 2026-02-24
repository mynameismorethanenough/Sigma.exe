/**
 * lockdown — Lock channels from @everyone
 * lockdown [#ch]                   — lock one channel (default: current)
 * lockdown all [reason]            — lock ALL channels (skips ignore list)
 * lockdown role @role [#ch]        — lock a channel for a specific role
 * lockdown ignore add #ch
 * lockdown ignore remove #ch
 * lockdown ignore list
 */
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'lockdown',
  aliases: ['lock'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_channels')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`\u26a0\ufe0f ${message.author}: I need **Manage Channels** permission`)] });

    const { guild, author } = message;
    await db.ensureGuild(guild.id, guild.name);
    const sub = args[0]?.toLowerCase();

    // IGNORE subcommands
    if (sub === 'ignore') {
      const action = args[1]?.toLowerCase();
      if (!action || action === 'list') {
        const list = await db.getLockdownIgnoreList(guild.id);
        if (!list.length) return message.channel.send({ embeds: [base(Colors.neutral)
          .setDescription(`\ud83d\udcad No ignored channels\n> \`${prefix}lockdown ignore add #ch\` to add one`)] });
        const lines = list.map((r, i) =>
          `\`${i + 1}.\` <#${r.channel_id}> \u2014 added <t:${Math.floor(new Date(r.added_at).getTime()/1000)}:R> by <@${r.added_by}>`
        ).join('\n');
        return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.neutral)
          .setTitle(`\ud83d\udd12 Lockdown Ignore List (${list.length})`).setDescription(lines)] });
      }
      if (action === 'add') {
        const ch = message.mentions.channels.first();
        if (!ch) return message.channel.send({ embeds: [warn(`${author}: Mention a channel`)] });
        await db.addLockdownIgnore(guild.id, ch.id, author.id);
        return message.channel.send({ embeds: [success(`${author}: ${ch} added to ignore list \u2014 skipped during \`${prefix}lockdown all\``)] });
      }
      if (action === 'remove' || action === 'delete') {
        const ch = message.mentions.channels.first();
        if (!ch) return message.channel.send({ embeds: [warn(`${author}: Mention a channel`)] });
        const removed = await db.removeLockdownIgnore(guild.id, ch.id);
        if (!removed) return message.channel.send({ embeds: [warn(`${author}: ${ch} is not in the ignore list`)] });
        return message.channel.send({ embeds: [success(`${author}: ${ch} removed from ignore list`)] });
      }
      return message.channel.send({ embeds: [warn(`${author}: Use add/remove/list`)] });
    }

    // LOCKDOWN ALL
    if (sub === 'all') {
      const reason = args.slice(1).join(' ') || 'Server lockdown';
      const ignoreList = await db.getLockdownIgnoreList(guild.id);
      const ignoredIds = new Set(ignoreList.map(r => r.channel_id));
      const textChannels = guild.channels.cache.filter(c => (c.type === 0 || c.type === 5) && !ignoredIds.has(c.id));
      const statusMsg = await message.channel.send({ embeds: [base(Colors.warn).setDescription(`\ud83d\udd12 Locking **${textChannels.size}** channels...`)] });
      let locked = 0, failed = 0;
      for (const [, ch] of textChannels) {
        const ok = await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: `[Lockdown All] ${reason} by ${author.tag}` }).then(() => true).catch(() => false);
        if (ok) locked++; else failed++;
      }
      return statusMsg.edit({ embeds: [base(Colors.warn).setTitle('\ud83d\udd12 Server Locked Down')
        .addFields(
          { name: '\u2705 Locked',   value: `${locked}`,          inline: true },
          { name: '\u274c Failed',   value: `${failed}`,          inline: true },
          { name: '\ud83d\udeab Skipped', value: `${ignoredIds.size}`, inline: true },
          { name: 'Reason', value: reason },
        ).setFooter({ text: `Unlock with: ${prefix}unlock all` })] });
    }

    // LOCKDOWN ROLE @role [#ch]
    if (sub === 'role') {
      const role = message.mentions.roles.first();
      if (!role) return message.channel.send({ embeds: [warn(`${author}: Mention a role \u2014 \`${prefix}lockdown role @role [#ch]\``)] });
      const channel = message.mentions.channels.first() ?? message.channel;
      await channel.permissionOverwrites.edit(role, { SendMessages: false }, { reason: `Lockdown role by ${author.tag}` });
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`\ud83d\udd12 ${author}: ${channel} locked for ${role}`)] });
    }

    // LOCKDOWN [#ch]
    const channel = message.mentions.channels.first() ?? message.channel;
    const reason  = (message.mentions.channels.first() ? args.slice(1) : args).join(' ') || 'No reason';
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: `Lockdown by ${author.tag}` });
    return message.channel.send({ embeds: [base(Colors.warn).setDescription(`\ud83d\udd12 ${author}: ${channel} locked\n> Use \`${prefix}unlock\` to unlock`)] });
  }
};
