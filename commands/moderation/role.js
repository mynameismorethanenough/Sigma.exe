const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, botMissingPerm, cmdHelp, base, Colors, E } = require('../../utils/embeds');

module.exports = {
  name: 'role',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_roles')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'manage_roles')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'role', description: 'Adds or removes a role from a member', aliases: 'N/A', parameters: 'member, role', info: '⚠️ Manage Roles', usage: 'role (member) <role name>', example: 'role @user Members', module: 'moderation' })] });

    const member = message.mentions.members.first() ?? message.guild.members.cache.get(args[0]);
    const role = message.mentions.roles.first() ?? message.guild.roles.cache.get(args[1]) ?? message.guild.roles.cache.find(r => r.name === args.slice(1).join(' '));

    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: You must state a **user**`)] });
    if (!role) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: That role **doesn't exist**`)] });
    if (message.member.roles.highest.position <= role.position) return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot give a role **higher** than yours`)] });

    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role.id);
      return message.channel.send({ embeds: [base(0x6495ed).setDescription(`➖ ${message.author}: Removed ${role} from ${member}`)] });
    } else {
      await member.roles.add(role.id);
      return message.channel.send({ embeds: [base(0x46bcec).setDescription(`➕ ${message.author}: Added ${role} to ${member}`)] });
    }
  }
};
