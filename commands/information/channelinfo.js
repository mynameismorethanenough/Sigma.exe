const { EmbedBuilder, ChannelType } = require('discord.js');
const { base, warn, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

const CH_TYPE = {
  [ChannelType.GuildText]:          '💬 Text',
  [ChannelType.GuildVoice]:         '🔊 Voice',
  [ChannelType.GuildCategory]:      '📂 Category',
  [ChannelType.GuildAnnouncement]:  '📢 Announcement',
  [ChannelType.GuildStageVoice]:    '🎙️ Stage',
  [ChannelType.GuildForum]:         '📋 Forum',
  [ChannelType.GuildDirectory]:     '📁 Directory',
  [ChannelType.GuildMedia]:         '🖼️ Media',
  [ChannelType.PublicThread]:       '🧵 Public Thread',
  [ChannelType.PrivateThread]:      '🔒 Private Thread',
  [ChannelType.AnnouncementThread]: '📢 Announcement Thread',
};

module.exports = {
  name: 'channelinfo',
  aliases: ['ci', 'channel'],
  category: 'information',

  run: async (client, message, args) => {
    // Resolve channel: mention, ID, or current
    const channel = message.mentions.channels.first()
      ?? message.guild.channels.cache.get(args[0])
      ?? message.guild.channels.cache.find(c => c.name.toLowerCase() === args.join(' ').toLowerCase())
      ?? message.channel;

    if (!channel) return message.channel.send({ embeds: [warn(`${message.author}: Channel not found`)] });

    const created = Math.floor(channel.createdTimestamp / 1000);
    const typeStr = CH_TYPE[channel.type] ?? `Unknown (${channel.type})`;

    const embed = new EmbedBuilder()
      .setColor(Colors.info)
      .setTitle(`${typeStr} — ${channel.name}`)
      .addFields(
        { name: '🆔 ID',        value: `\`${channel.id}\``,                  inline: true },
        { name: '📁 Type',      value: typeStr,                               inline: true },
        { name: '📅 Created',   value: `<t:${created}:F>\n<t:${created}:R>`, inline: true },
      );

    // Category
    if (channel.parent) {
      embed.addFields({ name: '📂 Category', value: channel.parent.name, inline: true });
    }

    // Text channel specific
    if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
      if (channel.topic) embed.addFields({ name: '📝 Topic', value: channel.topic.slice(0, 1024), inline: false });
      embed.addFields(
        { name: '🔞 NSFW',      value: channel.nsfw ? '✅ Yes' : '❌ No',   inline: true },
        { name: '⏱️ Slowmode',  value: channel.rateLimitPerUser ? `${channel.rateLimitPerUser}s` : 'Off', inline: true },
      );
    }

    // Voice channel specific
    if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
      embed.addFields(
        { name: '🔊 Bitrate',      value: `${Math.floor(channel.bitrate / 1000)}kbps`, inline: true },
        { name: '👥 User Limit',   value: channel.userLimit ? `${channel.userLimit}` : 'Unlimited', inline: true },
        { name: '🎙️ Connected',    value: `${channel.members?.size ?? 0} user(s)`, inline: true },
        { name: '📡 Region',       value: channel.rtcRegion ?? 'Automatic', inline: true },
      );
    }

    // Permissions overwrites count
    const overwriteCount = channel.permissionOverwrites?.cache?.size ?? 0;
    if (overwriteCount) {
      embed.addFields({ name: '🔒 Permission Overwrites', value: `${overwriteCount}`, inline: true });
    }

    // Position
    embed.addFields({ name: '📌 Position', value: `${channel.position ?? 'N/A'}`, inline: true });

    // Thread-specific
    if (channel.isThread()) {
      embed.addFields(
        { name: '🧵 Parent',   value: channel.parent ? `${channel.parent}` : 'Unknown', inline: true },
        { name: '🔒 Archived', value: channel.archived ? 'Yes' : 'No', inline: true },
        { name: '📌 Locked',   value: channel.locked   ? 'Yes' : 'No', inline: true },
      );
    }

    embed
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }
};
