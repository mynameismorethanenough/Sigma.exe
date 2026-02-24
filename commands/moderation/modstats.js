const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'modstats',
  aliases: ['modstats', 'moderatorstats'],
  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'moderate_members')] });

    const { guild, author } = message;
    const target = message.mentions.users.first() ?? (await resolveMember(message.guild, client, args[0]))?.user ?? message.author;

    const rows = await db.getModStats(guild.id, target.id).catch(() => []);
    if (!rows.length) return message.channel.send({ embeds: [base(Colors.neutral)
      .setDescription(`📭 **${target.tag}** has no moderation actions recorded in this server`)] });

    const total = rows.reduce((s, r) => s + parseInt(r.count), 0);
    const lines = rows
      .sort((a, b) => parseInt(b.count) - parseInt(a.count))
      .map(r => `\`${String(r.count).padStart(4, ' ')}\` **${r.type}**`)
      .join('\n');

    return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.mod)
      .setAuthor({ name: `${target.tag} — Mod Stats`, iconURL: target.displayAvatarURL({ dynamic: true }) })
      .setDescription(lines)
      .setFooter({ text: `${total} total actions in ${guild.name}` })] });
  }
};
