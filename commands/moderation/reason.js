const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'reason',
  aliases: ['updatereason', 'editreason'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'moderate_members')] });

    const caseId = parseInt(args[0]);
    if (!caseId || isNaN(caseId)) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${message.author}: Usage: \`${prefix}reason <case_id> <new reason>\``)] });

    const newReason = args.slice(1).join(' ');
    if (!newReason) return message.channel.send({ embeds: [base(Colors.warn)
      .setDescription(`⚠️ ${message.author}: Provide a new reason — \`${prefix}reason ${caseId} <reason>\``)] });

    const infraction = await db.getInfractionById(caseId).catch(() => null);
    if (!infraction) return message.channel.send({ embeds: [warn(`${message.author}: Case \`#${caseId}\` not found`)] });
    if (infraction.guild_id !== message.guild.id)
      return message.channel.send({ embeds: [warn(`${message.author}: That case doesn't belong to this server`)] });

    const updated = await db.updateInfractionReason(caseId, newReason);
    if (!updated) return message.channel.send({ embeds: [warn(`${message.author}: Failed to update case \`#${caseId}\``)] });

    return message.channel.send({ embeds: [base(Colors.mod)
      .setTitle(`✅ Case #${caseId} Updated`)
      .addFields(
        { name: 'Type',       value: `\`${infraction.type}\``,            inline: true },
        { name: 'User',       value: `<@${infraction.target_user_id}>`,   inline: true },
        { name: 'Mod',        value: `<@${infraction.mod_user_id}>`,      inline: true },
        { name: 'Old Reason', value: infraction.reason ?? 'None' },
        { name: 'New Reason', value: newReason },
      )] });
  }
};
