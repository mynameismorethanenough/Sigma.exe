const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'logs',
  aliases: ['modlogs'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has('ManageGuild'))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    if (!args[0]) return message.channel.send({
      embeds: [base(Colors.neutral)
        .setTitle(`${prefix}logs`)
        .setDescription('Set your server modlogs')
        .addFields(
          { name: '**subcommands**', value: `${prefix}logs channel ＊ set your modlogs channel\n${prefix}logs clear ＊ remove the current modlog channel` },
          { name: '**usage**', value: `${prefix}logs` },
          { name: '**aliases**', value: 'modlogs' }
        )]
    });

    if (args[0] === 'clear') {
      await db.setLogChannel(message.guild.id, null);
      return message.channel.send({ embeds: [success(`${message.author}: The previous **modlogs channel** has been removed`)] });
    }

    if (args[0] === 'channel') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.channel.send({ embeds: [warn(`${message.author}: Do \`${prefix}logs channel [channel]\``)] });
      await db.setLogChannel(message.guild.id, channel.id);
      return message.channel.send({ embeds: [success(`${message.author}: Set the **modlogs channel** to ${channel}`)] });
    }
  }
};
