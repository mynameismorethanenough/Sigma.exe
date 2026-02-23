const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { base, success, error, warn, Colors, E } = require('../../utils/embeds');

const PUNISHMENT_ICONS = { ban: '🔨 Ban', kick: '👢 Kick', strip: '🪤 Strip Roles', timeout: '⏱️ Timeout' };

// ── Build the main status embed ───────────────────────────────
async function buildStatusEmbed(guild, cfg, wl, admins) {
  const statusIcon = cfg.enabled ? '🟢' : '🔴';
  const statusText = cfg.enabled ? 'Protected' : 'Unprotected';

  return new EmbedBuilder()
    .setColor(cfg.enabled ? Colors.security : Colors.neutral)
    .setAuthor({ name: `${guild.name} — Security Dashboard`, iconURL: guild.iconURL({ dynamic: true }) ?? undefined })
    .setDescription(cfg.enabled
      ? '> 🛡️ Your server is **actively protected**. Select a category below to configure.'
      : '> ⚠️ Antinuke is **disabled**. Use `enable` to protect your server.')
    .addFields(
      {
        name: `${statusIcon} Status`,
        value: [
          `**State:** \`${statusText}\``,
          `**Punishment:** ${PUNISHMENT_ICONS[cfg.punishment] ?? cfg.punishment}`,
          `**Trusted Users:** \`${wl.length}\``,
          `**AN Admins:** \`${admins.length}\``,
        ].join('\n'),
        inline: true
      },
      {
        name: '🔢 Action Limits',
        value: [
          `🗑️ Ch. Delete:    \`${cfg.channel_delete_limit}\``,
          `🆕 Ch. Create:    \`${cfg.channel_create_limit}\``,
          `🔴 Role Delete:   \`${cfg.role_delete_limit}\``,
          `🟢 Role Create:   \`${cfg.role_create_limit}\``,
          `✏️  Role Rename:   \`${cfg.role_rename_limit ?? 3}\``,
          `🔨 Ban:           \`${cfg.ban_limit}\``,
          `👢 Kick:          \`${cfg.kick_limit ?? 3}\``,
        ].join('\n'),
        inline: true
      },
      {
        name: '🔢 More Limits',
        value: [
          `🤖 Bot Add:       \`${cfg.bot_add_limit}\``,
          `🪝 Webhook:       \`${cfg.webhook_create_limit}\``,
          `📢 Mass Mention:  \`${cfg.mention_limit ?? 10}\``,
          `✂️  Prune:         \`${cfg.prune_limit ?? 5}+ members\``,
          `🔗 Inv. Delete:   \`${cfg.invite_delete_limit ?? 3}\``,
          `🏷️  Srv. Rename:  \`${cfg.server_rename_limit ?? 2}\``,
        ].join('\n'),
        inline: true
      },
      {
        name: '🔔 Toggle Protections',
        value: [
          `👻 Ghost Ping:  ${cfg.ghost_ping_enabled ?? true ? '🟢 On' : '🔴 Off'}`,
          `🎯 Vanity Guard: ${cfg.vanity_enabled ?? true ? '🟢 On' : '🔴 Off'}`,
        ].join('\n'),
        inline: true
      }
    )
    .setFooter({ text: 'Use the dropdown below to configure • Owner only' })
    .setTimestamp();
}

// ── Build the dropdown select menu ────────────────────────────
function buildSelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('antinuke_menu')
      .setPlaceholder('⚙️ Configure Antinuke...')
      .addOptions([
        { label: '🟢 Enable Protection',      description: 'Turn antinuke on',                       value: 'enable',         emoji: '🟢' },
        { label: '🔴 Disable Protection',     description: 'Turn antinuke off',                      value: 'disable',        emoji: '🔴' },
        { label: '🔨 Set Punishment',         description: 'Choose: ban, kick, strip, timeout',       value: 'punishment',     emoji: '🔨' },
        { label: '📋 View Whitelisted Users', description: 'List all trusted users',                  value: 'whitelisted',    emoji: '📋' },
        { label: '👥 View Admins',            description: 'List antinuke admins',                    value: 'admins',         emoji: '👥' },
        { label: '👻 Toggle Ghost Ping Alert',description: 'Enable/disable ghost ping detection',     value: 'toggle_ghost',   emoji: '👻' },
        { label: '🎯 Toggle Vanity Guard',    description: 'Enable/disable vanity URL protection',    value: 'toggle_vanity',  emoji: '🎯' },
        { label: '📊 View Action Limits',     description: 'See all configurable limits',             value: 'limits',         emoji: '📊' },
        { label: '🔄 Refresh Status',         description: 'Reload the current config',               value: 'refresh',        emoji: '🔄' },
      ])
  );
}

// ── Punishment picker ─────────────────────────────────────────
function buildPunishmentMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('antinuke_punishment')
      .setPlaceholder('Choose a punishment...')
      .addOptions([
        { label: '🔨 Ban',        description: 'Permanently ban the offender',      value: 'ban' },
        { label: '👢 Kick',       description: 'Kick the offender from the server', value: 'kick' },
        { label: '🪤 Strip Roles',description: 'Remove all roles from offender',    value: 'strip' },
        { label: '⏱️ Timeout',    description: 'Timeout for 28 days',               value: 'timeout' },
      ])
  );
}

function buildLimitsEmbed(cfg, prefix) {
  return new EmbedBuilder()
    .setColor(Colors.security)
    .setTitle('📊 Antinuke Action Limits')
    .setDescription('Adjust limits with `' + prefix + 'antinuke limit <action> <number>`')
    .addFields(
      { name: 'Action', value: [
        '`channeldelete`', '`channelcreate`', '`roledelete`', '`rolecreate`',
        '`rolerename`', '`ban`', '`kick`', '`botadd`', '`webhook`',
        '`mention`', '`prune`', '`invitedelete`', '`serverrename`',
      ].join('\n'), inline: true },
      { name: 'Current Limit', value: [
        `\`${cfg.channel_delete_limit}\``,
        `\`${cfg.channel_create_limit}\``,
        `\`${cfg.role_delete_limit}\``,
        `\`${cfg.role_create_limit}\``,
        `\`${cfg.role_rename_limit ?? 3}\``,
        `\`${cfg.ban_limit}\``,
        `\`${cfg.kick_limit ?? 3}\``,
        `\`${cfg.bot_add_limit}\``,
        `\`${cfg.webhook_create_limit}\``,
        `\`${cfg.mention_limit ?? 10}\``,
        `\`${cfg.prune_limit ?? 5}\` members`,
        `\`${cfg.invite_delete_limit ?? 3}\``,
        `\`${cfg.server_rename_limit ?? 2}\``,
      ].join('\n'), inline: true },
      { name: 'Description', value: [
        'Max ch. deletions before trigger',
        'Max ch. creations before trigger',
        'Max role deletions before trigger',
        'Max role creations before trigger',
        'Max role renames before trigger',
        'Max bans before trigger',
        'Max kicks before trigger',
        'Max bots added before trigger',
        'Max webhooks before trigger',
        'Mentions in one message to trigger',
        'Pruned members to trigger',
        'Max invite deletions before trigger',
        'Max server renames before trigger',
      ].join('\n'), inline: true },
    )
    .setFooter({ text: 'All limits apply per-user per 10 second window' })
    .setTimestamp();
}

module.exports = {
  name: 'antinuke',
  aliases: ['an', 'nuke'],

  run: async (client, message, args, prefix) => {
    if (message.author.id !== message.guild.ownerId)
      return message.channel.send({ embeds: [error(`${message.author}: Only the **server owner** can manage antinuke`)] });

    await db.ensureGuild(message.guild.id, message.guild.name);
    const sub = args[0]?.toLowerCase();

    // ── Direct subcommand: whitelist ──────────────────────────
    if (sub === 'whitelist' || sub === 'wl') {
      const user = message.mentions.users.first() ?? await client.users.fetch(args[1]).catch(() => null);
      if (!user) return message.channel.send({ embeds: [warn(`${message.author}: Mention a user or provide their ID`)] });
      if (user.id === message.guild.ownerId)
        return message.channel.send({ embeds: [warn(`${message.author}: The server owner is always trusted`)] });
      await db.addWhitelist(message.guild.id, user.id, message.author.id);
      return message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(Colors.security)
        .setDescription(`✅ ${message.author}: **${user.tag}** is now whitelisted`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))] });
    }

    if (sub === 'unwhitelist' || sub === 'delist' || sub === 'unwl') {
      const user = message.mentions.users.first() ?? await client.users.fetch(args[1]).catch(() => null);
      if (!user) return message.channel.send({ embeds: [warn(`${message.author}: Mention a user or provide their ID`)] });
      const removed = await db.removeWhitelist(message.guild.id, user.id);
      return message.channel.send({ embeds: [removed
        ? success(`${message.author}: **${user.tag}** removed from whitelist`)
        : warn(`${message.author}: **${user.tag}** was not whitelisted`)] });
    }

    // ── Direct subcommand: admin ──────────────────────────────
    if (sub === 'admin') {
      const action = args[1]?.toLowerCase();
      const user   = message.mentions.users.first() ?? await client.users.fetch(args[2]).catch(() => null);
      if (action === 'add') {
        if (!user) return message.channel.send({ embeds: [warn(`${message.author}: Mention a user`)] });
        if (user.id === message.guild.ownerId) return message.channel.send({ embeds: [warn(`Owner is always an admin`)] });
        await db.addAntinukeAdmin(message.guild.id, user.id, message.author.id);
        return message.channel.send({ embeds: [success(`${message.author}: **${user.tag}** can now manage antinuke settings`)] });
      }
      if (action === 'remove') {
        if (!user) return message.channel.send({ embeds: [warn(`${message.author}: Mention a user`)] });
        const removed = await db.removeAntinukeAdmin(message.guild.id, user.id);
        return message.channel.send({ embeds: [removed
          ? success(`${message.author}: **${user.tag}** removed from antinuke admins`)
          : warn(`${message.author}: **${user.tag}** is not an antinuke admin`)] });
      }
    }

    // ── Direct subcommand: limit ──────────────────────────────
    if (sub === 'limit' || sub === 'limits') {
      const actionMap = {
        channeldelete: 'channel_delete_limit', channelcreate: 'channel_create_limit',
        roledelete:    'role_delete_limit',    rolecreate:    'role_create_limit',
        rolerename:    'role_rename_limit',    ban:           'ban_limit',
        kick:          'kick_limit',           botadd:        'bot_add_limit',
        webhook:       'webhook_create_limit', mention:       'mention_limit',
        prune:         'prune_limit',          invitedelete:  'invite_delete_limit',
        serverrename:  'server_rename_limit',
      };
      const action = args[1]?.toLowerCase().replace(/[_\s-]/g, '');
      const col = actionMap[action];
      const n = parseInt(args[2]);
      if (!col || isNaN(n) || n < 1 || n > 100) {
        const cfg = await db.getAntinukeConfig(message.guild.id);
        return message.channel.send({ embeds: [buildLimitsEmbed(cfg, prefix)] });
      }
      await db.q(`UPDATE antinuke_config SET ${col}=$1 WHERE guild_id=$2`, [n, message.guild.id]);
      return message.channel.send({ embeds: [success(`${message.author}: **${action}** limit set to \`${n}\``)] });
    }

    // ── Direct subcommand: enable/disable ─────────────────────
    if (sub === 'enable') {
      await db.q('UPDATE antinuke_config SET enabled=TRUE WHERE guild_id=$1', [message.guild.id]);
      return message.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.security)
        .setDescription(`🛡️ ${message.author}: Antinuke **enabled** — 15 protections active`).setTimestamp()] });
    }
    if (sub === 'disable') {
      await db.q('UPDATE antinuke_config SET enabled=FALSE WHERE guild_id=$1', [message.guild.id]);
      return message.channel.send({ embeds: [warn(`${message.author}: Antinuke **disabled** — your server is unprotected`)] });
    }

    // ── Interactive dashboard (no args or "status") ───────────
    const cfg    = await db.getAntinukeConfig(message.guild.id);
    const wl     = await db.getWhitelist(message.guild.id);
    const admins = await db.getAntinukeAdmins(message.guild.id);

    const statusEmbed = await buildStatusEmbed(message.guild, cfg, wl, admins);
    const msg = await message.channel.send({
      embeds: [statusEmbed],
      components: [buildSelectMenu()],
    });

    const col = msg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 120_000,
    });

    col.on('collect', async i => {
      const id = i.customId;

      // ── Main menu selection ──────────────────────────────────
      if (id === 'antinuke_menu') {
        const val = i.values[0];

        if (val === 'enable') {
          await db.q('UPDATE antinuke_config SET enabled=TRUE WHERE guild_id=$1', [message.guild.id]);
          const newCfg = await db.getAntinukeConfig(message.guild.id);
          return i.update({ embeds: [await buildStatusEmbed(message.guild, newCfg, wl, admins)], components: [buildSelectMenu()] });
        }

        if (val === 'disable') {
          await db.q('UPDATE antinuke_config SET enabled=FALSE WHERE guild_id=$1', [message.guild.id]);
          const newCfg = await db.getAntinukeConfig(message.guild.id);
          return i.update({ embeds: [await buildStatusEmbed(message.guild, newCfg, wl, admins)], components: [buildSelectMenu()] });
        }

        if (val === 'punishment') {
          const pickEmbed = new EmbedBuilder()
            .setColor(Colors.security)
            .setTitle('🔨 Choose Punishment')
            .setDescription('Select what happens when antinuke triggers')
            .addFields(
              { name: '🔨 Ban',         value: 'Permanently bans offender',       inline: true },
              { name: '👢 Kick',        value: 'Kicks from server',               inline: true },
              { name: '🪤 Strip Roles', value: 'Removes all roles',               inline: true },
              { name: '⏱️ Timeout',     value: 'Times out for 28 days',           inline: true },
            );
          return i.update({ embeds: [pickEmbed], components: [buildPunishmentMenu()] });
        }

        if (val === 'whitelisted') {
          const list = await db.getWhitelist(message.guild.id);
          const embed = new EmbedBuilder()
            .setColor(Colors.security)
            .setTitle(`🛡️ Whitelisted Users (${list.length})`)
            .setDescription(list.length
              ? list.map((r, idx) => `\`${idx+1}.\` <@${r.user_id}> — added by <@${r.added_by}>`).join('\n')
              : 'No users whitelisted.')
            .setFooter({ text: `Use ${prefix}antinuke whitelist @user to add` });
          return i.update({ embeds: [embed], components: [buildSelectMenu()] });
        }

        if (val === 'admins') {
          const list = await db.getAntinukeAdmins(message.guild.id);
          const embed = new EmbedBuilder()
            .setColor(Colors.security)
            .setTitle(`👥 Antinuke Admins (${list.length})`)
            .setDescription(list.length
              ? list.map((r, idx) => `\`${idx+1}.\` <@${r.user_id}>`).join('\n')
              : 'No admins set.')
            .setFooter({ text: `Use ${prefix}antinuke admin add @user to add` });
          return i.update({ embeds: [embed], components: [buildSelectMenu()] });
        }

        if (val === 'toggle_ghost') {
          const current = cfg.ghost_ping_enabled ?? true;
          await db.q('UPDATE antinuke_config SET ghost_ping_enabled=$1 WHERE guild_id=$2', [!current, message.guild.id]);
          const newCfg = await db.getAntinukeConfig(message.guild.id);
          return i.update({ embeds: [await buildStatusEmbed(message.guild, newCfg, wl, admins)], components: [buildSelectMenu()] });
        }

        if (val === 'toggle_vanity') {
          const current = cfg.vanity_enabled ?? true;
          await db.q('UPDATE antinuke_config SET vanity_enabled=$1 WHERE guild_id=$2', [!current, message.guild.id]);
          const newCfg = await db.getAntinukeConfig(message.guild.id);
          return i.update({ embeds: [await buildStatusEmbed(message.guild, newCfg, wl, admins)], components: [buildSelectMenu()] });
        }

        if (val === 'limits') {
          const currentCfg = await db.getAntinukeConfig(message.guild.id);
          return i.update({ embeds: [buildLimitsEmbed(currentCfg, prefix)], components: [buildSelectMenu()] });
        }

        if (val === 'refresh') {
          const newCfg = await db.getAntinukeConfig(message.guild.id);
          const newWl  = await db.getWhitelist(message.guild.id);
          const newAd  = await db.getAntinukeAdmins(message.guild.id);
          return i.update({ embeds: [await buildStatusEmbed(message.guild, newCfg, newWl, newAd)], components: [buildSelectMenu()] });
        }
      }

      // ── Punishment menu selection ──────────────────────────────
      if (id === 'antinuke_punishment') {
        const type = i.values[0];
        await db.setAntinukePunishment(message.guild.id, type);
        const newCfg = await db.getAntinukeConfig(message.guild.id);
        return i.update({ embeds: [await buildStatusEmbed(message.guild, newCfg, wl, admins)], components: [buildSelectMenu()] });
      }
    });

    col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  }
};
