/**
 * autoresponder — Automatically reply to messages matching a trigger
 *
 * autoresponder add <trigger>, <message> [flags]
 *   Flags: --not_strict  --self_destruct <secs>  --ignore_command_check  --delete  --exclusive
 * autoresponder remove <trigger>
 * autoresponder list
 * autoresponder variables
 * autoresponder exclusive — toggle exclusive mode globally
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

const AR_COLOR = 0x9b59b6;
const AR_VARS  = [
  '`{user}`         — mention the user who triggered',
  '`{user.name}`    — their username',
  '`{user.tag}`     — their full tag',
  '`{user.id}`      — their ID',
  '`{channel}`      — channel name',
  '`{channel.id}`   — channel ID',
  '`{guild.name}`   — server name',
  '`{guild.id}`     — server ID',
  '`{trigger}`      — the matched trigger word',
];

function applyVars(str, message, trigger) {
  return str
    .replace(/\{user\}/g,        `${message.author}`)
    .replace(/\{user\.name\}/g,  message.author.username)
    .replace(/\{user\.tag\}/g,   message.author.tag)
    .replace(/\{user\.id\}/g,    message.author.id)
    .replace(/\{channel\}/g,     message.channel.name)
    .replace(/\{channel\.id\}/g, message.channel.id)
    .replace(/\{guild\.name\}/g, message.guild.name)
    .replace(/\{guild\.id\}/g,   message.guild.id)
    .replace(/\{trigger\}/g,     trigger ?? '');
}

module.exports = {
  name: 'autoresponder',
  aliases: ['ar', 'autoresponse', 'autorespond'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(AR_COLOR)
        .setTitle('💬 Autoresponder')
        .setDescription('Automatically reply to messages that match a trigger. Triggers can be exact matches or partial (contains).')
        .addFields(
          { name: '📋 Subcommands', value: [
            `\`${prefix}autoresponder add <trigger>, <response>\` — create a responder`,
            `\`${prefix}autoresponder remove <trigger>\` — remove a responder`,
            `\`${prefix}autoresponder list\` — view all responders`,
            `\`${prefix}autoresponder variables\` — available response variables`,
          ].join('\n') },
          { name: '🏳️ Flags (append to add)', value: [
            '`--not_strict` — match if trigger appears *anywhere* in the message (default is exact)',
            '`--self_destruct <secs>` — auto-delete the response after N seconds',
            '`--ignore_command_check` — respond even if message starts with the prefix',
            '`--delete` — delete the triggering message before responding',
            '`--exclusive` — only one autoresponder fires per message',
          ].join('\n') },
          { name: '💡 Example', value: [
            `\`${prefix}autoresponder add hello, Hi {user}!\``,
            `\`${prefix}autoresponder add bad word, Watch your language! --not_strict --delete\``,
            `\`${prefix}autoresponder add giveaway info, 🎉 Check #giveaways! --self_destruct 10\``,
          ].join('\n') },
        )
      ]});
    }

    // ── VARIABLES ─────────────────────────────────────────────
    if (sub === 'variables' || sub === 'vars') {
      return message.channel.send({ embeds: [base(AR_COLOR)
        .setTitle('💬 Autoresponder Variables')
        .setDescription(AR_VARS.join('\n'))
      ]});
    }

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const all = await db.getAutoresponders(guild.id);
      if (!all.length)
        return message.channel.send({ embeds: [base(AR_COLOR).setDescription(`📭 No autoresponders configured.\nUse \`${prefix}autoresponder add <trigger>, <response>\` to create one.`)] });

      // Paginate 10 per embed
      const lines = all.map((a, i) => {
        const flags = [];
        if (!a.strict)               flags.push('loose');
        if (a.exclusive)             flags.push('exclusive');
        if (a.self_destruct)         flags.push(`self-destruct ${a.self_destruct}s`);
        if (a.ignore_command_check)  flags.push('ignore-cmd');
        if (a.delete_trigger)        flags.push('delete');
        const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
        const preview = a.response.length > 40 ? a.response.slice(0, 37) + '…' : a.response;
        return `\`${i + 1}.\` **${a.trigger}**${flagStr} → \`${preview}\``;
      });

      return message.channel.send({ embeds: [base(AR_COLOR)
        .setTitle(`💬 Autoresponders (${all.length})`)
        .setDescription(lines.join('\n'))
      ]});
    }

    // ── REMOVE ────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const trigger = args.slice(1).join(' ');
      if (!trigger)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}autoresponder remove <trigger>\``)] });

      const removed = await db.removeAutoresponder(guild.id, trigger);
      if (!removed)
        return message.channel.send({ embeds: [warn(`${author}: No autoresponder found for trigger \`${trigger}\``)] });
      return message.channel.send({ embeds: [success(`${author}: Autoresponder for \`${trigger}\` removed`)] });
    }

    // ── ADD ───────────────────────────────────────────────────
    if (sub === 'add' || sub === 'create') {
      // Syntax: ,ar add <trigger>, <response> [flags]
      const rawContent = args.slice(1).join(' ');

      // Split on first comma
      const commaIdx = rawContent.indexOf(',');
      if (commaIdx === -1)
        return message.channel.send({ embeds: [warn(`${author}: Separate trigger and response with a comma.\nUsage: \`${prefix}autoresponder add <trigger>, <response>\``)] });

      const trigger  = rawContent.slice(0, commaIdx).trim();
      const afterComma = rawContent.slice(commaIdx + 1).trim();

      // Parse flags from afterComma
      const opts = {
        strict:             true,
        exclusive:          false,
        selfDestruct:       null,
        ignoreCommandCheck: false,
        delete:             false,
        createdBy:          author.id,
      };

      // Extract flags before splitting off response
      let responseText = afterComma;
      const flagRegex = /--self_destruct\s+(\d+)|--not_strict|--exclusive|--ignore_command_check|--delete/g;
      const flagMatches = [...afterComma.matchAll(flagRegex)];

      for (const m of flagMatches) {
        if (m[0].startsWith('--self_destruct')) opts.selfDestruct = parseInt(m[1]);
        if (m[0] === '--not_strict')            opts.strict = false;
        if (m[0] === '--exclusive')             opts.exclusive = true;
        if (m[0] === '--ignore_command_check')  opts.ignoreCommandCheck = true;
        if (m[0] === '--delete')                opts.delete = true;
      }

      // Strip flags from response text
      responseText = responseText.replace(flagRegex, '').trim();

      if (!trigger)
        return message.channel.send({ embeds: [warn(`${author}: Trigger cannot be empty`)] });
      if (!responseText)
        return message.channel.send({ embeds: [warn(`${author}: Response cannot be empty`)] });
      if (trigger.length > 100)
        return message.channel.send({ embeds: [warn(`${author}: Trigger must be 100 characters or fewer`)] });
      if (responseText.length > 2000)
        return message.channel.send({ embeds: [warn(`${author}: Response must be 2000 characters or fewer`)] });

      const all = await db.getAutoresponders(guild.id);
      if (all.length >= 50)
        return message.channel.send({ embeds: [warn(`${author}: Maximum **50 autoresponders** reached — remove some first`)] });

      await db.addAutoresponder(guild.id, trigger, responseText, opts);

      const flags = [];
      if (!opts.strict)             flags.push('`partial match`');
      if (opts.exclusive)           flags.push('`exclusive`');
      if (opts.selfDestruct)        flags.push(`\`self-destruct ${opts.selfDestruct}s\``);
      if (opts.ignoreCommandCheck)  flags.push('`ignores prefix`');
      if (opts.delete)              flags.push('`deletes trigger`');

      return message.channel.send({ embeds: [base(AR_COLOR)
        .setTitle('✅ Autoresponder Created')
        .addFields(
          { name: 'Trigger',   value: `\`${trigger}\``,         inline: true },
          { name: 'Match',     value: opts.strict ? '`Exact`' : '`Contains`', inline: true },
          { name: '\u200b',    value: '\u200b',                  inline: true },
          { name: 'Response',  value: `\`\`\`${responseText.slice(0, 200)}\`\`\`` },
          ...(flags.length ? [{ name: 'Flags', value: flags.join(' ') }] : []),
        )
      ]});
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}autoresponder\` for help.`)] });
  },

  // Exported for use in messageCreate listener
  applyVars,
};
