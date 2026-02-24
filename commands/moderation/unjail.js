const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, cmdHelp, base, Colors, success, warn } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'unjail',
  aliases: ['uj'],

  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'manage_messages')] });

    if (!args[0]) return message.channel.send({ embeds: [cmdHelp({
      author: message.author, name: 'unjail', description: 'Releases a jailed member and restores all their previous roles',
      aliases: ['uj'], parameters: 'member', info: '⚠️ Manage Messages',
      usage: 'unjail (member)', example: 'unjail @user', module: 'moderation'
    })] });

    const member = message.mentions.members.first()
      ?? await message.guild.members.fetch(args[0]).catch(() => null);
    if (!member) return message.channel.send({ embeds: [warn(`${message.author}: **Invalid member** — mention them or provide their ID`)] });

    const jailData = await db.getJailedMember(message.guild.id, member.id);
    if (!jailData) return message.channel.send({ embeds: [warn(`${message.author}: **${member.user.tag}** is not currently jailed`)] });

    const cfg = await db.getJailConfig(message.guild.id);

    // Mark as unjailed in DB and retrieve saved roles
    const prevRolesJson = await db.unjailMember(message.guild.id, member.id);
    const prevRoleIds   = prevRolesJson ? JSON.parse(prevRolesJson) : [];

    // Build the list of roles to restore
    // We deliberately do NOT check role.manageable — we attempt to add all of them
    // and let Discord silently ignore ones it cannot assign (e.g. above bot's top role).
    // This is correct behaviour — we still restore everything we can.
    const rolesToRestore = prevRoleIds
      .map(id => message.guild.roles.cache.get(id))
      .filter(r => r && r.id !== message.guild.id); // exclude @everyone

    // Use roles.set() to atomically replace all current roles with the restored set.
    // This removes the jail role AND adds back all previous roles in one API call,
    // which is far more reliable than remove + individual adds.
    let restored = 0;
    try {
      await member.roles.set(rolesToRestore, `[Unjail] by ${message.author.tag}`);
      restored = rolesToRestore.length;
    } catch {
      // Fallback: if set() fails (e.g. role above bot), remove jail role then add individually
      if (cfg?.jail_role_id) {
        const jailRole = message.guild.roles.cache.get(cfg.jail_role_id);
        if (jailRole) await member.roles.remove(jailRole).catch(() => {});
      }
      for (const role of rolesToRestore) {
        const added = await member.roles.add(role).then(() => true).catch(() => false);
        if (added) restored++;
      }
    }

    // DM the released member
    member.user.send({ embeds: [base(Colors.success)
      .setDescription(`🔓 You have been **unjailed** in **${message.guild.name}**\n> Released by **${message.author.tag}**`)
    ]}).catch(() => {});

    return message.channel.send({ embeds: [success(
      `${message.author}: **${member.user.tag}** has been unjailed — restored **${restored}** role${restored !== 1 ? 's' : ''}`
    )] });
  }
};
