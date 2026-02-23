const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, cmdHelp, base, Colors, success } = require('../../utils/embeds');

module.exports = {
  name: 'roleremove',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_roles')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'roleremove', description: 'Removes a role from a member', aliases: 'N/A', parameters: 'member, role', info: '⚠️ Manage Roles', usage: 'roleremove (member) <role>', example: 'roleremove @user Members', module: 'moderation' })] });

    const member = message.mentions.members.first() ?? message.guild.members.cache.get(args[0]);
    const role = message.mentions.roles.first() ?? message.guild.roles.cache.find(r => r.name === args.slice(1).join(' '));
    if (!member || !role) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Invalid user or role`)] });
    await member.roles.remove(role.id);
    return message.channel.send({ embeds: [success(`${message.author}: Removed **${role.name}** from ${member}`)] });
  }
};
