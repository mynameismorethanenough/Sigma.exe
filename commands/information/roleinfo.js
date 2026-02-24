const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { base, warn, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

const KEY_PERMS = [
  ['Administrator',          '👑 Administrator'],
  ['ManageGuild',            '⚙️ Manage Server'],
  ['ManageRoles',            '🎭 Manage Roles'],
  ['ManageChannels',         '📁 Manage Channels'],
  ['ManageMessages',         '📝 Manage Messages'],
  ['ManageNicknames',        '✏️ Manage Nicknames'],
  ['ManageWebhooks',         '🪝 Manage Webhooks'],
  ['ManageEmojisAndStickers','🤩 Manage Expressions'],
  ['BanMembers',             '🔨 Ban Members'],
  ['KickMembers',            '👢 Kick Members'],
  ['ModerateMembers',        '⏱️ Timeout Members'],
  ['MentionEveryone',        '📣 Mention Everyone'],
  ['ViewAuditLog',           '📋 View Audit Log'],
  ['MoveMembers',            '🔊 Move Members'],
  ['DeafenMembers',          '🔇 Deafen Members'],
  ['PrioritySpeaker',        '🎙️ Priority Speaker'],
  ['SendMessages',           '💬 Send Messages'],
  ['EmbedLinks',             '🔗 Embed Links'],
  ['AttachFiles',            '📎 Attach Files'],
  ['UseExternalEmojis',      '😀 External Emojis'],
  ['AddReactions',           '➕ Add Reactions'],
  ['UseApplicationCommands', '🤖 Use Slash Commands'],
];

module.exports = {
  name: 'roleinfo',
  aliases: ['ri'],
  category: 'information',

  run: async (client, message, args) => {
    const role = message.mentions.roles.first()
      ?? message.guild.roles.cache.get(args[0])
      ?? message.guild.roles.cache.find(r => r.name.toLowerCase() === args.join(' ').toLowerCase());

    if (!role) return message.channel.send({ embeds: [warn(`${message.author}: Provide a valid role — mention it or use its name/ID`)] });

    // Fetch member count properly
    await message.guild.members.fetch().catch(() => {});
    const memberCount = message.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
    const created = Math.floor(role.createdTimestamp / 1000);

    // Key permissions
    const perms = KEY_PERMS.filter(([flag]) => role.permissions.has(flag)).map(([, label]) => label);

    const embed = new EmbedBuilder()
      .setColor(role.color || Colors.neutral)
      .setTitle(`${role.name}`)
      .addFields(
        { name: '🆔 Role ID',       value: `\`${role.id}\``,              inline: true },
        { name: '🎨 Color',         value: `\`${role.hexColor}\``,         inline: true },
        { name: '📌 Position',      value: `#${role.position} of ${message.guild.roles.cache.size}`, inline: true },
        { name: '👥 Members',       value: `${memberCount}`,               inline: true },
        { name: '📣 Mentionable',   value: role.mentionable ? '✅ Yes' : '❌ No', inline: true },
        { name: '📌 Hoisted',       value: role.hoist ? '✅ Yes' : '❌ No',       inline: true },
        { name: '🤖 Managed',       value: role.managed ? '✅ Yes (Integration)' : '❌ No', inline: true },
        { name: '📅 Created',       value: `<t:${created}:F>\n<t:${created}:R>`, inline: true },
        { name: '🏷️ Mention',       value: role.mentionable ? `${role}` : `\`@${role.name}\``, inline: true },
      );

    if (perms.length) {
      embed.addFields({ name: `🔑 Key Permissions [${perms.length}]`, value: perms.join('\n'), inline: false });
    } else {
      embed.addFields({ name: '🔑 Key Permissions', value: 'No elevated permissions', inline: false });
    }

    // Role icon if available
    if (role.iconURL()) embed.setThumbnail(role.iconURL({ size: 256 }));

    embed.setFooter({ text: `Requested by ${message.author.tag}` }).setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }
};
