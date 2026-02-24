const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

function applyVars(str, user, guild) {
  return str
    .replace(/\{user\.mention\}/g, `${user}`)
    .replace(/\{user\}/g,          user.username)
    .replace(/\{user\.tag\}/g,     user.tag)
    .replace(/\{user\.id\}/g,      user.id)
    .replace(/\{guild\.name\}/g,   guild.name)
    .replace(/\{guild\.id\}/g,     guild.id)
    .replace(/\{guild\.icon\}/g,   guild.iconURL({ dynamic: true }) ?? '');
}

function buildJoinDMEmbed(settings, user, guild) {
  const embed = new EmbedBuilder()
    .setColor(settings.joindm_embed_color ?? Colors.bleed)
    .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) ?? undefined });

  if (settings.joindm_embed_title)
    embed.setTitle(applyVars(settings.joindm_embed_title, user, guild));

  if (settings.joindm_embed_desc)
    embed.setDescription(applyVars(settings.joindm_embed_desc, user, guild));

  if (settings.joindm_embed_thumbnail === 'guild')
    embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
  else if (settings.joindm_embed_thumbnail === 'user')
    embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));

  if (settings.joindm_embed_image && settings.joindm_embed_image !== 'off')
    embed.setImage(settings.joindm_embed_image);

  if (settings.joindm_embed_footer)
    embed.setFooter({ text: applyVars(settings.joindm_embed_footer, user, guild) });

  embed.setTimestamp();
  return embed;
}

module.exports = {
  name: 'joindm',
  aliases: ['jdm', 'welcomedm'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has('ManageGuild'))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    if (!args[0]) return message.channel.send({
      embeds: [base(Colors.neutral)
        .setTitle(`**${prefix}joindm**`)
        .setDescription('Send a rich DM to members when they join')
        .addFields({
          name: '**subcommands**',
          value: [
            `\`${prefix}joindm message <text>\` — plain-text DM`,
            `\`${prefix}joindm embed title <text>\` — embed title`,
            `\`${prefix}joindm embed description <text>\` — embed body`,
            `\`${prefix}joindm embed color <hex>\` — embed color`,
            `\`${prefix}joindm embed thumbnail <user|guild|off>\` — thumbnail`,
            `\`${prefix}joindm embed image <url|off>\` — large image`,
            `\`${prefix}joindm embed footer <text>\` — footer text`,
            `\`${prefix}joindm enable / disable\` — toggle joindm`,
            `\`${prefix}joindm test\` — DM yourself a preview`,
            `\`${prefix}joindm status\` — view current config`,
            `\`${prefix}joindm variables\` — list all variables`,
            `\`${prefix}joindm clear\` — reset everything`,
          ].join('\n')
        },
        { name: '**aliases**', value: 'jdm, welcomedm' })]
    });

    await db.ensureGuild(message.guild.id, message.guild.name);
    const sub = args[0].toLowerCase();

    if (sub === 'enable') {
      await db.setJoinDMExtra(message.guild.id, { joindm_enabled: true });
      return message.channel.send({ embeds: [success(`${message.author}: Join DM **enabled**`)] });
    }

    if (sub === 'disable') {
      await db.setJoinDMExtra(message.guild.id, { joindm_enabled: false });
      return message.channel.send({ embeds: [warn(`${message.author}: Join DM **disabled**`)] });
    }

    if (sub === 'message') {
      const msg = args.slice(1).join(' ');
      if (!msg) return message.channel.send({ embeds: [warn(`${message.author}: Provide a message`)] });
      await db.setJoinDM(message.guild.id, msg);
      return message.channel.send({ embeds: [success(`${message.author}: Join DM message set`)] });
    }

    if (sub === 'embed') {
      const eType = args[1]?.toLowerCase();

      if (eType === 'title') {
        const txt = args.slice(2).join(' ');
        if (!txt) return message.channel.send({ embeds: [warn(`${message.author}: Provide a title`)] });
        await db.setJoinDMExtra(message.guild.id, { joindm_embed_title: txt });
        return message.channel.send({ embeds: [success(`${message.author}: Embed title set`)] });
      }

      if (eType === 'description' || eType === 'desc') {
        const txt = args.slice(2).join(' ');
        if (!txt) return message.channel.send({ embeds: [warn(`${message.author}: Provide a description`)] });
        await db.setJoinDMExtra(message.guild.id, { joindm_embed_desc: txt });
        return message.channel.send({ embeds: [success(`${message.author}: Embed description set`)] });
      }

      if (eType === 'color' || eType === 'colour') {
        const raw = args[2];
        if (!raw) return message.channel.send({ embeds: [warn(`${message.author}: Provide a hex e.g. \`#5865f2\``)] });
        const hex = parseInt(raw.replace('#', ''), 16);
        if (isNaN(hex)) return message.channel.send({ embeds: [warn(`${message.author}: Invalid hex color`)] });
        await db.setJoinDMExtra(message.guild.id, { joindm_embed_color: hex });
        return message.channel.send({ embeds: [new EmbedBuilder().setColor(hex).setDescription(`✅ ${message.author}: Color set to \`${raw}\``)] });
      }

      if (eType === 'thumbnail') {
        const val = args[2]?.toLowerCase();
        if (!['user', 'guild', 'off'].includes(val))
          return message.channel.send({ embeds: [warn(`${message.author}: Use \`user\`, \`guild\`, or \`off\``)] });
        await db.setJoinDMExtra(message.guild.id, { joindm_embed_thumbnail: val === 'off' ? null : val });
        return message.channel.send({ embeds: [success(`${message.author}: Thumbnail set to \`${val}\``)] });
      }

      if (eType === 'image') {
        const val = args[2];
        if (!val) return message.channel.send({ embeds: [warn(`${message.author}: Provide a URL or \`off\``)] });
        await db.setJoinDMExtra(message.guild.id, { joindm_embed_image: val === 'off' ? null : val });
        return message.channel.send({ embeds: [success(`${message.author}: Image ${val === 'off' ? 'cleared' : 'set'}`)] });
      }

      if (eType === 'footer') {
        const txt = args.slice(2).join(' ');
        if (!txt) return message.channel.send({ embeds: [warn(`${message.author}: Provide footer text`)] });
        await db.setJoinDMExtra(message.guild.id, { joindm_embed_footer: txt });
        return message.channel.send({ embeds: [success(`${message.author}: Footer set`)] });
      }

      return message.channel.send({ embeds: [warn(`${message.author}: Embed subs: \`title\` \`description\` \`color\` \`thumbnail\` \`image\` \`footer\``)] });
    }

    if (sub === 'test') {
      const s = await db.getSettings(message.guild.id);
      const hasEmbed = s?.joindm_embed_title || s?.joindm_embed_desc;

      if (!s?.joindm_message && !hasEmbed)
        return message.channel.send({ embeds: [warn(`${message.author}: Nothing configured to test`)] });

      try {
        const plain = s.joindm_message ? applyVars(s.joindm_message, message.author, message.guild) : null;
        if (hasEmbed) {
          await message.author.send({ content: plain ?? undefined, embeds: [buildJoinDMEmbed(s, message.author, message.guild)] });
        } else {
          await message.author.send(plain);
        }
        return message.channel.send({ embeds: [success(`${message.author}: Check your DMs — test sent!`)] });
      } catch {
        return message.channel.send({ embeds: [warn(`${message.author}: Couldn't DM you — please enable DMs from server members`)] });
      }
    }

    if (sub === 'variables' || sub === 'vars') {
      return message.channel.send({
        embeds: [base(Colors.neutral).setTitle('joindm variables').setDescription([
          `\`{user.mention}\` — ${message.author}`,
          `\`{user}\` — ${message.author.username}`,
          `\`{user.tag}\` — ${message.author.tag}`,
          `\`{user.id}\` — ${message.author.id}`,
          `\`{guild.name}\` — ${message.guild.name}`,
          `\`{guild.id}\` — ${message.guild.id}`,
          `\`{guild.icon}\` — server icon URL`,
        ].join('\n'))]
      });
    }

    if (sub === 'status' || sub === 'config') {
      const s = await db.getSettings(message.guild.id);
      return message.channel.send({
        embeds: [base(Colors.neutral)
          .setTitle(`${message.guild.name} — joindm config`)
          .addFields(
            { name: 'Status',      value: s?.joindm_enabled !== false ? '🟢 Enabled' : '🔴 Disabled', inline: true },
            { name: 'Message',     value: s?.joindm_message     ? '`set`' : '`none`', inline: true },
            { name: 'Embed Title', value: s?.joindm_embed_title ? `\`${s.joindm_embed_title.slice(0,30)}\`` : '`none`', inline: true },
            { name: 'Thumbnail',   value: `\`${s?.joindm_embed_thumbnail ?? 'off'}\``, inline: true },
            { name: 'Image',       value: s?.joindm_embed_image ? '`set`' : '`none`',  inline: true },
            { name: 'Footer',      value: s?.joindm_embed_footer ? '`set`' : '`none`', inline: true },
          )]
      });
    }

    if (sub === 'clear') {
      await db.clearJoinDM(message.guild.id);
      return message.channel.send({ embeds: [success(`${message.author}: Join DM config cleared`)] });
    }
  },

  buildJoinDMEmbed,
  applyVars,
};
