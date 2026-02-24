const db = require('../../database/db');
const { base, Colors, success } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'afk',
  run: async (client, message, args) => {
    const content = args.join(' ') || 'AFK';
    await db.setAfk(message.guild.id, message.author.id, content);
    return message.channel.send({
      embeds: [base(Colors.info)
        .setDescription(`💤 ${message.author}: You're now **AFK**\n> Status: **${content}**`)
      ]
    });
  }
};
