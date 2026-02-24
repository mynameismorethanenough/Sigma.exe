const { base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'coinflip',
  aliases: ['cf', 'flip'],
  run: async (client, message) => {
    const result = Math.random() < 0.5 ? '🪙 **Heads**' : '🪙 **Tails**';
    return message.channel.send({ embeds: [base(Colors.info)
      .setDescription(`${message.author} flipped a coin...\n\n${result}!`)] });
  }
};
