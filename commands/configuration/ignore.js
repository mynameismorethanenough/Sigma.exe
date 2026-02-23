/**
 * ignore — Prevent the bot from responding to specific users or channels
 *
 * ignore list                      — list all ignored users/channels
 * ignore add <@user|#channel>      — add to ignore list
 * ignore remove <@user|#channel>   — remove from ignore list
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'ignore',
  aliases: ['ignorelist', 'botignore'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🚫 Ignore List')
        .setDescription('Ignored users and channels are completely skipped by the bot — no commands, no autoresponders, no sticky messages.')
        .addFields({ name: '📋 Subcommands', value: [
          `\`${prefix}ignore list\` — view all ignored users and channels`,
          `\`${prefix}ignore add @user\` — ignore a user`,
          `\`${prefix}ignore add #channel\` — ignore a channel`,
          `\`${prefix}ignore remove @user\` — un-ignore a user`,
          `\`${prefix}ignore remove #channel\` — un-ignore a channel`,
        ].join('\n') })
        .addFields({ name: '⚠️ Note', value: 'Admins with **Manage Guild** always bypass the ignore list.' })
      ]});
    }

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const all = await db.getIgnoredList(guild.id);
      if (!all.length)
        return message.channel.send({ embeds: [base(Colors.neutral).setDescription(`📭 No ignored users or channels.\nUse \`${prefix}ignore add @user/#channel\` to add one.`)] });

      const users    = all.filter(e => e.entity_type === 'user')   .map(e => `<@${e.entity_id}>`);
      const channels = all.filter(e => e.entity_type === 'channel').map(e => `<#${e.entity_id}>`);

      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle(`🚫 Ignore List (${all.length})`)
        .addFields(
          { name: `👤 Users (${users.length})`,       value: users.length    ? users.join(' ')    : '`None`', inline: true },
          { name: `💬 Channels (${channels.length})`, value: channels.length ? channels.join(' ') : '`None`', inline: true },
        )
      ]});
    }

    // ── ADD ───────────────────────────────────────────────────
    if (sub === 'add') {
      const user    = message.mentions.members.first()?.user;
      const channel = message.mentions.channels.first();

      if (!user && !channel)
        return message.channel.send({ embeds: [warn(`${author}: Mention a user or channel — \`${prefix}ignore add @user\` or \`${prefix}ignore add #channel\``)] });

      if (user) {
        if (user.id === author.id)
          return message.channel.send({ embeds: [warn(`${author}: You can't ignore yourself`)] });
        if (user.id === client.user.id)
          return message.channel.send({ embeds: [warn(`${author}: You can't ignore the bot`)] });
        const member = guild.members.cache.get(user.id);
        if (member?.permissions.has(PermissionFlagsBits.ManageGuild))
          return message.channel.send({ embeds: [warn(`${author}: Can't ignore a member with **Manage Guild**`)] });

        await db.addIgnored(guild.id, user.id, 'user', author.id);
        return message.channel.send({ embeds: [success(`${author}: **${user.tag}** added to ignore list`)] });
      }

      await db.addIgnored(guild.id, channel.id, 'channel', author.id);
      return message.channel.send({ embeds: [success(`${author}: ${channel} added to ignore list`)] });
    }

    // ── REMOVE ────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const user    = message.mentions.users.first();
      const channel = message.mentions.channels.first();

      if (!user && !channel)
        return message.channel.send({ embeds: [warn(`${author}: Mention a user or channel to un-ignore`)] });

      if (user) {
        const removed = await db.removeIgnored(guild.id, user.id, 'user');
        if (!removed)
          return message.channel.send({ embeds: [warn(`${author}: **${user.tag}** is not in the ignore list`)] });
        return message.channel.send({ embeds: [success(`${author}: **${user.tag}** removed from ignore list`)] });
      }

      const removed = await db.removeIgnored(guild.id, channel.id, 'channel');
      if (!removed)
        return message.channel.send({ embeds: [warn(`${author}: ${channel} is not in the ignore list`)] });
      return message.channel.send({ embeds: [success(`${author}: ${channel} removed from ignore list`)] });
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}ignore\` for help.`)] });
  }
};
