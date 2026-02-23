/**
 * Factory to create roleplay commands quickly.
 * Each roleplay command is a thin wrapper around this builder.
 */
const { fetchGif, buildActionEmbed } = require('../../utils/roleplay');

/**
 * @param {object} def
 * @param {string}   def.name
 * @param {string[]} [def.aliases]
 * @param {string}   def.apiType   — waifu.pics endpoint type
 * @param {string}   def.emoji     — decorative emoji
 * @param {number}   def.color     — embed color
 * @param {string}   def.action    — verb phrase e.g. "hugs"
 * @param {string}   [def.selfMsg] — message when no/self target
 * @param {boolean}  [def.requireTarget]
 */
function buildRoleplay(def) {
  return {
    name:     def.name,
    aliases:  def.aliases ?? [],
    category: 'roleplay',

    run: async (client, message, args) => {
      const target = message.mentions.users.first() ?? null;

      if (def.requireTarget && !target) {
        return message.channel.send({ content: `${def.emoji} Mention someone to ${def.name}!` });
      }

      const gifUrl = await fetchGif(def.apiType).catch(() => null);

      const embed = buildActionEmbed({
        action:   def.action,
        emoji:    def.emoji,
        color:    def.color,
        author:   message.author,
        target,
        gifUrl,
        selfMsg:  def.selfMsg,
      });

      return message.channel.send({ embeds: [embed] });
    }
  };
}

module.exports = { buildRoleplay };
