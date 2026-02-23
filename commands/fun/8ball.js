const { base, Colors } = require('../../utils/embeds');

const RESPONSES = [
  // positive
  '🟢 It is certain.', '🟢 It is decidedly so.', '🟢 Without a doubt.',
  '🟢 Yes, definitely.', '🟢 You may rely on it.', '🟢 As I see it, yes.',
  '🟢 Most likely.', '🟢 Outlook good.', '🟢 Yes.', '🟢 Signs point to yes.',
  // neutral
  '🟡 Reply hazy, try again.', '🟡 Ask again later.', '🟡 Better not tell you now.',
  '🟡 Cannot predict now.', '🟡 Concentrate and ask again.',
  // negative
  '🔴 Don\'t count on it.', '🔴 My reply is no.', '🔴 My sources say no.',
  '🔴 Outlook not so good.', '🔴 Very doubtful.',
];

module.exports = {
  name: '8ball',
  aliases: ['8b', 'ask'],
  run: async (client, message, args) => {
    if (!args[0]) return message.channel.send({ embeds: [base(Colors.warn).setDescription('⚠️ Ask me a question!')] });
    const question = args.join(' ');
    const answer = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    return message.channel.send({ embeds: [base(Colors.info)
      .setTitle('🎱 Magic 8-Ball')
      .addFields(
        { name: '❓ Question', value: question },
        { name: '💬 Answer',   value: answer },
      )] });
  }
};
