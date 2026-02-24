/**
 * noprefix — Grant or revoke no-prefix mode for specific users by ID
 * Owner-only command
 *
 * Usage:
 *   ,noprefix add <userId/mention>    — grant noprefix to a user
 *   ,noprefix remove <userId/mention> — revoke noprefix from a user
 *   ,noprefix list                    — list all users with noprefix
 *   ,noprefix check <userId/mention>  — check if a user has noprefix
 *
 * Also: ,owner noprefix still toggles the owner's own global noprefix.
 * This is a separate elevated grant for other users.
 */

const { EmbedBuilder } = require('discord.js');
const { isOwner } = require('../../utils/owner');
const { resolveUser } = require('../../utils/resolve');
const db = require('../../database/db');

const GOLD   = 0xf5c518;
const GREEN  = 0x57f287;
const RED    = 0xed4245;
const BLUE   = 0x5865f2;

module.exports = {
  name: 'noprefix',
  aliases: ['np', 'nopfx'],
  category: 'owner',

  run: async (client, message, args) => {
    // Owner-only command
    if (!isOwner(message.author.id)) {
      return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(RED)
        .setDescription('❌ Only the **bot owner** can manage no-prefix grants.')] });
    }

    const sub = args[0]?.toLowerCase();
    const { channel, author } = message;

    // ── LIST ──────────────────────────────────────────────────
    if (!sub || sub === 'list') {
      const users = await db.getNoprefixUsers().catch(() => []);

      if (!users.length) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(BLUE)
          .setTitle('⚡ No-Prefix Grant List')
          .setDescription('`No users have been granted no-prefix access.`')
          .setFooter({ text: `Owner's own noprefix is a separate toggle (,owner noprefix)` })] });
      }

      const lines = users.map((u, i) => {
        const when = Math.floor(new Date(u.granted_at).getTime() / 1000);
        return `\`${i + 1}.\` <@${u.user_id}> \`(${u.user_id})\`\n> Granted by <@${u.granted_by}> — <t:${when}:R>`;
      });

      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(`⚡ No-Prefix Users (${users.length})`)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: 'These users can run commands without a prefix globally' })] });
    }

    // ── ADD ───────────────────────────────────────────────────
    if (sub === 'add' || sub === 'grant') {
      const rawArg = args[1];
      if (!rawArg) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(GOLD)
          .setDescription('Usage: `,noprefix add <userId/mention>`')] });
      }

      const cleanId = rawArg.replace(/^<@!?(\d{17,20})>$/, '$1');
      let targetId  = cleanId;
      let targetTag = null;

      // Resolve to actual user
      const user = await (
        /^\d{17,20}$/.test(cleanId)
          ? client.users.fetch(cleanId).catch(() => null)
          : resolveUser(client, rawArg)
      );

      if (user) {
        targetId  = user.id;
        targetTag = user.tag ?? user.username;
      } else if (!/^\d{17,20}$/.test(cleanId)) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(RED)
          .setDescription(`❌ Could not find user \`${rawArg}\`. Try using a user ID.`)] });
      }

      if (isOwner(targetId)) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(GOLD)
          .setDescription('⚡ You already have permanent no-prefix access as the bot owner.')] });
      }

      await db.addNoprefixUser(targetId, author.id);

      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(GREEN)
        .setTitle('⚡ No-Prefix Granted')
        .setDescription(`**${targetTag ?? targetId}** \`(${targetId})\` can now run commands without a prefix in any server.`)
        .setThumbnail(user?.displayAvatarURL({ dynamic: true }) ?? null)
        .setFooter({ text: `Granted by ${author.username}` })
        .setTimestamp()] });
    }

    // ── REMOVE ────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'revoke') {
      const rawArg = args[1];
      if (!rawArg) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(GOLD)
          .setDescription('Usage: `,noprefix remove <userId/mention>`')] });
      }

      const cleanId = rawArg.replace(/^<@!?(\d{17,20})>$/, '$1');
      let targetId  = /^\d{17,20}$/.test(cleanId) ? cleanId : null;

      if (!targetId) {
        const user = await resolveUser(client, rawArg);
        if (!user) {
          return channel.send({ embeds: [new EmbedBuilder()
            .setColor(RED)
            .setDescription(`❌ Could not resolve \`${rawArg}\`. Use a user ID.`)] });
        }
        targetId = user.id;
      }

      if (isOwner(targetId)) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(GOLD)
          .setDescription(`❌ The bot owner's no-prefix is permanent — toggle it with \`,owner noprefix\``)] });
      }

      const removed = await db.removeNoprefixUser(targetId);
      const user    = await client.users.fetch(targetId).catch(() => null);

      if (!removed) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(RED)
          .setDescription(`❌ **${user?.tag ?? targetId}** \`(${targetId})\` does not have a no-prefix grant.`)] });
      }

      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(RED)
        .setTitle('⚡ No-Prefix Revoked')
        .setDescription(`**${user?.tag ?? targetId}** \`(${targetId})\` can no longer run commands without a prefix.`)
        .setFooter({ text: `Revoked by ${author.username}` })
        .setTimestamp()] });
    }

    // ── CHECK ─────────────────────────────────────────────────
    if (sub === 'check') {
      const rawArg = args[1];
      if (!rawArg) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(GOLD)
          .setDescription('Usage: `,noprefix check <userId/mention>`')] });
      }

      const cleanId = rawArg.replace(/^<@!?(\d{17,20})>$/, '$1');
      let targetId  = /^\d{17,20}$/.test(cleanId) ? cleanId : null;

      if (!targetId) {
        const user = await resolveUser(client, rawArg);
        if (!user) return channel.send({ embeds: [new EmbedBuilder().setColor(RED).setDescription(`❌ Could not resolve \`${rawArg}\``)] });
        targetId = user.id;
      }

      const user = await client.users.fetch(targetId).catch(() => null);

      if (isOwner(targetId)) {
        return channel.send({ embeds: [new EmbedBuilder()
          .setColor(GOLD)
          .setDescription(`👑 **${user?.tag ?? targetId}** is the bot owner — permanent no-prefix access.`)] });
      }

      const has = await db.isNoprefixUser(targetId);
      return channel.send({ embeds: [new EmbedBuilder()
        .setColor(has ? GREEN : RED)
        .setDescription(`${has ? '⚡' : '❌'} **${user?.tag ?? targetId}** \`(${targetId})\` ${has ? '**has** no-prefix access.' : 'does **not** have no-prefix access.'}`)] });
    }

    // ── Unknown ───────────────────────────────────────────────
    return channel.send({ embeds: [new EmbedBuilder()
      .setColor(GOLD)
      .setTitle('⚡ No-Prefix Management')
      .setDescription([
        '`,noprefix add <id>`      — grant no-prefix to a user',
        '`,noprefix remove <id>`   — revoke no-prefix from a user',
        '`,noprefix list`          — list all users with no-prefix',
        '`,noprefix check <id>`    — check if a user has no-prefix',
      ].join('\n'))
      .setFooter({ text: 'These grants persist across restarts (stored in DB)' })] });
  }
};
