/**
 * welcome — Configure welcome messages (multi-channel system)
 * welcome add <#channel> <message>   welcome remove <#channel>
 * welcome view <#channel>            welcome list
 * welcome variables                  welcome test [#channel]
 * Legacy: welcome channel/message/embed/enable/disable/status/clear
 */
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');
const WELCOME_COLOR = 0x57f287;

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function applyVars(str, member, guild) {
  return str
    .replace(/\{user\}/g,                 `${member}`)
    .replace(/\{user\.name\}/g,           member.user.username)
    .replace(/\{user\.tag\}/g,            member.user.tag)
    .replace(/\{user\.id\}/g,             member.user.id)
    .replace(/\{user\.avatar\}/g,         member.user.displayAvatarURL({ dynamic: true }))
    .replace(/\{membercount\}/g,          guild.memberCount)
    .replace(/\{membercount\.ordinal\}/g, ordinal(guild.memberCount))
    .replace(/\{guild\.name\}/g,          guild.name)
    .replace(/\{guild\.id\}/g,            guild.id)
    .replace(/\{guild\.icon\}/g,          guild.iconURL({ dynamic: true }) ?? '');
}
function buildWelcomeEmbed(settings, member, guild) {
  const embed = new EmbedBuilder().setColor(settings.welcome_embed_color ?? Colors.bleed);
  if (settings.welcome_embed_title)     embed.setTitle(applyVars(settings.welcome_embed_title, member, guild));
  if (settings.welcome_embed_desc)      embed.setDescription(applyVars(settings.welcome_embed_desc, member, guild));
  if (settings.welcome_embed_thumbnail === 'user')  embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
  else if (settings.welcome_embed_thumbnail === 'guild') embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
  if (settings.welcome_embed_image && settings.welcome_embed_image !== 'off')
    embed.setImage(applyVars(settings.welcome_embed_image, member, guild));
  return embed.setFooter({ text: `Member #${ordinal(guild.memberCount)}` }).setTimestamp();
}
const VARS_LIST = [
  '`{user}` — mention the member',
  '`{user.name}` — username',
  '`{user.tag}` — full tag',
  '`{user.id}` — user ID',
  '`{user.avatar}` — avatar URL',
  '`{membercount}` — member count',
  '`{membercount.ordinal}` — e.g. 42nd',
  '`{guild.name}` — server name',
  '`{guild.id}` — server ID',
  '`{guild.icon}` — icon URL',
];

module.exports = {
  name: 'welcome', aliases: ['welc', 'wlc'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });
    await db.ensureGuild(message.guild.id, message.guild.name);
    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    if (!sub) return message.channel.send({ embeds: [base(WELCOME_COLOR)
      .setTitle('👋 Welcome System')
      .setDescription('Send custom messages when members join. Supports multiple channels and template variables.')
      .addFields(
        { name: '📋 Subcommands', value: [
          `\`${prefix}welcome add #channel <message>\` — add a welcome channel`,
          `\`${prefix}welcome remove #channel\` — remove a channel`,
          `\`${prefix}welcome view #channel\` — view configured message`,
          `\`${prefix}welcome list\` — list all welcome channels`,
          `\`${prefix}welcome variables\` — available variables`,
          `\`${prefix}welcome test [#channel]\` — preview`,
        ].join('\n') },
        { name: '🎨 Embed Setup', value: [
          `\`${prefix}welcome embed title/description/color/thumbnail/image\``,
          `\`${prefix}welcome enable / disable / status / clear\``,
        ].join('\n') },
      )
    ]});

    if (sub === 'variables' || sub === 'vars')
      return message.channel.send({ embeds: [base(WELCOME_COLOR).setTitle('👋 Welcome Variables').setDescription(VARS_LIST.join('\n'))] });

    if (sub === 'list') {
      const all = await db.getAllWelcomeChannels(guild.id);
      const s   = await db.getSettings(guild.id);
      const lines = all.map((r, i) => {
        const ch = guild.channels.cache.get(r.channel_id);
        const prev = r.message.length > 60 ? r.message.slice(0,57)+'…' : r.message;
        return `\`${i+1}.\` ${ch ?? `<#${r.channel_id}>`} — \`${prev}\``;
      });
      if (s?.welcome_channel && !all.some(r => r.channel_id === s.welcome_channel)) {
        const ch = guild.channels.cache.get(s.welcome_channel);
        lines.push(`\`L.\` ${ch ?? `<#${s.welcome_channel}>`} — *legacy config*`);
      }
      if (!lines.length) return message.channel.send({ embeds: [base(WELCOME_COLOR).setDescription(`📭 No welcome channels configured.\nUse \`${prefix}welcome add #channel <message>\``)] });
      return message.channel.send({ embeds: [base(WELCOME_COLOR).setTitle(`👋 Welcome Channels (${lines.length})`).setDescription(lines.join('\n'))] });
    }

    if (sub === 'view') {
      const channel = message.mentions.channels.first() ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel) return message.channel.send({ embeds: [warn(`${author}: Mention a channel — \`${prefix}welcome view #channel\``)] });
      const record = await db.getWelcomeChannel(guild.id, channel.id);
      if (!record) return message.channel.send({ embeds: [warn(`${author}: No welcome message set for ${channel}`)] });
      return message.channel.send({ embeds: [base(WELCOME_COLOR).setTitle(`👋 Welcome — #${channel.name}`).setDescription(`\`\`\`\n${record.message}\n\`\`\``)] });
    }

    if (sub === 'remove' || sub === 'delete') {
      const channel = message.mentions.channels.first() ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel) return message.channel.send({ embeds: [warn(`${author}: Mention a channel — \`${prefix}welcome remove #channel\``)] });
      const removed = await db.removeWelcomeChannel(guild.id, channel.id);
      if (!removed) return message.channel.send({ embeds: [warn(`${author}: No welcome message configured for ${channel}`)] });
      return message.channel.send({ embeds: [success(`${author}: Welcome message removed for ${channel}`)] });
    }

    if (sub === 'add' || sub === 'set') {
      const channel = message.mentions.channels.first() ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel) return message.channel.send({ embeds: [warn(`${author}: Mention a channel — \`${prefix}welcome add #channel <message>\``)] });
      const msgStart = args.findIndex((a, i) => i > 0 && !a.startsWith('<#') && a !== channel.id);
      const rawMsg = args.slice(msgStart > 0 ? msgStart : 2).join(' ');
      if (!rawMsg) return message.channel.send({ embeds: [warn(`${author}: Provide a message`)] });
      if (rawMsg.length > 2000) return message.channel.send({ embeds: [warn(`${author}: Message too long (max 2000)`)] });
      const all = await db.getAllWelcomeChannels(guild.id);
      if (all.length >= 10 && !all.some(r => r.channel_id === channel.id))
        return message.channel.send({ embeds: [warn(`${author}: Maximum **10 welcome channels** reached`)] });
      await db.addWelcomeChannel(guild.id, channel.id, rawMsg);
      return message.channel.send({ embeds: [base(WELCOME_COLOR)
        .setTitle('✅ Welcome Message Set')
        .addFields({ name: 'Channel', value: `${channel}`, inline: true }, { name: 'Message', value: `\`\`\`${rawMsg.slice(0,300)}\`\`\`` })
        .setFooter({ text: `${prefix}welcome variables — see available variables` })
      ]});
    }

    if (sub === 'test') {
      const ch = message.mentions.channels.first() ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      const record = ch ? await db.getWelcomeChannel(guild.id, ch.id) : null;
      if (record && ch) {
        await ch.send(applyVars(record.message, message.member, guild));
        return message.channel.send({ embeds: [success(`${author}: Test sent to ${ch}`)] });
      }
      const s = await db.getSettings(guild.id);
      const legacyCh = s?.welcome_channel ? guild.channels.cache.get(s.welcome_channel) : null;
      if (!legacyCh) return message.channel.send({ embeds: [warn(`${author}: No welcome configured to test`)] });
      const hasEmbed = s.welcome_embed_title || s.welcome_embed_desc;
      const plain    = s.welcome_message ? applyVars(s.welcome_message, message.member, guild) : null;
      if (hasEmbed)       await legacyCh.send({ content: plain ?? undefined, embeds: [buildWelcomeEmbed(s, message.member, guild)] });
      else if (plain)     await legacyCh.send(plain);
      else return message.channel.send({ embeds: [warn(`${author}: Nothing configured to test`)] });
      return message.channel.send({ embeds: [success(`${author}: Test sent to ${legacyCh}`)] });
    }

    // ── Legacy subcommands ────────────────────────────────────
    if (sub === 'channel') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.channel.send({ embeds: [warn(`${author}: Mention a channel`)] });
      await db.setWelcomeExtra(guild.id, { welcome_channel: channel.id });
      return message.channel.send({ embeds: [success(`${author}: Welcome channel set to ${channel}`)] });
    }
    if (sub === 'enable')  { await db.setWelcomeExtra(guild.id, { welcome_enabled: true });  return message.channel.send({ embeds: [success(`${author}: Welcome messages enabled`)] }); }
    if (sub === 'disable') { await db.setWelcomeExtra(guild.id, { welcome_enabled: false }); return message.channel.send({ embeds: [warn(`${author}: Welcome messages disabled`)] }); }
    if (sub === 'message') {
      const msg = args.slice(1).join(' ');
      if (!msg) return message.channel.send({ embeds: [warn(`${author}: Provide a message`)] });
      await db.setWelcomeExtra(guild.id, { welcome_message: msg });
      return message.channel.send({ embeds: [base(Colors.neutral).setTitle('Welcome message saved').setDescription(`\`\`\`${msg}\`\`\``)] });
    }
    if (sub === 'embed') {
      const eType = args[1]?.toLowerCase();
      if (eType === 'title')                        { await db.setWelcomeExtra(guild.id, { welcome_embed_title: args.slice(2).join(' ') });  return message.channel.send({ embeds: [success(`${author}: Embed title set`)] }); }
      if (eType === 'description' || eType==='desc') { await db.setWelcomeExtra(guild.id, { welcome_embed_desc:  args.slice(2).join(' ') });  return message.channel.send({ embeds: [success(`${author}: Embed description set`)] }); }
      if (eType === 'color' || eType === 'colour')  {
        const hex = parseInt((args[2] ?? '').replace('#',''), 16);
        if (isNaN(hex)) return message.channel.send({ embeds: [warn(`${author}: Invalid hex`)] });
        await db.setWelcomeExtra(guild.id, { welcome_embed_color: hex });
        return message.channel.send({ embeds: [new EmbedBuilder().setColor(hex).setDescription(`✅ ${author}: Color set`)] });
      }
      if (eType === 'thumbnail') {
        const val = args[2]?.toLowerCase();
        if (!['user','guild','off'].includes(val)) return message.channel.send({ embeds: [warn(`${author}: Use user/guild/off`)] });
        await db.setWelcomeExtra(guild.id, { welcome_embed_thumbnail: val === 'off' ? null : val });
        return message.channel.send({ embeds: [success(`${author}: Thumbnail set to \`${val}\``)] });
      }
      if (eType === 'image') {
        const val = args[2];
        if (!val) return message.channel.send({ embeds: [warn(`${author}: Provide a URL or off`)] });
        await db.setWelcomeExtra(guild.id, { welcome_embed_image: val === 'off' ? null : val });
        return message.channel.send({ embeds: [success(`${author}: Image ${val==='off'?'cleared':'set'}`)] });
      }
      return message.channel.send({ embeds: [warn(`${author}: Embed subs: title / description / color / thumbnail / image`)] });
    }
    if (sub === 'status' || sub === 'config') {
      const s = await db.getSettings(guild.id);
      const multi = await db.getAllWelcomeChannels(guild.id);
      return message.channel.send({ embeds: [base(WELCOME_COLOR).setTitle(`${guild.name} — Welcome Config`)
        .addFields(
          { name: 'Legacy Status',  value: s?.welcome_enabled !== false ? '🟢 On' : '🔴 Off', inline: true },
          { name: 'Legacy Channel', value: s?.welcome_channel ? `<#${s.welcome_channel}>` : '`not set`', inline: true },
          { name: 'Multi-Channel',  value: multi.length ? multi.map(r=>`<#${r.channel_id}>`).join(' ') : '`None`' },
        )
      ]});
    }
    if (sub === 'clear') { await db.clearWelcome(guild.id); return message.channel.send({ embeds: [success(`${author}: Welcome config cleared`)] }); }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}welcome\` for help.`)] });
  },
  buildWelcomeEmbed, applyVars,
};
