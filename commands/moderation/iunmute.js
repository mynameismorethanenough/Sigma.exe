const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');

module.exports = {
  name: 'iunmute',
  aliases: ['imageunmute'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });

    const { guild, author } = message;
    const settings = await db.getSettings(guild.id);
    const roleId = settings?.imuted_role_id;
    if (!roleId) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: No image-muted role configured — use \`${prefix}settings imuted @role\``)] });

    const member = message.mentions.members.first() ?? guild.members.cache.get(args[0]);
    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: Mention a user`)] });

    if (!member.roles.cache.has(roleId))
      return message.channel.send({ embeds: [warn(`${author}: **${member.user.tag}** is not image-muted`)] });

    await member.roles.remove(roleId, `[Iunmute] by ${author.tag}`);
    return message.channel.send({ embeds: [success(`${author}: **${member.user.tag}** image-mute removed — Attach Files & Embed Links restored`)] });
  }
};
