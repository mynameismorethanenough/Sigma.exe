const { base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'pp',
  aliases: ['ppsize'],
  run: async (client, message, args) => {
    const user = message.mentions.users.first() ?? message.author;
    // Deterministic based on user ID so it's consistent per user
    const seed = parseInt(user.id.slice(-4), 10) % 20;
    const bar = '█'.repeat(seed) + '░'.repeat(20 - seed);
    return message.channel.send({ embeds: [base(Colors.info)
      .setDescription(`🍆 **${user.username}'s pp size:**\n\`[${bar}]\` ${seed}/20`)] });
  }
};
