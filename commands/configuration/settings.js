/**
 * settings — Consolidated server configuration command
 *
 * settings                          — view full configuration overview
 * settings configuration            — same as above (alias)
 * settings modlog <channel>         — set/clear mod log channel
 * settings jail                     — view jail config
 * settings jailmsg <msg>            — set custom jail message
 * settings autonick <format>        — set auto-nickname for new members
 * settings muted <@role>            — set the muted role (text)
 * settings rmuted <@role>           — set the reaction-muted role
 * settings imuted <@role>           — set the image-muted role
 * settings staff <@role>            — add/remove a staff role
 * settings staff list               — list all staff roles
 */

const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, success, warn, Colors } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'settings',
  aliases: ['config', 'serverconfig', 'guildconfig'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });

    const { guild, author } = message;
    const sub = args[0]?.toLowerCase();

    // ── OVERVIEW ──────────────────────────────────────────────
    if (!sub || sub === 'configuration' || sub === 'view' || sub === 'overview') {
      const [guildData, settings, jailCfg, staffRoles] = await Promise.all([
        db.getGuild(guild.id),
        db.getSettings(guild.id),
        db.getJailConfig(guild.id),
        db.getStaffRoles(guild.id),
      ]);

      const yesNo  = (v) => v ? '✅ Enabled'  : '❌ Disabled';
      const ch     = (id) => id ? `<#${id}>` : '`Not set`';
      const role   = (id) => id ? `<@&${id}>` : '`Not set`';

      const jailRole = jailCfg?.jail_role_id ? guild.roles.cache.get(jailCfg.jail_role_id) : null;
      const jailCh   = jailCfg?.jail_channel_id ? guild.channels.cache.get(jailCfg.jail_channel_id) : null;
      const staffList = staffRoles.length
        ? staffRoles.map(r => `<@&${r.role_id}>`).join(', ')
        : '`Not set`';

      return message.channel.send({ embeds: [base(Colors.info)
        .setAuthor({ name: `${guild.name} — Server Configuration`, iconURL: guild.iconURL({ dynamic: true }) ?? undefined })
        .addFields(
          { name: '⚙️ General',    inline: true, value: [
            `**Prefix:** \`${guildData?.prefix ?? ','}\``,
            `**Mod Log:** ${ch(guildData?.log_channel)}`,
          ].join('\n') },
          { name: '👤 Member Events', inline: true, value: [
            `**Welcome Channel:** ${ch(settings?.welcome_channel)}`,
            `**Autorole:** ${role(settings?.autorole_id)}`,
            `**Join DM:** ${settings?.joindm_message ? '✅ Set' : '❌ Not set'}`,
            `**Auto Nickname:** ${settings?.autonick_format ? `\`${settings.autonick_format}\`` : '`Not set`'}`,
          ].join('\n') },
          { name: '\u200b', inline: true, value: '\u200b' },
          { name: '🔒 Moderation Roles', inline: true, value: [
            `**Muted:** ${role(settings?.muted_role_id)}`,
            `**Reaction Muted:** ${role(settings?.rmuted_role_id)}`,
            `**Image Muted:** ${role(settings?.imuted_role_id)}`,
          ].join('\n') },
          { name: '🔐 Jail System', inline: true, value: [
            `**Jail Role:** ${jailRole ? `${jailRole}` : '`Not set`'}`,
            `**Jail Channel:** ${jailCh ? `${jailCh}` : '`Not set`'}`,
            `**Custom Message:** ${jailCfg?.custom_jail_message ? '✅ Set' : '❌ Not set'}`,
          ].join('\n') },
          { name: '\u200b', inline: true, value: '\u200b' },
          { name: '🔑 Staff Roles', value: staffList },
          { name: '🛡️ Security', value: [
            `**Anti-Invite:** ${yesNo(settings?.antiinvite)}`,
          ].join('\n') },
        )
        .setFooter({ text: `Use ${prefix}settings <subcommand> to change any setting` })
      ]});
    }

    // ── MODLOG ────────────────────────────────────────────────
    if (sub === 'modlog' || sub === 'logs' || sub === 'log') {
      if (args[1]?.toLowerCase() === 'clear' || args[1]?.toLowerCase() === 'remove') {
        await db.setLogChannel(guild.id, null);
        return message.channel.send({ embeds: [success(`${author}: Mod log channel removed`)] });
      }
      const channel = message.mentions.channels.first()
        ?? (args[1] ? guild.channels.cache.get(args[1]) : null);
      if (!channel)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}settings modlog #channel\` or \`${prefix}settings modlog clear\``)] });
      await db.setLogChannel(guild.id, channel.id);
      return message.channel.send({ embeds: [success(`${author}: Mod log channel set to ${channel}`)] });
    }

    // ── JAIL (view) ───────────────────────────────────────────
    if (sub === 'jail') {
      const cfg = await db.getJailConfig(guild.id);
      const jailRole = cfg?.jail_role_id ? guild.roles.cache.get(cfg.jail_role_id) : null;
      const jailCh   = cfg?.jail_channel_id ? guild.channels.cache.get(cfg.jail_channel_id) : null;
      return message.channel.send({ embeds: [base(Colors.jail)
        .setTitle('🔒 Jail Configuration')
        .addFields(
          { name: '🔒 Jail Role',      value: jailRole ? `${jailRole}` : '`Not set`', inline: true },
          { name: '📢 Jail Channel',   value: jailCh   ? `${jailCh}`   : '`Not set`', inline: true },
          { name: '💬 Custom Message', value: cfg?.custom_jail_message ? `\`${cfg.custom_jail_message.slice(0, 100)}\`` : '`Not set`' },
        )
        .setFooter({ text: `Use ${prefix}jailsetup to configure the jail system` })
      ]});
    }

    // ── JAILMSG ───────────────────────────────────────────────
    if (sub === 'jailmsg') {
      if (args[1]?.toLowerCase() === 'clear' || args[1]?.toLowerCase() === 'remove') {
        await db.updateSetting(guild.id, 'autonick_format', null); // no-op placeholder
        // update jail_config directly
        const { q } = db;
        await db.q(`UPDATE jail_config SET custom_jail_message=NULL WHERE guild_id=$1`, [guild.id]).catch(() => {});
        return message.channel.send({ embeds: [success(`${author}: Custom jail message cleared`)] });
      }
      const msg = args.slice(1).join(' ');
      if (!msg)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}settings jailmsg <message>\`\n> Variables: \`{user}\` \`{reason}\` \`{duration}\`\n> Or \`clear\` to remove`)] });
      if (msg.length > 500)
        return message.channel.send({ embeds: [warn(`${author}: Message cannot exceed **500 characters**`)] });

      await db.q(`UPDATE jail_config SET custom_jail_message=$1 WHERE guild_id=$2`, [msg, guild.id]).catch(async () => {
        await db.q(`INSERT INTO jail_config (guild_id, custom_jail_message) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET custom_jail_message=$2`, [guild.id, msg]);
      });
      return message.channel.send({ embeds: [success(`${author}: Custom jail message set!\n> \`${msg.slice(0, 80)}${msg.length > 80 ? '…' : ''}\`\n> Variables: \`{user}\` \`{reason}\` \`{duration}\``)] });
    }

    // ── AUTONICK ──────────────────────────────────────────────
    if (sub === 'autonick') {
      if (args[1]?.toLowerCase() === 'clear' || args[1]?.toLowerCase() === 'remove') {
        await db.updateSetting(guild.id, 'autonick_format', null);
        return message.channel.send({ embeds: [success(`${author}: Auto-nickname format cleared`)] });
      }
      const fmt = args.slice(1).join(' ');
      if (!fmt)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}settings autonick <format>\`\n> Variables: \`{name}\` \`{tag}\` \`{id}\`\n> Or \`clear\` to remove`)] });
      await db.updateSetting(guild.id, 'autonick_format', fmt);
      return message.channel.send({ embeds: [success(`${author}: Auto-nickname format set to \`${fmt}\`\n> Variables: \`{name}\` \`{tag}\` \`{id}\``)] });
    }

    // ── MUTED ─────────────────────────────────────────────────
    if (sub === 'muted') {
      if (args[1]?.toLowerCase() === 'clear' || args[1]?.toLowerCase() === 'remove') {
        await db.updateSetting(guild.id, 'muted_role_id', null);
        return message.channel.send({ embeds: [success(`${author}: Muted role cleared`)] });
      }
      const role = message.mentions.roles.first()
        ?? (args[1] ? guild.roles.cache.get(args[1]) : null);
      if (!role)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}settings muted @role\` or \`clear\``)] });
      await db.updateSetting(guild.id, 'muted_role_id', role.id);
      return message.channel.send({ embeds: [success(`${author}: Muted role set to ${role}`)] });
    }

    // ── RMUTED ────────────────────────────────────────────────
    if (sub === 'rmuted') {
      if (args[1]?.toLowerCase() === 'clear') {
        await db.updateSetting(guild.id, 'rmuted_role_id', null);
        return message.channel.send({ embeds: [success(`${author}: Reaction-muted role cleared`)] });
      }
      const role = message.mentions.roles.first()
        ?? (args[1] ? guild.roles.cache.get(args[1]) : null);
      if (!role)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}settings rmuted @role\` or \`clear\``)] });
      await db.updateSetting(guild.id, 'rmuted_role_id', role.id);
      return message.channel.send({ embeds: [success(`${author}: Reaction-muted role set to ${role}`)] });
    }

    // ── IMUTED ────────────────────────────────────────────────
    if (sub === 'imuted') {
      if (args[1]?.toLowerCase() === 'clear') {
        await db.updateSetting(guild.id, 'imuted_role_id', null);
        return message.channel.send({ embeds: [success(`${author}: Image-muted role cleared`)] });
      }
      const role = message.mentions.roles.first()
        ?? (args[1] ? guild.roles.cache.get(args[1]) : null);
      if (!role)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}settings imuted @role\` or \`clear\``)] });
      await db.updateSetting(guild.id, 'imuted_role_id', role.id);
      return message.channel.send({ embeds: [success(`${author}: Image-muted role set to ${role}`)] });
    }

    // ── STAFF ─────────────────────────────────────────────────
    if (sub === 'staff') {
      // staff list
      if (!args[1] || args[1]?.toLowerCase() === 'list') {
        const roles = await db.getStaffRoles(guild.id);
        if (!roles.length)
          return message.channel.send({ embeds: [base(Colors.neutral).setDescription(`No staff roles configured.\nUse \`${prefix}settings staff @role\` to add one`)] });
        return message.channel.send({ embeds: [base(Colors.info)
          .setTitle('👥 Staff Roles')
          .setDescription(roles.map((r, i) => {
            const role = guild.roles.cache.get(r.role_id);
            return `\`${i+1}.\` ${role ? `${role}` : `~~${r.role_id}~~`}`;
          }).join('\n'))
          .setFooter({ text: `${roles.length} staff role${roles.length !== 1 ? 's' : ''} configured` })
        ]});
      }

      const role = message.mentions.roles.first()
        ?? guild.roles.cache.get(args[1]);
      if (!role)
        return message.channel.send({ embeds: [warn(`${author}: Usage: \`${prefix}settings staff @role\` to add/remove, or \`${prefix}settings staff list\``)] });

      const existing = await db.getStaffRoles(guild.id);
      if (existing.some(r => r.role_id === role.id)) {
        await db.removeStaffRole(guild.id, role.id);
        return message.channel.send({ embeds: [success(`${author}: Removed ${role} from staff roles`)] });
      }
      if (existing.length >= 15)
        return message.channel.send({ embeds: [warn(`${author}: Maximum **15 staff roles** reached`)] });
      await db.addStaffRole(guild.id, role.id, author.id);
      return message.channel.send({ embeds: [success(`${author}: Added ${role} to staff roles`)] });
    }

    // ── Unknown sub ───────────────────────────────────────────
    return message.channel.send({ embeds: [base(Colors.neutral)
      .setTitle('⚙️ Settings — Subcommands')
      .setDescription([
        `\`${prefix}settings\` — overview of all settings`,
        `\`${prefix}settings modlog <#channel | clear>\` — mod log channel`,
        `\`${prefix}settings jail\` — view jail config`,
        `\`${prefix}settings jailmsg <msg | clear>\` — custom jail message`,
        `\`${prefix}settings autonick <format | clear>\` — auto-nickname format`,
        `\`${prefix}settings muted <@role | clear>\` — text muted role`,
        `\`${prefix}settings rmuted <@role | clear>\` — reaction muted role`,
        `\`${prefix}settings imuted <@role | clear>\` — image muted role`,
        `\`${prefix}settings staff <@role>\` — add/remove staff role`,
        `\`${prefix}settings staff list\` — list staff roles`,
      ].join('\n'))
    ]});
  }
};
