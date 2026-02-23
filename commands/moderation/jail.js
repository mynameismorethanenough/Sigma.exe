const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, botMissingPerm, cmdHelp, base, Colors, E, success, warn } = require('../../utils/embeds');

function parseDuration(str) {
  const match = str?.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;
  const u = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return parseInt(match[1]) * u[match[2].toLowerCase()];
}

function formatDuration(ms) {
  if (!ms) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ');
}

module.exports = {
  name: 'jail',
  aliases: ['j'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
      return message.channel.send({ embeds: [botMissingPerm(message.author, 'manage_roles')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({
      author: message.author, name: 'jail', description: 'Jails a member — removes all roles and adds jailed role',
      aliases: ['j'], parameters: 'member, duration, reason', info: '⚠️ Manage Messages',
      usage: 'jail (member) <duration> <reason>', example: 'jail @user 1h Posting nsfw', module: 'moderation'
    })] });

    // Setup check
    const cfg = await db.getJailConfig(message.guild.id);
    if (!cfg?.jail_role_id) {
      return message.channel.send({ embeds: [base(Colors.warn)
        .setTitle('⚙️ Jail Not Configured')
        .setDescription(`You haven't set up the jail system yet!\nRun \`${prefix}jailsetup\` to get started.`)] });
    }

    const jailRole = message.guild.roles.cache.get(cfg.jail_role_id);
    if (!jailRole) return message.channel.send({ embeds: [warn(`${message.author}: Jail role not found — run \`${prefix}jailsetup\` again`)] });

    const member = message.mentions.members.first() ?? message.guild.members.cache.get(args[0]);
    if (!member) return message.channel.send({ embeds: [warn(`${message.author}: **Invalid member**`)] });
    if (member.id === message.author.id) return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot jail **yourself**`)] });
    if (!member.manageable) return message.channel.send({ embeds: [warn(`${message.author}: I cannot manage that member (hierarchy)`)] });
    if (message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0)
      return message.channel.send({ embeds: [base(Colors.error).setDescription(`${E.deny} ${message.author}: You cannot jail someone **higher** than you`)] });

    // Already jailed?
    const existing = await db.getJailedMember(message.guild.id, member.id);
    if (existing) return message.channel.send({ embeds: [warn(`${message.author}: **${member.user.tag}** is already jailed`)] });

    // Parse duration (optional)
    let durMs = null, durStr = null;
    if (args[1] && parseDuration(args[1]) !== null) {
      durMs = parseDuration(args[1]);
      durStr = formatDuration(durMs);
    }

    const reasonStart = (args[1] && parseDuration(args[1]) !== null) ? 2 : 1;
    const reason = args.slice(reasonStart).join(' ') || 'No reason provided';

    // Save roles (excluding @everyone and the jail role itself)
    const prevRoles = member.roles.cache
      .filter(r => r.id !== message.guild.id && r.id !== jailRole.id)
      .map(r => r.id);

    // Atomically swap ALL roles for just the jail role.
    // Using roles.set() is more reliable than roles.remove() + roles.add() separately.
    try {
      await member.roles.set([jailRole], `[Jail] ${reason}`);
    } catch (err) {
      return message.channel.send({ embeds: [warn(`${message.author}: Failed to jail member — ${err.message}`)] });
    }

    const expiresAt = durMs ? new Date(Date.now() + durMs) : null;
    await db.jailMember(message.guild.id, member.id, message.author.id, reason, JSON.stringify(prevRoles), expiresAt);
    await db.addInfraction({ guildId: message.guild.id, targetUserId: member.id, modUserId: message.author.id, type: 'jail', reason }).catch(() => {});

    // DM user
    member.user.send({ embeds: [base(Colors.jail)
      .setTitle('🔒 You have been jailed')
      .addFields(
        { name: '**Server**',    value: message.guild.name, inline: true },
        { name: '**Moderator**', value: message.author.tag,  inline: true },
        { name: '**Duration**',  value: durStr ?? 'Indefinite', inline: true },
        { name: '**Reason**',    value: reason }
      )
      .setFooter({ text: 'Contact a staff member to appeal.' })]
    }).catch(() => {});

    // Log to jail channel if set
    if (cfg.jail_channel_id) {
      const jailCh = message.guild.channels.cache.get(cfg.jail_channel_id);
      jailCh?.send({ content: `${member}`, embeds: [base(Colors.jail)
        .setDescription(`🔒 You've been jailed, ${member}. Please wait for a staff member.\n**Reason:** ${reason}`)
      ]}).catch(() => {});
    }

    const embed = base(Colors.jail)
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTitle('🔒 Member Jailed')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '**Member**',    value: `${member} \`(${member.id})\``, inline: true },
        { name: '**Moderator**', value: `${message.author}`, inline: true },
        { name: '**Duration**',  value: durStr ?? 'Indefinite', inline: true },
        { name: '**Reason**',    value: reason }
      )
      .setFooter({ text: `Use ${prefix}unjail @user to release` });

    return message.channel.send({ embeds: [embed] });
  }
};
