const { base, Colors } = require('../../utils/embeds');
const { OWNER_ID, OWNER_TAG } = require('../../utils/owner');
const os = require('os');

module.exports = {
  name: 'botinfo',
  category: 'information',
  run: async (client, message) => {
    const uptime  = Math.floor(process.uptime());
    const hours   = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    const mem     = process.memoryUsage();

    let ownerAvatarURL = null, ownerBannerURL = null;
    try {
      const owner = await client.users.fetch(OWNER_ID, { force: true });
      ownerAvatarURL = owner.displayAvatarURL({ size: 256, dynamic: true });
      if (owner.banner) ownerBannerURL = owner.bannerURL({ size: 1024, dynamic: true });
    } catch {}

    const embed = base(Colors.info)
      .setTitle(`📊 ${client.user.username} Bot Info`)
      .setThumbnail(ownerAvatarURL ?? client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🤖 Bot Stats',   inline: true, value: `**Ping:** \`${client.ws.ping}ms\`\n**Uptime:** \`${hours}h ${minutes}m ${seconds}s\`\n**Guilds:** \`${client.guilds.cache.size}\`\n**Users:** \`${client.users.cache.size}\`` },
        { name: '💾 Memory',      inline: true, value: `**Heap:** \`${Math.round(mem.heapUsed/1024/1024)}MB / ${Math.round(mem.heapTotal/1024/1024)}MB\`\n**RSS:** \`${Math.round(mem.rss/1024/1024)}MB\`` },
        { name: '🖥️ System',      inline: true, value: `**Platform:** \`${os.platform().toUpperCase()}\`\n**CPUs:** \`${os.cpus().length}\`\n**Node.js:** \`${process.version}\`` },
        { name: '👑 Owner',       value: `**${OWNER_TAG}** (\`${OWNER_ID}\`)\n> Creator & developer of this bot 🍵`, inline: false },
      )
      .setFooter({ text: `Made with 🍵 by ${OWNER_TAG}` });

    if (ownerBannerURL) embed.setImage(ownerBannerURL);
    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
