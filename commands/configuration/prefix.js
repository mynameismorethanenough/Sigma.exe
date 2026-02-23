const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, success, warn, base, Colors } = require('../../utils/embeds');

module.exports = {
  name: 'prefix',
  aliases: ['setprefix'],

  run: async (client, message, args, prefix) => {
    const { guild, author, member } = message;
    const sub = args[0]?.toLowerCase();

    // ── prefix / prefix self ─── show current prefix ─────────
    if (!sub || sub === 'self') {
      const currentPrefix = await db.getPrefix(guild.id).catch(() => ',');
      return message.channel.send({ embeds: [base(Colors.info)
        .setTitle('⚙️ Server Prefix')
        .addFields(
          { name: '📌 Current Prefix', value: `\`${currentPrefix}\``, inline: true },
          { name: '📖 Usage',           value: `\`${currentPrefix}prefix set <prefix>\``, inline: true },
        )
        .setDescription([
          `\`${currentPrefix}prefix\` — show this menu`,
          `\`${currentPrefix}prefix self\` — show current prefix`,
          `\`${currentPrefix}prefix set <prefix>\` — set new prefix`,
          `\`${currentPrefix}prefix remove\` — reset to default \`,\``,
        ].join('\n'))
        .setFooter({ text: `Server: ${guild.name}` })
      ]});
    }

    // All subcommands below require Manage Guild
    if (!member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(author, 'manage_guild')] });

    // ── prefix remove ─── reset to default ───────────────────
    if (sub === 'remove' || sub === 'reset' || sub === 'default') {
      await db.setPrefix(guild.id, ',');
      return message.channel.send({ embeds: [success(`${author}: Prefix reset to default: \`,\``)] });
    }

    // ── prefix set <prefix> ───────────────────────────────────
    if (sub === 'set') {
      const newPrefix = args[1];
      if (!newPrefix)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}prefix set <new prefix>\``)] });
      if (newPrefix.length > 3)
        return message.channel.send({ embeds: [warn(`${author}: Prefix cannot be longer than **3 characters**`)] });
      if (/\s/.test(newPrefix))
        return message.channel.send({ embeds: [warn(`${author}: Prefix cannot contain spaces`)] });
      await db.setPrefix(guild.id, newPrefix);
      return message.channel.send({ embeds: [success(`${author}: Prefix set to \`${newPrefix}\``)] });
    }

    // ── Legacy: prefix <new> ── (backwards compat) ───────────
    // If args[0] is not a known subcommand and is short enough, treat as ,prefix <new>
    const direct = args[0];
    if (direct && direct.length <= 3 && !/\s/.test(direct)) {
      await db.setPrefix(guild.id, direct);
      return message.channel.send({ embeds: [success(`${author}: Prefix changed to \`${direct}\``)] });
    }

    return message.channel.send({ embeds: [warn(`${author}: Unknown subcommand. Use \`${prefix}prefix set <prefix>\`, \`${prefix}prefix remove\`, or \`${prefix}prefix self\``)] });
  }
};
