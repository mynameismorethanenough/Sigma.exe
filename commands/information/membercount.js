const { base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'membercount',
  run: async (client, message) => {
    const botCount = message.guild.members.cache.filter(m => m.user.bot).size;
    message.channel.send({ embeds: [base(Colors.info)
      .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
      .addFields(
        { name: '👥 Total', value: `${message.guild.memberCount}`, inline: true },
        { name: '👤 Humans', value: `${message.guild.memberCount - botCount}`, inline: true },
        { name: '🤖 Bots', value: `${botCount}`, inline: true },
      )]
    });
  }
};
