const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'warnings',
  aliases: ['warns', 'warnlist'],
  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return message.channel.send({ embeds: [missingPerm(message.author, 'moderate_members')] });

    const user = message.mentions.users.first() ?? message.guild.members.cache.get(args[0])?.user;
    if (!user) return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: Mention a user`)] });

    const warns = await db.getUserWarnings(message.guild.id, user.id).catch(() => []);
    if (!warns.length) return message.channel.send({ embeds: [base(Colors.success).setDescription(`✅ ${message.author}: **${user.tag}** has no warnings`)] });

    const lines = warns.map((r, i) =>
      `\`#${r.id}\` ⚠️ **Warn ${i + 1}** — <t:${Math.floor(new Date(r.created_at).getTime()/1000)}:R>\n↳ ${r.reason ?? 'No reason'} | by <@${r.mod_user_id}>`
    ).join('\n\n');

    return message.channel.send({ embeds: [base(Colors.warn)
      .setAuthor({ name: `${user.tag} — Warnings`, iconURL: user.displayAvatarURL() })
      .setDescription(lines)
      .setFooter({ text: `${warns.length} warning(s) total` })] });
  }
};
