/**
 * stickymessage — Pin a message that re-posts to the bottom after any message is sent
 *
 * stickymessage add <#channel> <message>  — add a sticky message
 * stickymessage remove <#channel>         — remove a sticky message
 * stickymessage list                      — list all sticky messages
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'stickymessage',
  aliases: ['sticky', 'stickymsg'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('📌 Sticky Messages')
        .setDescription('Sticky messages re-post to the bottom of a channel every time a new message is sent, keeping important content always visible.')
        .addFields({ name: '📋 Subcommands', value: [
          `\`${prefix}stickymessage add <#channel> <message>\` — add/update sticky`,
          `\`${prefix}stickymessage remove <#channel>\` — remove sticky`,
          `\`${prefix}stickymessage list\` — list all sticky messages`,
        ].join('\n') })
        .addFields({ name: '💡 Example', value: `\`${prefix}stickymessage add #rules Please read the rules before chatting!\`` })
      ]});
    }

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const all = await db.getAllStickyMessages(guild.id);
      if (!all.length)
        return message.channel.send({ embeds: [base(Colors.neutral).setDescription(`📭 No sticky messages configured.\nUse \`${prefix}stickymessage add #channel <message>\` to create one.`)] });

      const lines = all.map((r, i) => {
        const ch = guild.channels.cache.get(r.channel_id);
        const preview = r.message.length > 60 ? r.message.slice(0, 57) + '…' : r.message;
        return `\`${i + 1}.\` ${ch ?? `<#${r.channel_id}>`} — \`${preview}\``;
      });
      return message.channel.send({ embeds: [base(Colors.info)
        .setTitle(`📌 Sticky Messages (${all.length})`)
        .setDescription(lines.join('\n'))
      ]});
    }

    // ── REMOVE ────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const channel = message.mentions.channels.first()
        ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel)
        return message.channel.send({ embeds: [warn(`${author}: Mention a channel — \`${prefix}stickymessage remove #channel\``)] });

      const removed = await db.removeStickyMessage(guild.id, channel.id);
      if (!removed)
        return message.channel.send({ embeds: [warn(`${author}: No sticky message set for ${channel}`)] });
      return message.channel.send({ embeds: [success(`${author}: Sticky message removed from ${channel}`)] });
    }

    // ── ADD ───────────────────────────────────────────────────
    if (sub === 'add' || sub === 'set') {
      const channel = message.mentions.channels.first()
        ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel)
        return message.channel.send({ embeds: [warn(`${author}: Mention a channel — \`${prefix}stickymessage add #channel <message>\``)] });

      const msgStart = args.findIndex((a, i) => i > 0 && !a.startsWith('<#') && a !== channel.id);
      const rawMsg = args.slice(msgStart > 0 ? msgStart : 2).join(' ');
      if (!rawMsg)
        return message.channel.send({ embeds: [warn(`${author}: Provide a message — \`${prefix}stickymessage add #channel <message>\``)] });
      if (rawMsg.length > 2000)
        return message.channel.send({ embeds: [warn(`${author}: Message too long (max 2000 chars)`)] });

      await db.setStickyMessage(guild.id, channel.id, rawMsg);
      return message.channel.send({ embeds: [base(Colors.success ?? 0x57f287)
        .setTitle('📌 Sticky Message Set')
        .addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Message', value: `\`\`\`${rawMsg.slice(0, 200)}\`\`\`` },
        )
        .setFooter({ text: 'This message will re-post to the bottom of the channel after every new message' })
      ]});
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}stickymessage\` for help.`)] });
  }
};
