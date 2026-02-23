/**
 * Roleplay helper — fetches GIFs from waifu.pics API
 * Endpoint: GET https://api.waifu.pics/sfw/<type>
 */
const https = require('https');

function fetchGif(type) {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://api.waifu.pics/sfw/${type}`, { headers: { 'Accept': 'application/json' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).url ?? null); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

/**
 * Build an action embed
 * @param {object} opts
 * @param {string} opts.action      — verb e.g. "hugs"
 * @param {string} opts.emoji       — emoji prefix
 * @param {string} opts.color       — hex number
 * @param {import('discord.js').User} opts.author
 * @param {import('discord.js').User|null} opts.target
 * @param {string|null} opts.gifUrl
 * @param {string} opts.selfMsg     — used when author targets self
 * @param {string} opts.noTargetMsg — used when no target (e.g. cries alone)
 */
function buildActionEmbed(opts) {
  const { EmbedBuilder } = require('discord.js');
  const { action, emoji, color, author, target, gifUrl, selfMsg, noTargetMsg } = opts;

  let desc;
  if (!target || target.id === author.id) {
    desc = selfMsg ?? `**${author.username}** ${action} themselves`;
  } else {
    desc = `**${author.username}** ${action} **${target.username}** ${emoji}`;
  }

  const embed = new EmbedBuilder()
    .setColor(color ?? 0xff6b9d)
    .setDescription(desc);
  if (gifUrl) embed.setImage(gifUrl);
  embed.setFooter({ text: `Requested by ${author.tag}` }).setTimestamp();
  return embed;
}

module.exports = { fetchGif, buildActionEmbed };
