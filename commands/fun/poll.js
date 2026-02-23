const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, cmdHelp, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'poll',
  aliases: ['createpoll'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });
    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'poll', description: 'Create a poll', aliases: 'createpoll', parameters: 'question', info: '⚠️ Manage Messages', usage: 'poll <question>', example: 'poll Is this bot good?', module: 'fun' })] });

    const question = args.join(' ');
    await message.delete().catch(() => {});
    const embed = base(message.member.displayHexColor || Colors.neutral)
      .setTitle('__**Poll**__')
      .setDescription(question)
      .setAuthor({ name: `Poll created by: ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp()
      .setFooter({ text: client.user.username });
    const poll = await message.channel.send({ embeds: [embed] });
    await poll.react('👍');
    await poll.react('👎');
  }
};
