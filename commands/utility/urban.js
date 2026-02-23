const https = require('https');
const { base, Colors, warn } = require('../../utils/embeds');

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

module.exports = {
  name: 'urban',
  aliases: ['ud', 'define'],
  run: async (client, message, args) => {
    if (!args[0]) return message.channel.send({ embeds: [warn(`${message.author}: Provide a term to define`)] });
    const term = args.join(' ');
    try {
      const data = await get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
      if (!data.list?.length) return message.channel.send({ embeds: [warn(`${message.author}: No definition found for **${term}**`)] });

      const top = data.list[0];
      const definition = top.definition.replace(/\[|\]/g, '').slice(0, 1000);
      const example = top.example.replace(/\[|\]/g, '').slice(0, 500) || '*No example*';

      return message.channel.send({ embeds: [base(Colors.info)
        .setTitle(`📖 ${top.word}`)
        .setURL(top.permalink)
        .setDescription(definition)
        .addFields(
          { name: '**Example**', value: example },
          { name: '👍', value: `${top.thumbs_up}`, inline: true },
          { name: '👎', value: `${top.thumbs_down}`, inline: true },
          { name: '**Author**', value: top.author, inline: true },
        )
        .setFooter({ text: 'Urban Dictionary' })] });
    } catch {
      return message.channel.send({ embeds: [warn(`${message.author}: Failed to fetch definition`)] });
    }
  }
};
