const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, botMissingPerm, cmdHelp, base, Colors, success } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'rename',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_nicknames')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'manage_nicknames')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'rename', description: 'Assigns the mentioned user a new nickname', aliases: 'N/A', parameters: 'member, nickname', info: '⚠️ Manage Nicknames', usage: 'rename (member) <nickname>', example: 'rename @user CoolGuy', module: 'moderation' })] });

    const member = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0]);
    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Invalid user`)] });
    const nickname = args.slice(1).join(' ') || null;
    await member.setNickname(nickname);
    return message.channel.send({ embeds: [success(`${message.author}: **${member.user.tag}**'s nickname set to \`${nickname ?? 'removed'}\``)] });
  }
};
