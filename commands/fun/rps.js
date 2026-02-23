const { base, Colors } = require('../../utils/embeds');
const CHOICES = ['🪨 Rock', '📄 Paper', '✂️ Scissors'];
const wins = { 0: 2, 1: 0, 2: 1 }; // index that beats each

module.exports = {
  name: 'rps',
  aliases: ['rockpaperscissors'],
  run: async (client, message, args) => {
    const input = args[0]?.toLowerCase();
    const map = { rock: 0, r: 0, paper: 1, p: 1, scissors: 2, s: 2 };
    const userIdx = map[input];
    if (userIdx === undefined)
      return message.channel.send({ embeds: [base(Colors.warn).setDescription('⚠️ Choose: `rock` `paper` `scissors`')] });

    const botIdx = Math.floor(Math.random() * 3);
    let result;
    if (userIdx === botIdx) result = "It's a **tie**! 🤝";
    else if (wins[userIdx] === botIdx) result = "You **win**! 🎉";
    else result = "You **lose**! 😔";

    return message.channel.send({ embeds: [base(Colors.info)
      .setTitle('🎮 Rock Paper Scissors')
      .addFields(
        { name: '👤 You',  value: CHOICES[userIdx], inline: true },
        { name: '🤖 Bot',  value: CHOICES[botIdx],  inline: true },
        { name: '🏆 Result', value: result }
      )] });
  }
};
