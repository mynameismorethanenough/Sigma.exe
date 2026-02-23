const { EmbedBuilder } = require('discord.js');
const { warn, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'serveravatar',
  aliases: ['sav', 'memberavatar', 'guildavatar'],
  category: 'information',

  run: async (client, message, args) => {
    const member = message.mentions.members.first()
      ?? message.guild.members.cache.get(args[0])
      ?? message.member;

    const globalAv = member.user.displayAvatarURL({ dynamic: true, size: 2048 });
    const serverAv = member.displayAvatarURL({ dynamic: true, size: 2048 }); // uses guild avatar if set

    const hasServerAv = member.avatar != null;

    if (!hasServerAv) {
      return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(Colors.neutral)
        .setDescription(`**${member.user.tag}** has no server-specific avatar — showing global avatar`)
        .setImage(globalAv)
        .setFooter({ text: `ID: ${member.id}` })] });
    }

    const serverAvFull = member.avatarURL({ dynamic: true, size: 2048 });

    return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor('Random')
      .setAuthor({ name: `${member.user.tag}'s Server Avatar`, iconURL: serverAvFull })
      .setImage(serverAvFull)
      .addFields(
        { name: '🏠 Server Avatar', value: `[PNG](${member.avatarURL({ format: 'png', size: 2048 })}) | [WebP](${member.avatarURL({ format: 'webp', size: 2048 })})${member.avatar?.startsWith('a_') ? ` | [GIF](${member.avatarURL({ format: 'gif', size: 2048 })})` : ''}`, inline: false },
        { name: '🌐 Global Avatar',  value: `[View](${globalAv})`, inline: false },
      )
      .setFooter({ text: `${message.guild.name} • ID: ${member.id}` })
      .setTimestamp()] });
  }
};
