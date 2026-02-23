const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, cmdHelp, base, Colors, info } = require('../../utils/embeds');

module.exports = {
  name: 'warn',
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'moderate_members')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'warn', description: 'Warn a member', aliases: 'N/A', parameters: 'member, reason', info: '⚠️ Moderate Members', usage: 'warn (member) <reason>', example: 'warn @user Spamming', module: 'moderation' })] });

    const member = message.mentions.members.first() ?? message.guild.members.cache.get(args[0]);
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!member) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Invalid user`)] });

    const id = await db.addInfraction({ guildId: message.guild.id, targetUserId: member.id, modUserId: message.author.id, type: 'warn', reason }).catch(() => null);
    await member.user.send({ embeds: [info(`⚠️ You have been warned in **${message.guild.name}**\n**Reason:** ${reason}`)] }).catch(() => {});
    return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: **${member.user.tag}** has been warned${id ? ` (Case #${id})` : ''}\n**Reason:** ${reason}`)] });
  }
};
