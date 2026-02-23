/**
 * boosts — Configure per-channel Nitro boost announcement messages
 *
 * boosts add <#channel> <message>   — set a boost message for a channel
 * boosts view <#channel>            — view boost message for a channel
 * boosts list                       — list all boost message channels
 * boosts remove <#channel>          — remove boost message from channel
 * boosts variables                  — show available variables
 */

const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

const BOOST_COLOR  = 0xf47fff;
const BOOST_VARS   = [
  '`{user}`         — mention the booster',
  '`{user.name}`    — booster username',
  '`{user.tag}`     — booster tag',
  '`{user.id}`      — booster ID',
  '`{user.avatar}`  — booster avatar URL',
  '`{guild.name}`   — server name',
  '`{guild.id}`     — server ID',
  '`{boost.count}`  — total boost count',
  '`{boost.tier}`   — boost tier (0–3)',
  '`{boost.total}`  — total boosters',
];

function applyVars(str, member, guild) {
  return str
    .replace(/\{user\}/g,          `${member}`)
    .replace(/\{user\.name\}/g,    member.user.username)
    .replace(/\{user\.tag\}/g,     member.user.tag)
    .replace(/\{user\.id\}/g,      member.user.id)
    .replace(/\{user\.avatar\}/g,  member.user.displayAvatarURL({ dynamic: true }))
    .replace(/\{guild\.name\}/g,   guild.name)
    .replace(/\{guild\.id\}/g,     guild.id)
    .replace(/\{boost\.count\}/g,  guild.premiumSubscriptionCount ?? '?')
    .replace(/\{boost\.tier\}/g,   guild.premiumTier ?? 0)
    .replace(/\{boost\.total\}/g,  guild.premiumSubscriptionCount ?? '?');
}

module.exports = {
  name: 'boosts',
  aliases: ['boostmsg', 'boostmessage'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(BOOST_COLOR)
        .setTitle('🚀 Boost Messages')
        .setDescription('Send a custom message when someone boosts your server. Supports one message per channel.')
        .addFields(
          { name: '📋 Subcommands', value: [
            `\`${prefix}boosts add <#channel> <message>\` — add/update boost message`,
            `\`${prefix}boosts view <#channel>\` — view configured message`,
            `\`${prefix}boosts list\` — list all boost channels`,
            `\`${prefix}boosts remove <#channel>\` — remove boost message`,
            `\`${prefix}boosts variables\` — available variables`,
          ].join('\n') },
          { name: '💡 Example', value: `\`${prefix}boosts add #boosts Thanks {user} for boosting! 🎉 We're now at {boost.count} boosts!\`` },
        )
      ]});
    }

    // ── VARIABLES ─────────────────────────────────────────────
    if (sub === 'variables' || sub === 'vars') {
      return message.channel.send({ embeds: [base(BOOST_COLOR)
        .setTitle('🚀 Boost Message Variables')
        .setDescription(BOOST_VARS.join('\n'))
        .setFooter({ text: 'Use these inside your boost message' })
      ]});
    }

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const all = await db.getAllBoostMessages(guild.id);
      if (!all.length)
        return message.channel.send({ embeds: [base(BOOST_COLOR).setDescription(`📭 No boost messages configured.\nUse \`${prefix}boosts add #channel <message>\` to add one.`)] });

      const lines = all.map((r, i) => {
        const ch = guild.channels.cache.get(r.channel_id);
        const preview = r.message.length > 60 ? r.message.slice(0, 57) + '…' : r.message;
        return `\`${i + 1}.\` ${ch ? ch : `<#${r.channel_id}>`} — \`${preview}\``;
      });
      return message.channel.send({ embeds: [base(BOOST_COLOR)
        .setTitle(`🚀 Boost Messages (${all.length})`)
        .setDescription(lines.join('\n'))
      ]});
    }

    // ── VIEW ──────────────────────────────────────────────────
    if (sub === 'view') {
      const channel = message.mentions.channels.first()
        ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel)
        return message.channel.send({ embeds: [warn(`${author}: Mention a channel — \`${prefix}boosts view #channel\``)] });

      const record = await db.getBoostMessage(guild.id, channel.id);
      if (!record)
        return message.channel.send({ embeds: [warn(`${author}: No boost message set for ${channel}`)] });

      return message.channel.send({ embeds: [base(BOOST_COLOR)
        .setTitle(`🚀 Boost Message — ${channel.name}`)
        .setDescription(`\`\`\`\n${record.message}\n\`\`\``)
        .setFooter({ text: `Channel: ${channel.name}` })
      ]});
    }

    // ── REMOVE ────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const channel = message.mentions.channels.first()
        ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel)
        return message.channel.send({ embeds: [warn(`${author}: Mention a channel — \`${prefix}boosts remove #channel\``)] });

      const removed = await db.removeBoostMessage(guild.id, channel.id);
      if (!removed)
        return message.channel.send({ embeds: [warn(`${author}: No boost message was set for ${channel}`)] });
      return message.channel.send({ embeds: [success(`${author}: Boost message removed for ${channel}`)] });
    }

    // ── ADD ───────────────────────────────────────────────────
    if (sub === 'add' || sub === 'set') {
      const channel = message.mentions.channels.first()
        ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel)
        return message.channel.send({ embeds: [warn(`${author}: Mention a channel — \`${prefix}boosts add #channel <message>\``)] });

      // Message starts after the channel arg
      const msgStart = args.findIndex((a, i) => i > 0 && !a.startsWith('<#') && a !== channel.id);
      const rawMsg = args.slice(msgStart > 0 ? msgStart : 2).join(' ');
      if (!rawMsg)
        return message.channel.send({ embeds: [warn(`${author}: Provide a message — \`${prefix}boosts add #channel <message>\``)] });
      if (rawMsg.length > 2000)
        return message.channel.send({ embeds: [warn(`${author}: Message is too long (max 2000 chars)`)] });

      await db.setBoostMessage(guild.id, channel.id, rawMsg);
      return message.channel.send({ embeds: [base(BOOST_COLOR)
        .setTitle('🚀 Boost Message Set')
        .addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Preview', value: `\`\`\`${rawMsg.slice(0, 200)}\`\`\`` },
        )
        .setFooter({ text: `Use ${prefix}boosts variables to see available variables` })
      ]});
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}boosts\` for help.`)] });
  },

  // Exported for use in events
  applyVars,
};
