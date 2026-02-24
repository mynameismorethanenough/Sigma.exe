const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, base, Colors, E, success } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');
const { resolveUser } = require('../../utils/resolve');

module.exports = {
  name: 'hackban',
  aliases: ['hban'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'ban_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'ban_members')] });

    if (!args[0]) return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('Hackban')
      .setDescription(`\`${prefix}hackban <id/mention/username> [reason]\`\nBans a user by ID even if they are not in the server.`)] });

    // Accept mention, ID, or try to resolve by username
    const rawArg  = args[0].replace(/^<@!?(\d+)>$/, '$1');
    let targetId  = rawArg;
    let targetTag = null;

    // If it's not a raw ID, try user cache lookup by username
    if (!/^\d{17,20}$/.test(rawArg)) {
      const user = await resolveUser(client, args[0]);
      if (!user) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Could not find user \`${args[0]}\` — try a user ID`)] });
      targetId  = user.id;
      targetTag = user.tag;
    } else {
      const user = await client.users.fetch(rawArg).catch(() => null);
      targetTag = user?.tag ?? rawArg;
    }

    if (targetId === message.author.id)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot ban yourself`)] });

    const reason = args.slice(/^\d{17,20}$/.test(rawArg) ? 1 : 1).join(' ') || 'No reason provided';

    await message.guild.bans.create(targetId, { reason }).catch(e => {
      message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Could not ban: \`${e.message}\``)] });
    });
    await db.addInfraction({ guildId: message.guild.id, targetUserId: targetId, modUserId: message.author.id, type: 'ban', reason }).catch(() => {});
    return message.channel.send({ embeds: [success(`${message.author}: Banned **${targetTag}** \`(${targetId})\`\n**Reason:** ${reason}`)] });
  }
};
