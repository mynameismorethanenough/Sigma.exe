const { EmbedBuilder } = require('discord.js');
const { warn, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'banner',
  aliases: ['userbanner', 'ub'],
  category: 'utility',

  run: async (client, message, args) => {
    const member = message.mentions.members.first()
      ?? message.guild.members.cache.get(args[0])
      ?? message.member;

    const user = await client.users.fetch(member.id, { force: true }).catch(() => member.user);

    if (!user.banner) {
      // Show accent color if no banner
      const color = user.accentColor ? `#${user.accentColor.toString(16).padStart(6, '0')}` : null;
      return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(color ? parseInt(user.accentColor) : Colors.neutral)
        .setDescription(`**${user.tag}** has no banner${color ? `\n🎨 Accent color: \`${color}\`` : ''}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))] });
    }

    const bannerUrl = user.bannerURL({ dynamic: true, size: 4096 });

    return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor('Random')
      .setAuthor({ name: `${user.tag}'s Banner`, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setImage(bannerUrl)
      .addFields(
        { name: '🔗 Links', value: `[PNG](${user.bannerURL({ format: 'png', size: 4096 })}) | [WebP](${user.bannerURL({ format: 'webp', size: 4096 })})${user.banner?.startsWith('a_') ? ` | [GIF](${user.bannerURL({ format: 'gif', size: 4096 })})` : ''}` },
      )
      .setFooter({ text: `ID: ${user.id}` })
      .setTimestamp()] });
  }
};
