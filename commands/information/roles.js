const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

const PER_PAGE = 20;

module.exports = {
  name: 'roles',
  aliases: ['rolelist', 'allroles'],
  category: 'information',

  run: async (client, message) => {
    const sorted = [...message.guild.roles.cache.values()]
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position);

    if (!sorted.length)
      return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.neutral).setDescription('📭 No roles found')] });

    const pages = Math.ceil(sorted.length / PER_PAGE);
    let page = 0;

    function buildEmbed(p) {
      const slice = sorted.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
      return new EmbedBuilder()
        .setColor(Colors.info)
        .setAuthor({ name: `${message.guild.name} — Roles [${sorted.length}]`, iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(slice.map((r, i) => {
          const n = p * PER_PAGE + i + 1;
          const memberCount = message.guild.members.cache.filter(m => m.roles.cache.has(r.id)).size;
          return `\`${n}.\` ${r} — \`${r.hexColor}\` — **${memberCount}** member${memberCount !== 1 ? 's' : ''}`;
        }).join('\n'))
        .setFooter({ text: `Page ${p + 1}/${pages} • ${sorted.length} roles total` })
        .setTimestamp();
    }

    function buildRow(p) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('r_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId('r_page').setLabel(`${p + 1}/${pages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('r_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(p === pages - 1),
      );
    }

    const msg = await message.channel.send({ embeds: [buildEmbed(page)], components: pages > 1 ? [buildRow(page)] : [] });
    if (pages <= 1) return;

    const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60_000 });
    col.on('collect', async i => {
      if (i.customId === 'r_prev') page = Math.max(0, page - 1);
      if (i.customId === 'r_next') page = Math.min(pages - 1, page + 1);
      await i.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
    });
    col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  }
};
