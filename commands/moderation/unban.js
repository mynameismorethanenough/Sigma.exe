const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'unban',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });

    if (!args[0]) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${message.author}: Usage: \`${prefix}unban <user_id/username>\``)] });

    const { guild, author } = message;

    // Try direct ID first
    let targetId = args[0].replace(/^<@!?(\d+)>$/, '$1');

    if (!/^\d{17,20}$/.test(targetId)) {
      // Search the ban list by username
      const bans = await guild.bans.fetch().catch(() => null);
      if (!bans) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: Could not fetch ban list`)] });
      const lower = args.join(' ').toLowerCase();
      const found = bans.find(b =>
        b.user.username.toLowerCase() === lower ||
        b.user.tag.toLowerCase() === lower ||
        (b.user.globalName ?? '').toLowerCase() === lower ||
        b.user.username.toLowerCase().includes(lower)
      );
      if (!found) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: No banned user matching \`${args.join(' ')}\` found`)] });
      targetId = found.user.id;
    }

    const ban = await guild.bans.fetch(targetId).catch(() => null);
    if (!ban) return message.channel.send({ embeds: [warn(`${author}: \`${targetId}\` is not banned in this server`)] });

    await guild.bans.remove(targetId, `Unbanned by ${author.tag}`);
    return message.channel.send({ embeds: [success(`${author}: **${ban.user.tag}** \`(${targetId})\` has been unbanned`)] });
  }
};
