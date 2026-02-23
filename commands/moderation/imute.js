const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');

module.exports = {
  name: 'imute',
  aliases: ['imagemute'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: I need **Manage Roles**`)] });

    const { guild, author } = message;
    const settings = await db.getSettings(guild.id);
    const roleId = settings?.imuted_role_id;

    if (!roleId) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: No image-muted role configured!\nSet one with \`${prefix}settings imuted @role\`\n> The role should have \`Attach Files\` and \`Embed Links\` denied.`)] });

    const role = guild.roles.cache.get(roleId);
    if (!role) return message.channel.send({ embeds: [warn(`${author}: Image-muted role not found — re-configure with \`${prefix}settings imuted @role\``)] });

    const member = message.mentions.members.first() ?? guild.members.cache.get(args[0]);
    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: Usage: \`${prefix}imute @user [reason]\``)] });

    if (member.id === author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot imute yourself`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: Cannot imute someone higher than you`)] });
    if (member.roles.cache.has(roleId))
      return message.channel.send({ embeds: [warn(`${author}: **${member.user.tag}** is already image-muted`)] });

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await member.roles.add(role, `[Imute] by ${author.tag}: ${reason}`);
    await db.addInfraction({ guildId: guild.id, targetUserId: member.id, modUserId: author.id, type: 'imute', reason }).catch(() => {});
    return message.channel.send({ embeds: [base(Colors.mod)
      .setDescription(`🖼️ ${author}: **${member.user.tag}** has been image-muted\n> Attach Files & Embed Links removed\n**Reason:** ${reason}`)] });
  }
};
