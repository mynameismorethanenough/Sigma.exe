const { base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'members',
  aliases: ['inrole'],
  run: async (client, message, args) => {
    if (!args[0]) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Provide a role to see members`)] });

    const role = message.mentions.roles.first()
      ?? message.guild.roles.cache.get(args[0])
      ?? message.guild.roles.cache.find(r => r.name.toLowerCase() === args.join(' ').toLowerCase());
    if (!role) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Invalid role`)] });

    const membersWithRole = message.guild.members.cache
      .filter(m => m.roles.cache.has(role.id))
      .map(m => m.user.tag);

    if (!membersWithRole.length) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: No members have the **${role.name}** role`)] });

    const list = membersWithRole.join('\n');
    message.channel.send({ embeds: [base(role.color)
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTitle(`Members in '${role.name}' [${membersWithRole.length}]`)
      .setDescription(list.length > 4096 ? list.slice(0, 4000) + '...' : list)]
    });
  }
};
