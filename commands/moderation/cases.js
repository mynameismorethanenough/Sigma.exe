const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors } = require('../../utils/embeds');
const typeEmoji = { ban:'🔨', kick:'👢', warn:'⚠️', timeout:'⏱️', mute:'🔇' };

module.exports = {
  name: 'cases',
  aliases: ['infractions', 'history'],
  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'moderate_members')] });

    const user = message.mentions.users.first() ?? message.guild.members.cache.get(args[0])?.user;
    if (!user) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Mention a user`)] });

    const records = await db.getUserInfractions(message.guild.id, user.id).catch(() => []);
    if (!records.length) return message.channel.send({ embeds: [base(Colors.success).setDescription(`✅ ${message.author}: **${user.tag}** has no infractions`)] });

    const lines = records.map(r => {
      const ts = Math.floor(new Date(r.created_at).getTime() / 1000);
      return `\`#${r.id}\` ${typeEmoji[r.type] ?? '🛡️'} **${r.type}** — <t:${ts}:R>\n↳ ${r.reason ?? 'No reason'}`;
    }).join('\n\n');

    return message.channel.send({ embeds: [base(Colors.mod).setAuthor({ name: `Cases for ${user.tag}`, iconURL: user.displayAvatarURL() }).setDescription(lines).setFooter({ text: `${records.length} infraction(s) total` })] });
  }
};
