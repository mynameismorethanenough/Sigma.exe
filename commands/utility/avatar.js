const { EmbedBuilder } = require('discord.js');
const { warn, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'avatar',
  aliases: ['av', 'pfp'],
  category: 'utility',

  run: async (client, message, args) => {
    const member = message.mentions.members.first()
      ?? message.guild.members.cache.get(args[0])
      ?? message.member;

    const user = await client.users.fetch(member.id, { force: true }).catch(() => member.user);

    const globalAv  = user.displayAvatarURL({ dynamic: true, size: 2048 });
    const serverAv  = member.displayAvatarURL({ dynamic: true, size: 2048 });
    const isDiff    = member.avatar != null; // has a guild-specific avatar

    const embed = new EmbedBuilder()
      .setColor('Random')
      .setAuthor({ name: `${user.tag}'s Avatar`, iconURL: globalAv })
      .setImage(globalAv)
      .addFields(
        { name: '🌐 Global Avatar', value: `[PNG](${user.displayAvatarURL({ format: 'png', size: 2048 })}) | [WebP](${user.displayAvatarURL({ format: 'webp', size: 2048 })})${user.avatar?.startsWith('a_') ? ` | [GIF](${user.displayAvatarURL({ format: 'gif', size: 2048 })})` : ''}`, inline: false },
      );

    if (isDiff) {
      embed.addFields({ name: '🏠 Server Avatar', value: `[View](${serverAv}) — *has a different server avatar*`, inline: false });
    }

    embed.setFooter({ text: isDiff ? 'Use ,serveravatar to see their guild-specific avatar' : `ID: ${user.id}` });

    return message.channel.send({ embeds: [embed] });
  }
};
