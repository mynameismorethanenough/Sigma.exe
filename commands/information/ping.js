const { base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'ping',
  run: async (client, message) => {
    const sent = await message.channel.send({ embeds: [base(Colors.info).setDescription('🏓 Pinging...')] });
    const rtt = sent.createdTimestamp - message.createdTimestamp;
    await sent.edit({ embeds: [base(Colors.info).setDescription(`🏓 **Pong!**\n> Websocket: \`${client.ws.ping}ms\`\n> Roundtrip: \`${rtt}ms\``)] });
  }
};
