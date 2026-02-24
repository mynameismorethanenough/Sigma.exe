const { base } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

module.exports = {
  name: 'color',
  aliases: ['colour', 'hex'],
  run: async (client, message, args) => {
    let hex = args[0]?.replace('#', '');
    if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex))
      return message.channel.send({ embeds: [base(0xfee75c).setDescription('⚠️ Provide a valid hex color (e.g. `#ff0000`)')] });

    hex = hex.toUpperCase();
    const int = parseInt(hex, 16);
    const rgb = hexToRgb(hex);

    return message.channel.send({ embeds: [new (require('discord.js').EmbedBuilder)()
      .setColor(int)
      .setTitle(`Color: #${hex}`)
      .setThumbnail(`https://singlecolorimage.com/get/${hex}/128x128`)
      .addFields(
        { name: 'Hex',     value: `\`#${hex}\``,                              inline: true },
        { name: 'RGB',     value: `\`${rgb.r}, ${rgb.g}, ${rgb.b}\``,         inline: true },
        { name: 'Integer', value: `\`${int}\``,                               inline: true },
      )] });
  }
};
