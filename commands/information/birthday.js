const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { warn, success, base, Colors } = require('../../utils/embeds');
const { resolveMember, resolveUser } = require('../../utils/resolve');
const { isOwner } = require('../../utils/owner');
const db = require('../../database/db');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ABBR = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function parseDate(input) {
  // Accepts: Jan 5, January 5, 1/5, 01/05, 2003-01-05, etc.
  if (!input) return null;
  input = input.trim();

  // ISO: YYYY-MM-DD
  let m = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { month: parseInt(m[2]), day: parseInt(m[3]), year: parseInt(m[1]) };

  // MM/DD or MM/DD/YYYY
  m = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) return { month: parseInt(m[1]), day: parseInt(m[2]), year: m[3] ? parseInt(m[3]) : null };

  // Month DD or Month DD YYYY
  m = input.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:(?:st|nd|rd|th))?(?:\s+(\d{2,4}))?$/i);
  if (m) {
    const monthStr = m[1].toLowerCase().slice(0, 3);
    const month = MONTH_ABBR[monthStr];
    if (!month) return null;
    return { month, day: parseInt(m[2]), year: m[3] ? parseInt(m[3]) : null };
  }

  return null;
}

function isValidDate(month, day, year) {
  if (month < 1 || month > 12) return false;
  const maxDay = new Date(year ?? 2000, month, 0).getDate();
  if (day < 1 || day > maxDay) return false;
  if (year && (year < 1900 || year > new Date().getFullYear())) return false;
  return true;
}

function formatBirthday(row) {
  const month = MONTHS[row.birth_month - 1];
  const day   = ordinal(row.birth_day);
  return row.birth_year ? `${month} ${day}, ${row.birth_year}` : `${month} ${day}`;
}

function daysUntilBirthday(month, day) {
  const now  = new Date();
  const next = new Date(now.getFullYear(), month - 1, day);
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  return Math.ceil((next - now) / 86400000);
}

const PER_PAGE = 15;

module.exports = {
  name: 'birthday',
  aliases: ['bday', 'bd'],
  category: 'information',

  run: async (client, message, args, prefix) => {
    await db.ensureGuild(message.guild.id, message.guild.name);
    const sub = args[0]?.toLowerCase();

    // ── birthday set <date> ──────────────────────────────────────
    if (sub === 'set') {
      const dateStr = args.slice(1).join(' ');
      if (!dateStr) return message.channel.send({ embeds: [warn(`${message.author}: Provide a date — e.g. \`${prefix}birthday set Jan 5\` or \`${prefix}birthday set 1/5/2003\``)] });

      const parsed = parseDate(dateStr);
      if (!parsed) return message.channel.send({ embeds: [warn(`${message.author}: Couldn't parse that date. Try \`Jan 5\`, \`1/5\`, or \`2003-01-05\``)] });

      const { month, day, year } = parsed;
      if (!isValidDate(month, day, year)) return message.channel.send({ embeds: [warn(`${message.author}: That date doesn't look valid`)] });

      await db.setBirthday(message.guild.id, message.author.id, month, day, year ?? null);

      const dateDisplay = year ? `${MONTHS[month-1]} ${ordinal(day)}, ${year}` : `${MONTHS[month-1]} ${ordinal(day)}`;
      return message.channel.send({ embeds: [success(`${message.author}: Birthday set to **${dateDisplay}** 🎂`)] });
    }

    // ── birthday config ──────────────────────────────────────────
    if (sub === 'config') {
      if (!message.member.permissions.has('ManageGuild'))
        return message.channel.send({ embeds: [warn(`${message.author}: You need **Manage Server** to configure birthdays`)] });

      const action = args[1]?.toLowerCase();
      const cfg = await db.getBirthdayConfig(message.guild.id);

      if (!action) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(Colors.info)
          .setTitle('🎂 Birthday Config')
          .addFields(
            { name: '📢 Channel',  value: cfg?.channel_id ? `<#${cfg.channel_id}>` : 'Not set', inline: true },
            { name: '🎭 Role',     value: cfg?.role_id    ? `<@&${cfg.role_id}>`   : 'Not set', inline: true },
            { name: '💬 Message',  value: cfg?.message    ?? 'Happy Birthday {user}! 🎂', inline: false },
          )
          .addFields({ name: '⚙️ Setup Commands', value: [
            `\`${prefix}birthday config channel #channel\` — set announcement channel`,
            `\`${prefix}birthday config role @role\` — set birthday role`,
            `\`${prefix}birthday config message <text>\` — set message (use {user} for mention)`,
          ].join('\n') })
          .setFooter({ text: `Birthdays are announced at midnight UTC` })
          .setTimestamp()] });
      }

      if (action === 'channel') {
        const channel = message.mentions.channels.first() ?? message.guild.channels.cache.get(args[2]);
        if (!channel) return message.channel.send({ embeds: [warn(`${message.author}: Mention or provide a channel`)] });
        await db.setBirthdayConfig(message.guild.id, 'channel_id', channel.id);
        return message.channel.send({ embeds: [success(`${message.author}: Birthday announcements will be sent in ${channel}`)] });
      }

      if (action === 'role') {
        const role = message.mentions.roles.first() ?? message.guild.roles.cache.get(args[2]);
        if (!role) return message.channel.send({ embeds: [warn(`${message.author}: Mention or provide a role`)] });
        await db.setBirthdayConfig(message.guild.id, 'role_id', role.id);
        return message.channel.send({ embeds: [success(`${message.author}: ${role} will be given to members on their birthday`)] });
      }

      if (action === 'message') {
        const msg = args.slice(2).join(' ');
        if (!msg) return message.channel.send({ embeds: [warn(`${message.author}: Provide a message. Use \`{user}\` for mention and \`{name}\` for username`)] });
        await db.setBirthdayConfig(message.guild.id, 'message', msg);
        return message.channel.send({ embeds: [success(`${message.author}: Birthday message set to:\n> ${msg}`)] });
      }

      return message.channel.send({ embeds: [warn(`${message.author}: Unknown config option. Try \`channel\`, \`role\`, or \`message\``)] });
    }

    // ── birthday role <@role> ─────────────────────────────────── (shortcut)
    if (sub === 'role') {
      if (!message.member.permissions.has('ManageGuild'))
        return message.channel.send({ embeds: [warn(`${message.author}: You need **Manage Server**`)] });
      const role = message.mentions.roles.first() ?? message.guild.roles.cache.get(args[1]);
      if (!role) return message.channel.send({ embeds: [warn(`${message.author}: Mention or provide a role`)] });
      await db.setBirthdayConfig(message.guild.id, 'role_id', role.id);
      return message.channel.send({ embeds: [success(`${message.author}: Birthday role set to ${role}`)] });
    }

    // ── birthday list ────────────────────────────────────────────
    if (sub === 'list') {
      const rows = await db.getBirthdayList(message.guild.id);
      if (!rows.length) return message.channel.send({ embeds: [base(Colors.neutral).setDescription(`📭 No birthdays set in this server`)] });

      const pages = Math.ceil(rows.length / PER_PAGE);
      let page = 0;

      function buildEmbed(p) {
        const slice = rows.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
        return new EmbedBuilder()
          .setColor(0xff69b4)
          .setAuthor({ name: `${message.guild.name} — Birthdays`, iconURL: message.guild.iconURL({ dynamic: true }) })
          .setDescription(slice.map((r, i) => {
            const n = p * PER_PAGE + i + 1;
            const days = daysUntilBirthday(r.birth_month, r.birth_day);
            return `\`${n}.\` <@${r.user_id}> — 🎂 **${formatBirthday(r)}** — *${days === 0 ? '🎉 Today!' : `in ${days}d`}*`;
          }).join('\n'))
          .setFooter({ text: `Page ${p+1}/${pages} • ${rows.length} birthdays` })
          .setTimestamp();
      }

      function buildRow(p) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bd_prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId('bd_page').setLabel(`${p+1}/${pages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('bd_next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(p === pages - 1),
        );
      }

      const msg = await message.channel.send({ embeds: [buildEmbed(page)], components: pages > 1 ? [buildRow(page)] : [] });
      if (pages <= 1) return;

      const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60_000 });
      col.on('collect', async i => {
        if (i.customId === 'bd_prev') page = Math.max(0, page - 1);
        if (i.customId === 'bd_next') page = Math.min(pages - 1, page + 1);
        await i.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
      });
      col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
      return;
    }

    // ── birthday <@member> or no arg = self ──────────────────────
    const target = message.mentions.members.first() ?? await resolveMember(message.guild, client, args[0])
      ?? message.member;

    const row = await db.getBirthday(message.guild.id, target.id);
    if (!row) {
      if (target.id === message.author.id) {
        return message.channel.send({ embeds: [base(Colors.neutral)
          .setDescription(`📭 You haven't set your birthday yet!\nUse \`${prefix}birthday set <date>\` — e.g. \`${prefix}birthday set Jan 5\``)
          .setFooter({ text: `Use ${prefix}birthday list to see all birthdays` })] });
      }
      return message.channel.send({ embeds: [base(Colors.neutral).setDescription(`📭 **${target.user.tag}** hasn't set their birthday`)] });
    }

    const days    = daysUntilBirthday(row.birth_month, row.birth_day);
    const age     = row.birth_year ? new Date().getFullYear() - row.birth_year + (days === 0 ? 0 : -1) : null;
    const nextAge = row.birth_year ? (age ?? 0) + (days === 0 ? 0 : 1) : null;

    const embed = new EmbedBuilder()
      .setColor(0xff69b4)
      .setAuthor({ name: `${target.user.tag}'s Birthday`, iconURL: target.user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: '🎂 Birthday',  value: formatBirthday(row), inline: true },
        { name: '📅 Countdown', value: days === 0 ? '🎉 **Today!**' : `${days} day${days !== 1 ? 's' : ''} away`, inline: true },
        ...(age !== null ? [{ name: '🎈 Age', value: days === 0 ? `Turning **${nextAge}** today!` : `Currently **${age}**`, inline: true }] : []),
      )
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Use ${prefix}birthday set <date> to set yours` })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }
};
