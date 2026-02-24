const { base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'uptime',
  run: async (client, message) => {
    const ms = client.uptime;
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    message.channel.send({ embeds: [base(Colors.info).setDescription(`⏱️ **Uptime:** \`${d}d ${h}h ${m}m ${s}s\``)] });
  }
};
