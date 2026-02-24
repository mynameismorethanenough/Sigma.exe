const { EmbedBuilder } = require('discord.js');
const { warn, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'guildicon',
  aliases: ['servericon', 'icon'],
  category: 'utility',

  run: async (client, message, args) => {
    let guild = message.guild;

    if (args[0] && /^\d{17,20}$/.test(args[0])) {
      guild = client.guilds.cache.get(args[0]);
      if (!guild) return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(Colors.warn)
        .setDescription(`⚠️ ${message.author}: I'm not in a server with ID \`${args[0]}\``)] });
    }

    if (!guild.iconURL()) return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(Colors.neutral)
      .setDescription(`**${guild.name}** has no server icon`)] });

    const iconUrl = guild.iconURL({ dynamic: true, size: 4096 });

    return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor('Random')
      .setAuthor({ name: `${guild.name} — Server Icon`, iconURL: iconUrl })
      .setImage(iconUrl)
      .addFields(
        { name: '🔗 Links', value: `[PNG](${guild.iconURL({ format: 'png', size: 4096 })}) | [WebP](${guild.iconURL({ format: 'webp', size: 4096 })})${guild.icon?.startsWith('a_') ? ` | [GIF](${guild.iconURL({ format: 'gif', size: 4096 })})` : ''}` },
      )
      .setFooter({ text: `ID: ${guild.id}` })
      .setTimestamp()] });
  }
};
