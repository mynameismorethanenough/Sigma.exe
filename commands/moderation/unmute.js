const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'unmute',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });

    const { guild, author } = message;
    const settings = await db.getSettings(guild.id);
    const muteRoleId = settings?.muted_role_id;
    if (!muteRoleId) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: No muted role configured — use \`${prefix}settings muted @role\``)] });

    const member = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0]);
    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: Mention a user`)] });

    if (!member.roles.cache.has(muteRoleId))
      return message.channel.send({ embeds: [warn(`${author}: **${member.user.tag}** is not muted`)] });

    await member.roles.remove(muteRoleId, `[Unmute] by ${author.tag}`);
    return message.channel.send({ embeds: [success(`${author}: **${member.user.tag}** has been unmuted`)] });
  }
};
