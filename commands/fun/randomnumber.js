const { base, Colors, warn } = require('../../utils/embeds');

module.exports = {
  name: 'randomnumber',
  aliases: ['rng', 'random'],
  run: async (client, message, args) => {
    const min = parseInt(args[0]) || 1;
    const max = parseInt(args[1]) || 100;
    if (min >= max) return message.channel.send({ embeds: [warn(`${message.author}: Min must be less than max`)] });
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    return message.channel.send({ embeds: [base(Colors.info)
      .setDescription(`🎲 ${message.author}: Your random number between **${min}** and **${max}**: **${num}**`)] });
  }
};
