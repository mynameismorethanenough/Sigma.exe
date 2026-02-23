const { base, Colors, cmdHelp } = require('../../utils/embeds');

function parseTime(str) {
  const match = str?.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const u = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(match[1]) * u[match[2].toLowerCase()];
}

module.exports = {
  name: 'remind',
  aliases: ['reminder', 'rm'],
  run: async (client, message, args, prefix) => {
    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({ author: message.author, name: 'remind', description: 'Set a reminder', aliases: 'reminder, rm', parameters: 'time, text', info: 'N/A', usage: 'remind (duration) <reason>', example: 'remind 1h To get food', module: 'utility' })] });

    const time = args[0];
    const reminder = args.slice(1).join(' ');
    const ms = parseTime(time);

    if (!ms) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: The time must be in the format **<number>[s/m/h/d]**`)] });
    if (!reminder) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Provide something to remind you about`)] });

    await message.channel.send(`ok i'll remind you in \`${time}\` 👍`);

    setTimeout(async () => {
      message.author.send({ embeds: [base(Colors.info).setDescription(`⏰ ${message.author}: You wanted me to remind you to: **${reminder}** (\`${time}\`)`)] }).catch(() => {
        message.channel.send({ embeds: [base(Colors.info).setDescription(`⏰ ${message.author}: You wanted me to remind you to: **${reminder}**`)] }).catch(() => {});
      });
    }, ms);
  }
};
