const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, base, Colors, E, warn } = require('../../utils/embeds');

module.exports = {
  name: 'mute',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'manage_roles')] });

    const { guild, author } = message;
    const settings = await db.getSettings(guild.id);
    const muteRoleId = settings?.muted_role_id;

    if (!muteRoleId) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: No muted role configured!\nSet one with \`${prefix}settings muted @role\``)] });

    const muteRole = guild.roles.cache.get(muteRoleId);
    if (!muteRole) return message.channel.send({ embeds: [warn(`${author}: Muted role not found — re-configure with \`${prefix}settings muted @role\``)] });

    const member = message.mentions.members.first() ?? guild.members.cache.get(args[0]);
    if (!member) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: Usage: \`${prefix}mute @user [reason]\``)] });

    if (member.id === author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot mute yourself`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot mute someone higher than you`)] });
    if (member.roles.cache.has(muteRoleId))
      return message.channel.send({ embeds: [warn(`${author}: **${member.user.tag}** is already muted`)] });

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await member.roles.add(muteRole, `[Mute] by ${author.tag}: ${reason}`);
    await db.addInfraction({ guildId: guild.id, targetUserId: member.id, modUserId: author.id, type: 'mute', reason }).catch(() => {});
    return message.channel.send({ embeds: [base(Colors.mod).setDescription(`🔇 ${author}: **${member.user.tag}** has been muted\n**Reason:** ${reason}`)] });
  }
};
