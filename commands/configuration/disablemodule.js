/**
 * disablemodule — Disable an entire command module/category server-wide
 *
 * disablemodule all <module>     — disable a module server-wide
 * disablemodule list             — list all disabled modules
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

const MODULES = ['configuration', 'moderation', 'information', 'security', 'music', 'fun', 'utility', 'roleplay'];
const PROTECTED_MODULES = ['configuration']; // config module can never be disabled

module.exports = {
  name: 'disablemodule',
  aliases: ['disablemod', 'moduleoff'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    const moduleList = MODULES.map(m => `\`${m}\``).join(', ');

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🔧 Disable Module')
        .setDescription('Disable an entire command category (module) server-wide. All commands in that module stop working.')
        .addFields(
          { name: '📋 Usage', value: [
            `\`${prefix}disablemodule all <module>\` — disable a module server-wide`,
            `\`${prefix}disablemodule list\` — view all disabled modules`,
            `> Re-enable with \`${prefix}enablemodule all <module>\``,
          ].join('\n') },
          { name: '📦 Available Modules', value: moduleList },
        )
      ]});
    }

    // ── LIST ──────────────────────────────────────────────────
    if (sub === 'list') {
      const rows = await db.getDisabledModules(guild.id);
      if (!rows.length)
        return message.channel.send({ embeds: [base(Colors.neutral).setDescription('No modules are disabled in this server')] });

      const guildWide = rows.filter(r => r.channel_id === '');
      if (!guildWide.length)
        return message.channel.send({ embeds: [base(Colors.neutral).setDescription('No modules are disabled server-wide')] });

      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🚫 Disabled Modules')
        .setDescription(guildWide.map(r => `\`${r.module_name}\``).join(' '))
      ]});
    }

    // ── ALL (server-wide) ─────────────────────────────────────
    if (sub === 'all') {
      const moduleName = args[1]?.toLowerCase();
      if (!moduleName)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}disablemodule all <module>\`\nModules: ${moduleList}`)] });
      if (!MODULES.includes(moduleName))
        return message.channel.send({ embeds: [warn(`${author}: Unknown module \`${moduleName}\`\nAvailable: ${moduleList}`)] });
      if (PROTECTED_MODULES.includes(moduleName))
        return message.channel.send({ embeds: [warn(`${author}: The \`${moduleName}\` module cannot be disabled`)] });

      await db.disableModule(guild.id, moduleName, '', author.id);
      return message.channel.send({ embeds: [success(`${author}: Module \`${moduleName}\` disabled **server-wide**\n> Re-enable with \`${prefix}enablemodule all ${moduleName}\``)] });
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}disablemodule\` for help.`)] });
  }
};
