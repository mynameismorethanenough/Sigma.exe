const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Colors } = require('../../utils/embeds');

const PER_PAGE = 15;

module.exports = {
  name: 'bots',
  aliases: ['botlist', 'allbots'],
  category: 'information',

  run: async (client, message) => {
    await message.guild.members.fetch().catch(() => {});
    const bots = [...message.guild.members.cache.values()]
      .filter(m => m.user.bot)
      .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);

    if (!bots.length)
      return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.neutral).setDescription('📭 No bots in this server')] });

    const pages = Math.ceil(bots.length / PER_PAGE);
    let page = 0;

    function buildEmbed(p) {
      const slice = bots.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
      return new EmbedBuilder()
        .setColor(Colors.info)
        .setAuthor({ name: `${message.guild.name} — Bots [${bots.length}]`, iconURL: message.guild.iconURL({ dynamic: true }) })
        .setDescription(slice.map((m, i) => {
          const n = p * PER_PAGE + i + 1;
          const joined = Math.floor(m.joinedTimestamp / 1000);
          const isVerified = m.user.flags?.has('VerifiedBot') ? '✅' : '🤖';
          return `\`${n}.\` ${isVerified} **${m.user.tag}** (\`${m.user.id}\`) — joined <t:${joined}:R>`;
        }).join('\n'))
        .setFooter({ text: `Page ${p + 1}/${pages} • ${bots.length} bots • Sorted by join date` })
        .setTimestamp();
    }

    function buildRow(p) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('b_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId('b_page').setLabel(`${p + 1}/${pages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('b_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(p === pages - 1),
      );
    }

    const msg = await message.channel.send({ embeds: [buildEmbed(page)], components: pages > 1 ? [buildRow(page)] : [] });
    if (pages <= 1) return;

    const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60_000 });
    col.on('collect', async i => {
      if (i.customId === 'b_prev') page = Math.max(0, page - 1);
      if (i.customId === 'b_next') page = Math.min(pages - 1, page + 1);
      await i.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
    });
    col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  }
};
