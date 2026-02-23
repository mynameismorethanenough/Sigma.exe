/**
 * alias — Create server-wide shortcuts for existing commands
 *
 * alias list                       — view all aliases
 * alias add <shortcut> <command>   — create a shortcut
 * alias remove <shortcut>          — remove one shortcut
 * alias removeall <command>        — remove all shortcuts for a command
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

const PROTECTED_SHORTCUTS = ['alias', 'help', 'disable', 'enable'];

module.exports = {
  name: 'alias',
  aliases: ['cmdalias', 'shortcuts'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🔗 Command Aliases')
        .setDescription('Create custom shortcuts for existing commands. Aliases work just like real commands.')
        .addFields({ name: '📋 Subcommands', value: [
          `\`${prefix}alias list\` — view all configured aliases`,
          `\`${prefix}alias add <shortcut> <command>\` — create a shortcut`,
          `\`${prefix}alias remove <shortcut>\` — remove one alias`,
          `\`${prefix}alias removeall <command>\` — remove all aliases for a command`,
        ].join('\n') })
        .addFields({ name: '💡 Example', value: `\`${prefix}alias add b ban\` → \`${prefix}b @user\` now works as \`${prefix}ban @user\`` })
      ]});
    }

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const aliases = await db.getAliases(guild.id);
      if (!aliases.length)
        return message.channel.send({ embeds: [base(Colors.neutral).setDescription(`📭 No aliases configured.\nUse \`${prefix}alias add <shortcut> <command>\` to create one.`)] });

      const lines = aliases.map(a => `\`${prefix}${a.shortcut}\` → \`${prefix}${a.command}\``);
      return message.channel.send({ embeds: [base(Colors.info)
        .setTitle(`🔗 Command Aliases (${aliases.length})`)
        .setDescription(lines.join('\n'))
      ]});
    }

    // ── ADD ───────────────────────────────────────────────────
    if (sub === 'add') {
      const shortcut = args[1]?.toLowerCase();
      const command  = args.slice(2).join(' ').toLowerCase();

      if (!shortcut || !command)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}alias add <shortcut> <command>\``)] });
      if (PROTECTED_SHORTCUTS.includes(shortcut))
        return message.channel.send({ embeds: [warn(`${author}: \`${shortcut}\` is a protected command and cannot be aliased`)] });
      if (shortcut.length > 30)
        return message.channel.send({ embeds: [warn(`${author}: Shortcut must be 30 characters or fewer`)] });

      // Verify target command exists
      const targetCmd = client.prefixCmds.get(command) ?? client.prefixCmds.get(client.aliases.get(command));
      if (!targetCmd)
        return message.channel.send({ embeds: [warn(`${author}: Command \`${command}\` not found`)] });

      const existing = await db.getAliases(guild.id);
      if (existing.length >= 50)
        return message.channel.send({ embeds: [warn(`${author}: Maximum **50 aliases** reached — remove some first`)] });

      await db.addAlias(guild.id, shortcut, targetCmd.name, author.id);
      return message.channel.send({ embeds: [success(`${author}: Alias created — \`${prefix}${shortcut}\` → \`${prefix}${targetCmd.name}\``)] });
    }

    // ── REMOVE ────────────────────────────────────────────────
    if (sub === 'remove' || sub === 'delete') {
      const shortcut = args[1]?.toLowerCase();
      if (!shortcut)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}alias remove <shortcut>\``)] });

      const removed = await db.removeAlias(guild.id, shortcut);
      if (!removed)
        return message.channel.send({ embeds: [warn(`${author}: No alias found for \`${shortcut}\``)] });
      return message.channel.send({ embeds: [success(`${author}: Alias \`${prefix}${shortcut}\` removed`)] });
    }

    // ── REMOVEALL ─────────────────────────────────────────────
    if (sub === 'removeall') {
      const command = args.slice(1).join(' ').toLowerCase();
      if (!command)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}alias removeall <command>\``)] });

      const targetCmd = client.prefixCmds.get(command) ?? client.prefixCmds.get(client.aliases.get(command));
      const cmdName = targetCmd?.name ?? command;

      const count = await db.removeAllAliasesForCommand(guild.id, cmdName);
      if (!count)
        return message.channel.send({ embeds: [warn(`${author}: No aliases found for \`${cmdName}\``)] });
      return message.channel.send({ embeds: [success(`${author}: Removed **${count}** alias${count !== 1 ? 'es' : ''} for \`${cmdName}\``)] });
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}alias\` for help.`)] });
  }
};
