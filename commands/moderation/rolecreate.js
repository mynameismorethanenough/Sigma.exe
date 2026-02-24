const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, cmdHelp, base, Colors, success } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'rolecreate',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_roles')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'rolecreate', description: 'Creates a role with optional color', aliases: 'N/A', parameters: 'name, color', info: '⚠️ Manage Roles', usage: 'rolecreate <name> [hex color]', example: 'rolecreate Members #ff0000', module: 'moderation' })] });

    const color = args[args.length - 1].match(/^#?[0-9a-fA-F]{6}$/) ? args.pop() : undefined;
    const name = args.join(' ');
    const role = await message.guild.roles.create({ name, color });
    return message.channel.send({ embeds: [success(`${message.author}: Created role **${role.name}**`)] });
  }
};
