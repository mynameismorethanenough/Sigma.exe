/**
 * unbanall — Unban every user in the server's ban list
 * unban all          — start mass unban
 * unban all cancel   — cancel an in-progress unban
 *
 * Stored on client.unbanAllTasks = Map<guildId, { cancelled: false }>
 */
const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');

module.exports = {
  name: 'unbanall',
  aliases: ['unbanall'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: I need **Ban Members** permission`)] });

    const { guild, author } = message;
    if (!client.unbanAllTasks) client.unbanAllTasks = new Map();

    const sub = args[0]?.toLowerCase();

    // ── CANCEL ────────────────────────────────────────────────
    if (sub === 'cancel') {
      const task = client.unbanAllTasks.get(guild.id);
      if (!task) return message.channel.send({ embeds: [warn(`${author}: No unban all task is running in this server`)] });
      task.cancelled = true;
      return message.channel.send({ embeds: [warn(`${author}: ⛔ Unban all task is being **cancelled**...`)] });
    }

    // ── START ─────────────────────────────────────────────────
    if (client.unbanAllTasks.get(guild.id))
      return message.channel.send({ embeds: [warn(`${author}: An unban all task is already running — use \`${prefix}unbanall cancel\` to stop it`)] });

    const bans = await guild.bans.fetch();
    if (!bans.size) return message.channel.send({ embeds: [base(Colors.neutral).setDescription('📭 No banned users found')] });

    const task = { cancelled: false };
    client.unbanAllTasks.set(guild.id, task);

    const statusMsg = await message.channel.send({ embeds: [base(Colors.mod)
      .setTitle('🔓 Unban All Started')
      .setDescription(`Unbanning **${bans.size}** users...\n> Use \`${prefix}unbanall cancel\` to cancel`)
      .setFooter({ text: 'This may take a while for large ban lists' })] });

    let unbanned = 0, failed = 0;

    for (const [userId] of bans) {
      if (task.cancelled) break;
      const ok = await guild.bans.remove(userId, `Unban All by ${author.tag}`).then(() => true).catch(() => false);
      if (ok) unbanned++; else failed++;
      // Rate limit safety — ~1 unban/500ms
      await new Promise(r => setTimeout(r, 500));
    }

    client.unbanAllTasks.delete(guild.id);

    const wasCancelled = task.cancelled;
    return statusMsg.edit({ embeds: [base(wasCancelled ? Colors.warn : Colors.success)
      .setTitle(wasCancelled ? '⛔ Unban All Cancelled' : '✅ Unban All Complete')
      .addFields(
        { name: '✅ Unbanned', value: `${unbanned}`, inline: true },
        { name: '❌ Failed',   value: `${failed}`,   inline: true },
        { name: '📊 Total',   value: `${bans.size}`, inline: true },
      )
      .setFooter({ text: `By ${author.tag}` })] });
  }
};
