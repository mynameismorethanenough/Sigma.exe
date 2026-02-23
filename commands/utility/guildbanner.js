const { EmbedBuilder } = require('discord.js');
const { warn, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'guildbanner',
  aliases: ['gbanner'],
  category: 'utility',

  run: async (client, message, args) => {
    let guild = message.guild;

    if (args[0] && /^\d{17,20}$/.test(args[0])) {
      guild = client.guilds.cache.get(args[0]);
      if (!guild) return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(Colors.warn)
        .setDescription(`⚠️ ${message.author}: I'm not in a server with ID \`${args[0]}\``)] });
    }

    if (!guild.bannerURL()) return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(Colors.neutral)
      .setDescription(`**${guild.name}** has no server banner`)] });

    const bannerUrl = guild.bannerURL({ size: 4096 });

    return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor('Random')
      .setAuthor({ name: `${guild.name} — Server Banner`, iconURL: guild.iconURL({ dynamic: true }) ?? undefined })
      .setImage(bannerUrl)
      .addFields(
        { name: '🔗 Links', value: `[PNG](${guild.bannerURL({ format: 'png', size: 4096 })}) | [WebP](${guild.bannerURL({ format: 'webp', size: 4096 })})` },
      )
      .setFooter({ text: `ID: ${guild.id}` })
      .setTimestamp()] });
  }
};
