const { EmbedBuilder } = require('discord.js');

const Colors = {
  default:  0x2b2d31,
  success:  0x57f287,   // discord green
  error:    0xed4245,   // discord red
  warn:     0xfee75c,   // discord yellow
  info:     0x5865f2,   // discord blurple
  mod:      0xe74c3c,
  security: 0xff6b35,
  neutral:  0x36393f,
  bleed:    0x95a5a6,
  jail:     0x818386,
  voice:    0x3498db,
  invite:   0x9b59b6,
  msg:      0x2ecc71,
};

const E = {
  approve: '<:approve:✅>',
  warn:    '⚠️',
  deny:    '❌',
  add:     '➕',
  remove:  '➖',
  // Use unicode since we don't have custom emojis
};

// Override with safe unicode emojis
Object.assign(E, { approve: '✅', deny: '❌' });

function base(color = Colors.bleed) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

function success(description) {
  return new EmbedBuilder().setColor(Colors.success).setDescription(`${E.approve} ${description}`);
}

function error(description) {
  return new EmbedBuilder().setColor(Colors.error).setDescription(`${E.deny} ${description}`);
}

function warn(description) {
  return new EmbedBuilder().setColor(Colors.warn).setDescription(`${E.warn} ${description}`);
}

function info(description) {
  return new EmbedBuilder().setColor(Colors.info).setDescription(description);
}

function missingPerm(user, perm) {
  return new EmbedBuilder().setColor(Colors.warn)
    .setDescription(`${E.warn} ${user}: You're **missing** permission: \`${perm}\``);
}

function botMissingPerm(user, perm) {
  return new EmbedBuilder().setColor(Colors.warn)
    .setDescription(`${E.warn} ${user}: I'm **missing** permission: \`${perm}\``);
}

function cmdHelp({ author, name, description, aliases = 'N/A', parameters, info: infoText, usage, example, module: mod }) {
  const aliasStr = Array.isArray(aliases) ? aliases.join(', ') : aliases;
  return new EmbedBuilder()
    .setColor(Colors.bleed)
    .setAuthor({ name: author.username, iconURL: author.displayAvatarURL({ dynamic: true }) })
    .setTitle(`Command: ${name}`)
    .setDescription(description)
    .addFields(
      { name: '**Aliases**',     value: aliasStr,    inline: true },
      { name: '**Parameters**',  value: parameters,  inline: true },
      { name: '**Information**', value: infoText,     inline: true },
      { name: '**Usage**',       value: `\`\`\`Syntax: ${usage}\nExample: ${example}\`\`\`` },
    )
    .setFooter({ text: `Module: ${mod}` })
    .setTimestamp();
}

function antinukeAlert({ action, executor, target = null, punishment, guildName }) {
  return new EmbedBuilder()
    .setColor(Colors.security)
    .setTitle('🛡️ Antinuke Triggered')
    .addFields(
      { name: '⚠️ Action Detected', value: `\`${action}\``, inline: true },
      { name: '⚡ Punishment',      value: `\`${punishment}\``, inline: true },
      { name: '\u200b',             value: '\u200b',            inline: true },
      { name: '👤 Executor', value: `${executor.tag}\n\`${executor.id}\``, inline: true },
      ...(target ? [{ name: '🎯 Target', value: `${target}`, inline: true }] : []),
    )
    .setFooter({ text: `${guildName} • Security System` })
    .setTimestamp();
}

module.exports = { Colors, E, base, success, error, warn, info, missingPerm, botMissingPerm, cmdHelp, antinukeAlert };
