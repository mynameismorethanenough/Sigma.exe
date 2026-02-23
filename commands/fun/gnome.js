const { base, Colors, warn } = require('../../utils/embeds');

module.exports = {
  name: 'gnome',
  run: async (client, message, args) => {
    const member = message.mentions.members.first() ?? message.guild.members.cache.get(args[0]);
    if (!member) return message.channel.send({ embeds: [warn(`${message.author}: Mention someone to gnome`)] });
    return message.channel.send({ embeds: [base(Colors.info)
      .setDescription(`**${member.user.tag}** has been gnomed. 🧙‍♂️\n\nhttps://i.imgur.com/hfMl6rl.gif`)] });
  }
};
