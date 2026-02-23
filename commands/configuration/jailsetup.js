const { PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, base, Colors, success, warn } = require('../../utils/embeds');

/**
 * Apply jail permission overwrites to every channel in the guild.
 *
 * - ALL channels:   deny ViewChannel, SendMessages, AddReactions, threads, Connect (voice)
 * - Jail channel:   allow ViewChannel + SendMessages for jailRole (overrides the deny above)
 *
 * This is called by 'create', 'role', and 'channel' so that existing roles/channels
 * are always fully wired up, not just saved to the database.
 */
async function applyJailPermissions(guild, jailRole, jailChannelId) {
  const promises = [];

  for (const channel of guild.channels.cache.values()) {
    const isJailChannel = channel.id === jailChannelId;

    // ── Text / forum / announcement / thread-parent channels ──
    if (
      channel.type === ChannelType.GuildText      ||
      channel.type === ChannelType.GuildAnnouncement ||
      channel.type === ChannelType.GuildForum     ||
      channel.type === ChannelType.GuildNews
    ) {
      if (isJailChannel) {
        // Jail channel: ONLY jailed people can see it
        promises.push(
          channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {}),
          channel.permissionOverwrites.edit(jailRole, {
            ViewChannel: true,
            SendMessages: true,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
          }).catch(() => {}),
        );
      } else {
        // Every other channel: jailed role cannot see or interact
        promises.push(
          channel.permissionOverwrites.edit(jailRole, {
            ViewChannel: false,
            SendMessages: false,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
          }).catch(() => {}),
        );
      }
    }

    // ── Voice channels ────────────────────────────────────────
    if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
      promises.push(
        channel.permissionOverwrites.edit(jailRole, {
          ViewChannel: false,
          Connect: false,
        }).catch(() => {}),
      );
    }
  }

  await Promise.all(promises);
}

module.exports = {
  name: 'jailsetup',
  aliases: ['jailconfig', 'setupjail'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_guild')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'manage_roles')] });

    // ── Status (no args) ──────────────────────────────────────
    if (!args[0]) {
      const cfg    = await db.getJailConfig(message.guild.id);
      const jailRole = cfg?.jail_role_id   ? message.guild.roles.cache.get(cfg.jail_role_id)     : null;
      const jailCh   = cfg?.jail_channel_id ? message.guild.channels.cache.get(cfg.jail_channel_id) : null;

      return message.channel.send({ embeds: [base(Colors.jail)
        .setTitle('⚙️ Jail Setup')
        .setDescription('Configure the jail system. A **role** and a **channel** are required before you can use `,jail`.')
        .addFields(
          { name: '🔒 Jail Role',    value: jailRole ? `${jailRole} \`(${jailRole.id})\`` : '`Not set`', inline: true },
          { name: '📢 Jail Channel', value: jailCh   ? `${jailCh} \`(${jailCh.id})\``   : '`Not set`', inline: true },
          { name: '\u200b',          value: '\u200b',                                                     inline: true },
          { name: '**Subcommands**', value: [
            `\`${prefix}jailsetup create\` — auto-create jail role & channel with correct permissions`,
            `\`${prefix}jailsetup role @role\` — use existing role (permissions will be applied)`,
            `\`${prefix}jailsetup channel #channel\` — use existing channel (permissions will be applied)`,
            `\`${prefix}jailsetup update\` — re-apply permissions to all channels (use after adding new channels)`,
            `\`${prefix}jailsetup reset\` — clear jail config`,
          ].join('\n') }
        )] });
    }

    const sub = args[0].toLowerCase();

    // ── CREATE ────────────────────────────────────────────────
    if (sub === 'create') {
      const statusMsg = await message.channel.send({
        embeds: [base(Colors.jail).setDescription('⚙️ Creating jail setup — applying permissions to all channels, this may take a moment...')]
      });

      // Create the Jailed role with zero permissions
      const jailRole = await message.guild.roles.create({
        name: 'Jailed',
        color: '#818386',
        reason: `Jail system setup by ${message.author.tag}`,
        permissions: [],
      });

      // Create the jail channel (everyone can't see, jailRole can)
      const jailChannel = await message.guild.channels.create({
        name: '🔒・jail',
        reason: `Jail system setup by ${message.author.tag}`,
        permissionOverwrites: [
          { id: message.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: jailRole,                     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages], deny: [PermissionFlagsBits.AddReactions] },
          { id: message.guild.members.me,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ]
      });

      await db.setJailConfig(message.guild.id, jailRole.id, jailChannel.id);

      // Apply deny-ViewChannel to every other channel
      await applyJailPermissions(message.guild, jailRole, jailChannel.id);

      await statusMsg.edit({ embeds: [success(
        `${message.author}: Jail system created!\n> **Role:** ${jailRole}\n> **Channel:** ${jailChannel}\n> All channels have been locked for jailed members.`
      )] });
      return;
    }

    // ── ROLE ──────────────────────────────────────────────────
    if (sub === 'role') {
      const role = message.mentions.roles.first()
        ?? message.guild.roles.cache.find(r => r.name.toLowerCase() === args.slice(1).join(' ').toLowerCase());
      if (!role) return message.channel.send({ embeds: [warn(`${message.author}: Provide a role — \`${prefix}jailsetup role @role\``)] });
      if (role.managed) return message.channel.send({ embeds: [warn(`${message.author}: Cannot use a bot/integration managed role`)] });

      const cfg = await db.getJailConfig(message.guild.id);
      await db.setJailConfig(message.guild.id, role.id, cfg?.jail_channel_id ?? null);

      const statusMsg = await message.channel.send({
        embeds: [base(Colors.jail).setDescription(`⚙️ Jail role set to ${role} — applying permission overwrites to all channels...`)]
      });

      // Apply channel overwrites so jailed members can't see anything
      await applyJailPermissions(message.guild, role, cfg?.jail_channel_id ?? null);

      await statusMsg.edit({ embeds: [success(`${message.author}: Jail role set to ${role}\n> Channel permission overwrites applied to **${message.guild.channels.cache.size}** channels.`)] });
      return;
    }

    // ── CHANNEL ───────────────────────────────────────────────
    if (sub === 'channel') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.channel.send({ embeds: [warn(`${message.author}: Provide a channel — \`${prefix}jailsetup channel #channel\``)] });

      const cfg = await db.getJailConfig(message.guild.id);
      await db.setJailConfig(message.guild.id, cfg?.jail_role_id ?? null, channel.id);

      // Set up the new jail channel's overwrites
      const overwrites = [
        { id: message.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: message.guild.members.me,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ];
      if (cfg?.jail_role_id) {
        const jailRole = message.guild.roles.cache.get(cfg.jail_role_id);
        if (jailRole) {
          overwrites.push({ id: jailRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages], deny: [PermissionFlagsBits.AddReactions] });
          // Also re-apply so the jail channel overwrite on the role is correct
          await applyJailPermissions(message.guild, jailRole, channel.id);
        }
      }
      await channel.permissionOverwrites.set(overwrites).catch(() => {});

      return message.channel.send({ embeds: [success(
        `${message.author}: Jail channel set to ${channel}\n> Permission overwrites applied.${!cfg?.jail_role_id ? `\n> ⚠️ No jail role set yet — run \`${prefix}jailsetup role @role\`` : ''}`
      )] });
    }

    // ── UPDATE (re-apply to all channels) ─────────────────────
    if (sub === 'update' || sub === 'sync') {
      const cfg = await db.getJailConfig(message.guild.id);
      if (!cfg?.jail_role_id) return message.channel.send({ embeds: [warn(`${message.author}: No jail role configured — run \`${prefix}jailsetup role @role\` first`)] });
      const jailRole = message.guild.roles.cache.get(cfg.jail_role_id);
      if (!jailRole) return message.channel.send({ embeds: [warn(`${message.author}: Jail role not found in this server`)] });

      const statusMsg = await message.channel.send({
        embeds: [base(Colors.jail).setDescription('⚙️ Re-applying jail permissions to all channels...')]
      });
      await applyJailPermissions(message.guild, jailRole, cfg.jail_channel_id ?? null);
      await statusMsg.edit({ embeds: [success(`${message.author}: Jail permissions updated across **${message.guild.channels.cache.size}** channels.`)] });
      return;
    }

    // ── RESET ─────────────────────────────────────────────────
    if (sub === 'reset') {
      await db.setJailConfig(message.guild.id, null, null);
      return message.channel.send({ embeds: [success(`${message.author}: Jail configuration has been reset\n> Run \`${prefix}jailsetup create\` to set it up again.`)] });
    }

    return message.channel.send({ embeds: [warn(`${message.author}: Unknown subcommand. Run \`${prefix}jailsetup\` for help.`)] });
  }
};
