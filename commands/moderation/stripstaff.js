/**
 * stripstaff — Remove all roles that have dangerous/admin permissions from a member
 * Strips: Administrator, ManageGuild, ManageChannels, ManageRoles, BanMembers, KickMembers, ModerateMembers
 */
const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

const DANGEROUS_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageNicknames,
];

module.exports = {
  name: 'stripstaff',
  aliases: ['strip', 'destaff'],
  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: I need **Manage Roles**`)] });

    const { guild, author } = message;
    const member = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0]);

    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${author}: Mention a member to strip staff permissions from`)] });
    if (member.id === guild.ownerId) return message.channel.send({ embeds: [warn(`${author}: Cannot strip the server owner`)] });
    if (member.id === author.id) return message.channel.send({ embeds: [warn(`${author}: You cannot strip yourself`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`❌ ${author}: Cannot strip someone higher than you`)] });

    // Find roles with dangerous perms that the bot can manage
    const rolesToStrip = member.roles.cache.filter(r => {
      if (r.id === guild.id) return false; // @everyone
      if (!r.editable) return false;       // above bot
      return DANGEROUS_PERMS.some(p => r.permissions.has(p));
    });

    if (!rolesToStrip.size) return message.channel.send({ embeds: [warn(`${author}: **${member.user.tag}** has no dangerous permission roles I can remove`)] });

    const stripped = [];
    for (const [, role] of rolesToStrip) {
      const ok = await member.roles.remove(role, `[Stripstaff] by ${author.tag}`).then(() => true).catch(() => false);
      if (ok) stripped.push(role.name);
    }

    return message.channel.send({ embeds: [base(Colors.mod)
      .setTitle('🔱 Staff Stripped')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Member',        value: `${member.user.tag} \`(${member.id})\``, inline: true },
        { name: 'Stripped Roles', value: stripped.map(n => `\`${n}\``).join(', ') || 'None' },
      )] });
  }
};
