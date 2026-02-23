/**
 * Welcome & JoinDM event handler
 * Fires on guildMemberAdd — sends welcome message/embed and join DM
 */

const db = require('../database/db');
const { EmbedBuilder } = require('discord.js');
const { Colors } = require('../utils/embeds');

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function applyVars(str, member, guild) {
  const count = guild.memberCount;
  return str
    .replace(/\{user\}/g,                 `${member}`)
    .replace(/\{user\.name\}/g,           member.user.username)
    .replace(/\{user\.tag\}/g,            member.user.tag)
    .replace(/\{user\.id\}/g,             member.user.id)
    .replace(/\{user\.avatar\}/g,         member.user.displayAvatarURL({ dynamic: true }))
    .replace(/\{membercount\}/g,          count)
    .replace(/\{membercount\.ordinal\}/g, ordinal(count))
    .replace(/\{guild\.name\}/g,          guild.name)
    .replace(/\{guild\.id\}/g,            guild.id)
    .replace(/\{guild\.icon\}/g,          guild.iconURL({ dynamic: true }) ?? '');
}

function buildWelcomeEmbed(settings, member, guild) {
  const embed = new EmbedBuilder().setColor(settings.welcome_embed_color ?? Colors.bleed);
  if (settings.welcome_embed_title)
    embed.setTitle(applyVars(settings.welcome_embed_title, member, guild));
  if (settings.welcome_embed_desc)
    embed.setDescription(applyVars(settings.welcome_embed_desc, member, guild));
  if (settings.welcome_embed_thumbnail === 'user')
    embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
  else if (settings.welcome_embed_thumbnail === 'guild')
    embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
  if (settings.welcome_embed_image && settings.welcome_embed_image !== 'off')
    embed.setImage(applyVars(settings.welcome_embed_image, member, guild));
  embed.setFooter({ text: `Member #${ordinal(guild.memberCount)}` }).setTimestamp();
  return embed;
}

function buildJoinDMEmbed(settings, user, guild) {
  const embed = new EmbedBuilder()
    .setColor(settings.joindm_embed_color ?? Colors.bleed)
    .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) ?? undefined });
  if (settings.joindm_embed_title)
    embed.setTitle(applyVars(settings.joindm_embed_title, { user, toString: () => `<@${user.id}>` }, guild));
  if (settings.joindm_embed_desc)
    embed.setDescription(applyVars(settings.joindm_embed_desc, { user, toString: () => `<@${user.id}>` }, guild));
  if (settings.joindm_embed_thumbnail === 'guild')
    embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
  else if (settings.joindm_embed_thumbnail === 'user')
    embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
  if (settings.joindm_embed_image && settings.joindm_embed_image !== 'off')
    embed.setImage(settings.joindm_embed_image);
  if (settings.joindm_embed_footer)
    embed.setFooter({ text: applyVars(settings.joindm_embed_footer, { user, toString: () => `<@${user.id}>` }, guild) });
  embed.setTimestamp();
  return embed;
}

module.exports = (client) => {
  client.on('guildMemberAdd', async (member) => {
    // ── Hardban auto-rebanning ─────────────────────────────────
    const { isHardbanned } = require('../database/db');
    try {
      if (await isHardbanned(member.guild.id, member.id)) {
        await member.guild.bans.create(member.id, { reason: '[Hardban] Auto-rebanned on rejoin' });
        return; // Stop all further processing for this member
      }
    } catch (_) {}
    // ── End hardban check ──────────────────────────────────────

    const { guild } = member;
    await db.ensureGuild(guild.id, guild.name).catch(() => {});
    const settings = await db.getSettings(guild.id).catch(() => null);
    if (!settings) return;

    // ── Welcome message ──────────────────────────────────────
    if (settings.welcome_enabled !== false && settings.welcome_channel) {
      const ch = guild.channels.cache.get(settings.welcome_channel);
      if (ch) {
        const hasEmbed = settings.welcome_embed_title || settings.welcome_embed_desc;
        const plain = settings.welcome_message ? applyVars(settings.welcome_message, member, guild) : null;

        if (hasEmbed) {
          await ch.send({ content: plain ?? undefined, embeds: [buildWelcomeEmbed(settings, member, guild)] }).catch(() => {});
        } else if (plain) {
          await ch.send(plain).catch(() => {});
        }
      }
    }

    // ── Join DM ──────────────────────────────────────────────
    if (settings.joindm_enabled !== false) {
      const hasEmbed = settings.joindm_embed_title || settings.joindm_embed_desc;
      const plain = settings.joindm_message
        ? settings.joindm_message
            .replace(/\{user\.mention\}/g, `${member}`)
            .replace(/\{user\}/g,          member.user.username)
            .replace(/\{user\.tag\}/g,     member.user.tag)
            .replace(/\{user\.id\}/g,      member.user.id)
            .replace(/\{guild\.name\}/g,   guild.name)
            .replace(/\{guild\.id\}/g,     guild.id)
            .replace(/\{guild\.icon\}/g,   guild.iconURL({ dynamic: true }) ?? '')
        : null;

      if (hasEmbed || plain) {
        if (hasEmbed) {
          await member.user.send({ content: plain ?? undefined, embeds: [buildJoinDMEmbed(settings, member.user, guild)] }).catch(() => {});
        } else if (plain) {
          await member.user.send(plain).catch(() => {});
        }
      }
    }
  });

  console.log('👋 Welcome & JoinDM event loaded');
};

// ── Boost message event ───────────────────────────────────────────────────
// This function is appended to the existing welcome.js to handle boosts
// It hooks into guildMemberUpdate to detect new boosters

const _originalWelcomeExport = module.exports;
module.exports = (client) => {
  // Run original welcome/joindm logic
  _originalWelcomeExport(client);

  // ── Multi-channel welcome system ──────────────────────────────
  client.on('guildMemberAdd', async (member) => {
    const { guild } = member;
    const all = await db.getAllWelcomeChannels(guild.id).catch(() => []);
    const { applyVars: applyVarsMulti } = require('../commands/configuration/welcome');
    for (const record of all) {
      const ch = guild.channels.cache.get(record.channel_id);
      if (!ch) continue;
      const text = applyVarsMulti(record.message, member, guild);
      await ch.send(text).catch(() => {});
    }
  });

  // ── Boost message ─────────────────────────────────────────────
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Detect new boost: old had no premiumSince, new does
    if (oldMember.premiumSince || !newMember.premiumSince) return;
    const { guild } = newMember;

    const all = await db.getAllBoostMessages(guild.id).catch(() => []);
    if (!all.length) return;

    const { applyVars: applyVarsBoost } = require('../commands/configuration/boosts');
    for (const record of all) {
      const ch = guild.channels.cache.get(record.channel_id);
      if (!ch) continue;
      const text = applyVarsBoost(record.message, newMember, guild);
      await ch.send(text).catch(() => {});
    }
  });
};
