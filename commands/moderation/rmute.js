const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors, warn } = require('../../utils/embeds');

module.exports = {
  name: 'rmute',
  aliases: ['reactionmute', 'reactmute'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: I need **Manage Roles**`)] });

    const { guild, author } = message;
    const settings = await db.getSettings(guild.id);
    const roleId = settings?.rmuted_role_id;

    if (!roleId) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${author}: No reaction-muted role configured!\nSet one with \`${prefix}settings rmuted @role\`\n> The role should have \`Add Reactions\`, \`Use External Emojis\`, and \`Use External Stickers\` denied.`)] });

    const role = guild.roles.cache.get(roleId);
    if (!role) return message.channel.send({ embeds: [warn(`${author}: Reaction-muted role not found — re-configure with \`${prefix}settings rmuted @role\``)] });

    const member = message.mentions.members.first() ?? guild.members.cache.get(args[0]);
    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: Usage: \`${prefix}rmute @user [reason]\``)] });

    if (member.id === author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: You cannot rmute yourself`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: Cannot rmute someone higher than you`)] });
    if (member.roles.cache.has(roleId))
      return message.channel.send({ embeds: [warn(`${author}: **${member.user.tag}** is already reaction-muted`)] });

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await member.roles.add(role, `[Rmute] by ${author.tag}: ${reason}`);
    await db.addInfraction({ guildId: guild.id, targetUserId: member.id, modUserId: author.id, type: 'rmute', reason }).catch(() => {});
    return message.channel.send({ embeds: [base(Colors.mod)
      .setDescription(`💬 ${author}: **${member.user.tag}** has been reaction-muted\n> Add Reactions, External Emojis & Stickers removed\n**Reason:** ${reason}`)] });
  }
};
