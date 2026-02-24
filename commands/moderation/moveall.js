const { PermissionFlagsBits } = require('discord.js');
const { missingPerm, base, Colors, success, warn } = require('../../utils/embeds');
const { isOwner } = require('../../utils/owner');

module.exports = {
  name: 'moveall',
  aliases: ['movemembers', 'moveall'],
  run: async (client, message, args, prefix) => {
    if (!message.member.permissions.has(PermissionFlagsBits.MoveMembers) && !isOwner(message.author.id))
      return message.channel.send({ embeds: [missingPerm(message.author, 'move_members')] });
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers))
      return message.channel.send({ embeds: [base(Colors.warn).setDescription(`⚠️ ${message.author}: I need **Move Members** permission`)] });

    const { guild, author } = message;

    // Accept: from VC ID and to VC ID in args, or use current VC
    const vcMentionPattern = /(\d{17,20})/g;
    const ids = [...message.content.matchAll(vcMentionPattern)].map(m => m[1]).filter(id => id !== guild.id);

    let fromVC = null, toVC = null;

    if (ids.length >= 2) {
      fromVC = guild.channels.cache.get(ids[0]);
      toVC   = guild.channels.cache.get(ids[1]);
    } else if (ids.length === 1) {
      fromVC = message.member.voice.channel;
      toVC   = guild.channels.cache.get(ids[0]);
    } else {
      fromVC = message.member.voice.channel;
    }

    if (!fromVC || !toVC) {
      return message.channel.send({ embeds: [base(Colors.neutral)
        .setTitle('🔊 Move All')
        .setDescription([
          `\`${prefix}moveall <from_vc_id> <to_vc_id>\` — move all members`,
          `\`${prefix}moveall <to_vc_id>\` — move from your current VC`,
          '',
          '**You can also** join the source VC and run:',
          `\`${prefix}moveall <to_vc_id>\``,
        ].join('\n'))] });
    }

    if (fromVC.type !== 2 && fromVC.type !== 13) // Voice or Stage
      return message.channel.send({ embeds: [warn(`${author}: \`${fromVC.name}\` is not a voice channel`)] });
    if (toVC.type !== 2 && toVC.type !== 13)
      return message.channel.send({ embeds: [warn(`${author}: \`${toVC.name}\` is not a voice channel`)] });
    if (fromVC.id === toVC.id)
      return message.channel.send({ embeds: [warn(`${author}: Source and destination cannot be the same channel`)] });

    const members = fromVC.members;
    if (!members.size) return message.channel.send({ embeds: [warn(`${author}: **${fromVC.name}** is empty`)] });

    let moved = 0, failed = 0;
    for (const [, m] of members) {
      const ok = await m.voice.setChannel(toVC, `Moveall by ${author.tag}`).then(() => true).catch(() => false);
      if (ok) moved++; else failed++;
    }

    return message.channel.send({ embeds: [base(Colors.voice)
      .setDescription([
        `✅ Moved **${moved}** member${moved !== 1 ? 's' : ''} from **${fromVC.name}** → **${toVC.name}**`,
        failed ? `❌ Failed to move **${failed}** member${failed !== 1 ? 's' : ''}` : '',
      ].filter(Boolean).join('\n'))] });
  }
};
