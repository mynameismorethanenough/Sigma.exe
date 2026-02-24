const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'untimeout',
  aliases: ['uto', 'removetimeout'],
  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'moderate_members')] });

    const member = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0]);
    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Mention a user`)] });

    if (!member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp <= Date.now())
      return message.channel.send({ embeds: [warn(`${message.author}: **${member.user.tag}** is not currently timed out`)] });

    await member.timeout(null, `Timeout removed by ${message.author.tag}`);
    return message.channel.send({ embeds: [success(`${message.author}: Timeout removed from **${member.user.tag}**`)] });
  }
};
