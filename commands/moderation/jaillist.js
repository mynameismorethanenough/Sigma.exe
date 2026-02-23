const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'jaillist',
  aliases: ['jailed', 'jailview'],
  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });

    const { guild, author } = message;
    const jailed = await db.getJailedList(guild.id).catch(() => []);

    if (!jailed.length) return message.channel.send({ embeds: [base(Colors.success).setDescription(`✅ ${author}: No members are currently jailed`)] });

    const lines = jailed.map((r, i) => {
      const ts = Math.floor(new Date(r.jailed_at).getTime() / 1000);
      const expires = r.expires_at ? `expires <t:${Math.floor(new Date(r.expires_at).getTime()/1000)}:R>` : 'indefinite';
      return `\`${i + 1}.\` <@${r.user_id}> — <t:${ts}:R> | ${expires}\n> ${r.reason ?? 'No reason'} | by <@${r.jailed_by}>`;
    }).join('\n\n');

    return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.jail)
      .setTitle(`🔒 Jailed Members — ${jailed.length}`)
      .setDescription(lines.slice(0, 4000))
      .setFooter({ text: `${guild.name} • Use ,unjail @user to release` })] });
  }
};
