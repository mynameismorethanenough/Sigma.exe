const { base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'firstmessage',
  aliases: ['fm', 'first'],
  run: async (client, message, args) => {
    const channel = message.mentions.channels.first() ?? message.channel;
    const msgs = await channel.messages.fetch({ limit: 1, after: '0' }).catch(() => null);
    if (!msgs?.size) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ Couldn't fetch messages in ${channel}`)] });
    const first = msgs.first();
    return message.channel.send({ embeds: [base(Colors.info)
      .setTitle(`📌 First Message in #${channel.name}`)
      .setDescription(`[Jump to message](${first.url})\n> Sent by **${first.author?.tag ?? 'Unknown'}** <t:${Math.floor(first.createdTimestamp/1000)}:R>`)] });
  }
};
