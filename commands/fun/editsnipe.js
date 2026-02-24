const db = require('../../database/db');
const { base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'editsnipe',
  aliases: ['es'],
  run: async (client, message) => {
    const snipe = await db.getEditSnipe(message.channel.id).catch(() => null);
    if (!snipe) return message.channel.send({ embeds: [base(Colors.info).setDescription(`🔍 ${message.author}: No **recently edited messages** in this channel`)] });

    const embed = base(message.member.displayHexColor || Colors.bleed)
      .setAuthor({ name: snipe.author_tag, iconURL: snipe.author_avatar })
      .setTitle('📝 Edited Message')
      .addFields(
        { name: '**Before**', value: snipe.before_content?.slice(0, 1000) || '*[empty]*' },
        { name: '**After**',  value: snipe.after_content?.slice(0, 1000)  || '*[empty]*' },
      )
      .setFooter({ text: `Sniped by: ${message.author.tag}` })
      .setTimestamp(new Date(snipe.edited_at));
    if (snipe.message_url) embed.setDescription(`[Jump to message](${snipe.message_url})`);
    return message.channel.send({ embeds: [embed] });
  }
};
