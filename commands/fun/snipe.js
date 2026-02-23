const db = require('../../database/db');
const { base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'snipe',
  aliases: ['s'],
  run: async (client, message) => {
    const snipe = await db.getSnipe(message.channel.id).catch(() => null);
    if (!snipe) return message.channel.send({ embeds: [base(Colors.info).setDescription(`🔍 ${message.author}: No **recently deleted messages** were found in this channel`)] });

    const embed = base(message.member.displayHexColor || Colors.neutral)
      .setAuthor({ name: snipe.author_tag, iconURL: snipe.author_avatar })
      .setDescription(snipe.content || '*[no text content]*')
      .setFooter({ text: `Sniped by: ${message.author.tag}` })
      .setTimestamp(new Date(snipe.deleted_at));
    if (snipe.image_url) embed.setImage(snipe.image_url);
    return message.channel.send({ embeds: [embed] });
  }
};
