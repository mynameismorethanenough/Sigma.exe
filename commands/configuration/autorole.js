const db = require('../../database/db');
const { missingPerm, botMissingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'autorole',
  aliases: ['ar'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has('ManageGuild'))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });
    if (!message.guild.members.me.permissions.has('ManageRoles'))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'manage_roles')] });

    if (!args[0]) return message.channel.send({
      embeds: [base(Colors.neutral)
        .setTitle(`**${prefix}autorole**`)
        .setDescription('Set up autorole when new members join')
        .addFields(
          { name: '**subcommands**', value: `${prefix}autorole set <role> ＊ set the autorole\n${prefix}autorole clear ＊ clear the autorole` },
          { name: '**aliases**', value: 'ar' }
        )]
    });

    if (args[0] === 'set') {
      const role = message.mentions.roles.first() ?? message.guild.roles.cache.find(r => r.name === args.slice(1).join(' '));
      if (!role) return message.channel.send({ embeds: [warn(`${message.author}: That role doesn't exist: \`${args.slice(1).join(' ')}\``)] });
      await db.setAutorole(message.guild.id, role.id);
      return message.channel.send({ embeds: [success(`${message.author}: Autorole is now set to **${role.name}**`)] });
    }

    if (args[0] === 'clear') {
      await db.setAutorole(message.guild.id, null);
      return message.channel.send({ embeds: [success(`${message.author}: The autorole is now **cleared**`)] });
    }
  }
};
