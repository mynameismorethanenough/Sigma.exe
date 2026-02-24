const db = require('../../database/db');
const { missingPerm, botMissingPerm, success, base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'antiinvite',
  aliases: ['antilinks'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has('ManageGuild'))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });
    if (!message.guild.members.me.permissions.has('ManageMessages'))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'manage_messages')] });

    if (!args[0]) return message.channel.send({
      embeds: [base(Colors.neutral)
        .setTitle(`${prefix}antiinvite`)
        .setDescription('Block Discord invite links in this server')
        .addFields(
          { name: '**subcommands**', value: `${prefix}antiinvite enable\n${prefix}antiinvite disable` },
          { name: '**aliases**', value: 'antilinks' }
        )]
    });

    if (args[0] === 'enable') {
      await db.setAntiInvite(message.guild.id, true);
      return message.channel.send({ embeds: [success(`${message.author}: Antiinvite is now **enabled**`)] });
    }
    if (args[0] === 'disable') {
      await db.setAntiInvite(message.guild.id, false);
      return message.channel.send({ embeds: [success(`${message.author}: Successfully **disabled** antiinvite`)] });
    }
  }
};
