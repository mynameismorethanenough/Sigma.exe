/**
 * enablemodule — Re-enable a disabled command module
 *
 * enablemodule all <module>    — re-enable a module server-wide
 */

const { PermissionFlagsBits } = require('discord.js');
const db  = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

const MODULES = ['configuration', 'moderation', 'information', 'security', 'music', 'fun', 'utility', 'roleplay'];

module.exports = {
  name: 'enablemodule',
  aliases: ['enablemod', 'moduleon'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();
    const moduleList = MODULES.map(m => `\`${m}\``).join(', ');

    // ── Help ──────────────────────────────────────────────────
    if (!sub) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🔧 Enable Module')
        .setDescription('Re-enable a previously disabled command module.')
        .addFields(
          { name: '📋 Usage', value: [
            `\`${prefix}enablemodule all <module>\` — re-enable server-wide`,
            `> View disabled: \`${prefix}disablemodule list\``,
          ].join('\n') },
          { name: '📦 Available Modules', value: moduleList },
        )
      ]});
    }

    // ── ALL ───────────────────────────────────────────────────
    if (sub === 'all') {
      const moduleName = args[1]?.toLowerCase();
      if (!moduleName)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}enablemodule all <module>\`\nModules: ${moduleList}`)] });
      if (!MODULES.includes(moduleName))
        return message.channel.send({ embeds: [warn(`${author}: Unknown module \`${moduleName}\`\nAvailable: ${moduleList}`)] });

      const removed = await db.enableModule(guild.id, moduleName, '');
      if (!removed)
        return message.channel.send({ embeds: [warn(`${author}: Module \`${moduleName}\` is not disabled server-wide`)] });
      return message.channel.send({ embeds: [success(`${author}: Module \`${moduleName}\` re-enabled **server-wide**`)] });
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Run \`${prefix}enablemodule\` for help.`)] });
  }
};
