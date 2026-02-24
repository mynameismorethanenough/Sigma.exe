const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { warn, success, base, Colors } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');
const db = require('../../database/db');

// Common timezone aliases → IANA names
const TZ_ALIASES = {
  'ist':  'Asia/Kolkata',
  'est':  'America/New_York',
  'edt':  'America/New_York',
  'cst':  'America/Chicago',
  'cdt':  'America/Chicago',
  'mst':  'America/Denver',
  'mdt':  'America/Denver',
  'pst':  'America/Los_Angeles',
  'pdt':  'America/Los_Angeles',
  'gmt':  'Europe/London',
  'utc':  'UTC',
  'bst':  'Europe/London',
  'cet':  'Europe/Paris',
  'cest': 'Europe/Paris',
  'aest': 'Australia/Sydney',
  'aedt': 'Australia/Sydney',
  'jst':  'Asia/Tokyo',
  'kst':  'Asia/Seoul',
  'hkt':  'Asia/Hong_Kong',
  'sgt':  'Asia/Singapore',
  'msk':  'Europe/Moscow',
  'brt':  'America/Sao_Paulo',
  'eet':  'Europe/Helsinki',
  'wat':  'Africa/Lagos',
  'eat':  'Africa/Nairobi',
  'ast':  'America/Halifax',
  'nst':  'America/St_Johns',
  'akst': 'America/Anchorage',
  'hst':  'Pacific/Honolulu',
  'nzst': 'Pacific/Auckland',
  'nzdt': 'Pacific/Auckland',
  'wib':  'Asia/Jakarta',
  'wita': 'Asia/Makassar',
  'wit':  'Asia/Jayapura',
  'india': 'Asia/Kolkata',
  'uk':   'Europe/London',
  'us/eastern':  'America/New_York',
  'us/central':  'America/Chicago',
  'us/mountain': 'America/Denver',
  'us/pacific':  'America/Los_Angeles',
};

// Popular/common timezones to show in list
const POPULAR_TZ = [
  { zone: 'Pacific/Honolulu',    label: '🌺 Hawaii (HST, UTC-10)' },
  { zone: 'America/Anchorage',   label: '🐻 Alaska (AKST, UTC-9)' },
  { zone: 'America/Los_Angeles', label: '🌉 US Pacific (PST, UTC-8)' },
  { zone: 'America/Denver',      label: '🏔️ US Mountain (MST, UTC-7)' },
  { zone: 'America/Chicago',     label: '🌽 US Central (CST, UTC-6)' },
  { zone: 'America/New_York',    label: '🗽 US Eastern (EST, UTC-5)' },
  { zone: 'America/Halifax',     label: '🍁 Atlantic (AST, UTC-4)' },
  { zone: 'America/St_Johns',    label: '🐟 Newfoundland (NST, UTC-3:30)' },
  { zone: 'America/Sao_Paulo',   label: '🌎 Brazil (BRT, UTC-3)' },
  { zone: 'Europe/London',       label: '🇬🇧 UK (GMT/BST, UTC+0/+1)' },
  { zone: 'Europe/Paris',        label: '🇫🇷 Central Europe (CET, UTC+1)' },
  { zone: 'Europe/Helsinki',     label: '🇫🇮 Eastern Europe (EET, UTC+2)' },
  { zone: 'Europe/Moscow',       label: '🇷🇺 Moscow (MSK, UTC+3)' },
  { zone: 'Asia/Dubai',          label: '🇦🇪 Gulf (GST, UTC+4)' },
  { zone: 'Asia/Kolkata',        label: '🇮🇳 India (IST, UTC+5:30)' },
  { zone: 'Asia/Dhaka',          label: '🇧🇩 Bangladesh (BST, UTC+6)' },
  { zone: 'Asia/Bangkok',        label: '🇹🇭 Indochina (ICT, UTC+7)' },
  { zone: 'Asia/Singapore',      label: '🇸🇬 Singapore (SGT, UTC+8)' },
  { zone: 'Asia/Tokyo',          label: '🇯🇵 Japan (JST, UTC+9)' },
  { zone: 'Australia/Sydney',    label: '🇦🇺 AEST (UTC+10/+11)' },
  { zone: 'Pacific/Auckland',    label: '🇳🇿 New Zealand (NZST, UTC+12/+13)' },
];

function resolveTimezone(input) {
  const lower = input.toLowerCase().trim();
  // Check alias map first
  if (TZ_ALIASES[lower]) return TZ_ALIASES[lower];
  // Try to validate as IANA directly
  try {
    Intl.DateTimeFormat(undefined, { timeZone: input });
    return input;
  } catch { return null; }
}

function formatTime(zone) {
  try {
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = now.toLocaleDateString('en-GB', { timeZone: zone, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const offsetMin = -now.getTimezoneOffset();
    // Get actual offset for this tz
    const sample = new Date().toLocaleString('en-US', { timeZone: zone, timeZoneName: 'shortOffset' });
    const offMatch = sample.match(/GMT([+-]\d+(?::\d+)?)/);
    const offset = offMatch ? offMatch[0] : 'UTC';
    return { time, date, offset };
  } catch { return null; }
}

const PER_PAGE = 10;

module.exports = {
  name: 'timezone',
  aliases: ['tz', 'time'],
  category: 'information',

  run: async (client, message, args, prefix) => {
    const sub = args[0]?.toLowerCase();

    // ── timezone set <location> ──────────────────────────────────
    if (sub === 'set') {
      const input = args.slice(1).join(' ');
      if (!input) return message.channel.send({ embeds: [warn(`${message.author}: Provide a timezone — e.g. \`${prefix}timezone set IST\` or \`${prefix}timezone set America/New_York\``)] });

      const zone = resolveTimezone(input);
      if (!zone) return message.channel.send({ embeds: [warn(`${message.author}: Unknown timezone \`${input}\`\nUse \`${prefix}timezone list\` to see valid options, or use IANA format like \`America/New_York\``)] });

      await db.setTimezone(message.author.id, zone);
      const fmt = formatTime(zone);

      return message.channel.send({ embeds: [success(`${message.author}: Timezone set to **${zone}**${fmt ? `\n🕐 Current time: **${fmt.time}** (${fmt.offset})` : ''}`)] });
    }

    // ── timezone list ────────────────────────────────────────────
    if (sub === 'list') {
      const pages = Math.ceil(POPULAR_TZ.length / PER_PAGE);
      let page = 0;

      function buildEmbed(p) {
        const slice = POPULAR_TZ.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
        const now = new Date();
        return new EmbedBuilder()
          .setColor(Colors.info)
          .setTitle('🌍 Common Timezones')
          .setDescription(slice.map(t => {
            const fmt = formatTime(t.zone);
            return `**${t.label}**\n> \`${t.zone}\` — \`${fmt?.time ?? 'N/A'}\``;
          }).join('\n\n'))
          .addFields({ name: '💡 Usage', value: `\`${prefix}timezone set <zone>\` — e.g. \`${prefix}timezone set IST\`\nAlso accepts: \`IST\` \`UTC\` \`EST\` \`PST\` \`GMT\` etc.` })
          .setFooter({ text: `Page ${p+1}/${pages} • Times as of right now` })
          .setTimestamp();
      }

      function buildRow(p) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('tz_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId('tz_page').setLabel(`${p+1}/${pages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('tz_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(p === pages - 1),
        );
      }

      const msg = await message.channel.send({ embeds: [buildEmbed(page)], components: pages > 1 ? [buildRow(page)] : [] });
      if (pages <= 1) return;

      const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60_000 });
      col.on('collect', async i => {
        if (i.customId === 'tz_prev') page = Math.max(0, page - 1);
        if (i.customId === 'tz_next') page = Math.min(pages - 1, page + 1);
        await i.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
      });
      col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
      return;
    }

    // ── timezone <@member> or no arg = self ──────────────────────
    const target = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0])
      ?? message.member;

    const row = await db.getTimezone(target.id);
    if (!row) {
      if (target.id === message.author.id) {
        return message.channel.send({ embeds: [base(Colors.neutral)
          .setDescription(`📭 You haven't set your timezone yet!\nUse \`${prefix}timezone set <zone>\` — e.g. \`${prefix}timezone set IST\`\nSee \`${prefix}timezone list\` for options`)] });
      }
      return message.channel.send({ embeds: [base(Colors.neutral).setDescription(`📭 **${target.user.tag}** hasn't set their timezone`)] });
    }

    const fmt = formatTime(row.timezone);
    if (!fmt) return message.channel.send({ embeds: [warn(`${message.author}: Stored timezone \`${row.timezone}\` is invalid`)] });

    return message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(Colors.info)
      .setAuthor({ name: `${target.user.tag}'s Timezone`, iconURL: target.user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: '🌍 Timezone',  value: `\`${row.timezone}\``, inline: true },
        { name: '🕐 Time',      value: `**${fmt.time}**`,     inline: true },
        { name: '📅 Date',      value: fmt.date,              inline: true },
        { name: '📡 Offset',    value: fmt.offset,            inline: true },
      )
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Use ${prefix}timezone set <zone> to set yours` })
      .setTimestamp()] });
  }
};
