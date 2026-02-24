require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const db = require('./database/db');
const { isOwner, OWNER_ID, isNoPrefixEnabled } = require('./utils/owner');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
  ]
});

client.commands   = new Collection();
client.aliases    = new Collection();
client.prefixCmds = new Collection();
client.inviteCache = new Map();

// ── Spotify ───────────────────────────────────────────────────
if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
  client.spotify = new SpotifyClient(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET);
  console.log('🎵 Spotify integration enabled');
} else {
}

(async () => {
  console.log('🗄️  Connecting to database...');
  await db.migrate();
  await db.migrateV12plus().catch(e => console.warn('V12+ migrate warning:', e.message));

  console.log('📦 Loading handlers...');
  require('./handlers/commandHandler')(client);
  require('./handlers/eventHandler')(client);

  // ─────────────────────────────────────────────────────────────
  // GLOBAL MESSAGE LISTENER — runs before every other listener
  // Handles: blacklist block, AFK, anti-invite, message tracking
  // ─────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    if (message.partial) return;

    // ── Global blacklist — block instantly (owner is immune) ──
    if (!isOwner(message.author.id)) {
      const blocked = await db.isBlacklisted(message.author.id).catch(() => false);
      if (blocked) return; // silently ignore everything from blacklisted users
    }

    // Increment message tracking
    db.incrementMessageCount(message.guild.id, message.author.id).catch(() => {});

    // Ensure guild exists
    await db.ensureGuild(message.guild.id, message.guild.name).catch(() => {});
    const settings = await db.getSettings(message.guild.id).catch(() => null);

    // ── Anti-invite (owner bypasses) ──────────────────────────
    if (settings?.antiinvite && !isOwner(message.author.id) && !message.member?.permissions?.has('ManageMessages')) {
      const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9]+/i;
      if (inviteRegex.test(message.content)) {
        await message.delete().catch(() => {});
        return message.channel.send({
          embeds: [{ color: 0xefa23a, description: `⚠️ ${message.author}: Invite links are **not allowed** in this server` }]
        }).catch(() => {});
      }
    }

    // ── AFK return ────────────────────────────────────────────
    const afkData = await db.getAfk(message.guild.id, message.author.id).catch(() => null);
    if (afkData) {
      await db.clearAfk(message.guild.id, message.author.id).catch(() => {});
      const setAt = Math.floor(new Date(afkData.set_at).getTime() / 1000);
      message.channel.send({
        embeds: [{ color: 0xa3eb7b, description: `👋 ${message.author}: Welcome back! You were AFK since <t:${setAt}:R>` }]
      }).catch(() => {});
    }

    // ── AFK mention notify ────────────────────────────────────
    if (message.mentions.members?.size) {
      for (const [, member] of message.mentions.members) {
        if (member.id === message.author.id) continue;
        const mentionAfk = await db.getAfk(message.guild.id, member.id).catch(() => null);
        if (mentionAfk) {
          const setAt = Math.floor(new Date(mentionAfk.set_at).getTime() / 1000);
          message.channel.send({
            embeds: [{ color: 0x6495ed, description: `💤 **${member.user.tag}** is AFK: ${mentionAfk.message}\n> Set <t:${setAt}:R>` }]
          }).catch(() => {});
          break;
        }
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // STICKY MESSAGE REPOST LISTENER
  // ─────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    if (message.partial) return;

    const sticky = await db.getStickyMessage(message.guild.id, message.channel.id).catch(() => null);
    if (!sticky) return;
    if (sticky.last_msg_id) {
      message.channel.messages.fetch(sticky.last_msg_id).then(m => m.delete()).catch(() => {});
    }
    const sent = await message.channel.send(`📌 ${sticky.message}`).catch(() => null);
    if (sent) await db.updateStickyLastMsg(message.guild.id, message.channel.id, sent.id).catch(() => {});
  });

  // ─────────────────────────────────────────────────────────────
  // AUTORESPONDER LISTENER
  // ─────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    if (message.partial) return;

    // Owner bypasses ignore list — regular users don't
    if (!isOwner(message.author.id)) {
      const ignored = await db.isIgnored(message.guild.id, message.author.id, message.channel.id).catch(() => false);
      if (ignored) return;
    }

    const guildPrefix = await db.getPrefix(message.guild.id).catch(() => ',');
    const ar = await db.matchAutoresponder(message.guild.id, message.content).catch(() => null);
    if (!ar) return;
    if (!ar.ignore_command_check && message.content.startsWith(guildPrefix)) return;

    const { applyVars } = require('./commands/configuration/autoresponder');
    const response = applyVars(ar.response, message, ar.trigger);
    if (ar.delete_trigger) message.delete().catch(() => {});
    const sent = await message.channel.send(response).catch(() => null);
    if (sent && ar.self_destruct) {
      setTimeout(() => sent.delete().catch(() => {}), ar.self_destruct * 1000);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // PREFIX COMMAND HANDLER — with full owner perks
  // ─────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    if (message.partial) return;

    // ── Global blacklist — silently block ─────────────────────
    if (!isOwner(message.author.id)) {
      const blocked = await db.isBlacklisted(message.author.id).catch(() => false);
      if (blocked) return;
    }

    await db.ensureGuild(message.guild.id, message.guild.name).catch(() => {});
    const guildPrefix    = await db.getPrefix(message.guild.id).catch(() => ',');
    const personalPrefix = await db.getUserPrefix(message.guild.id, message.author.id).catch(() => null);
    const prefix         = personalPrefix ?? guildPrefix;

    // ── Mention → show prefix ─────────────────────────────────
    if (new RegExp(`^<@!?${client.user.id}>$`).test(message.content.trim())) {
      return message.channel.send({
        embeds: [{ color: 0x6495ed, description: `${message.author}: Guild prefix: \`${prefix}\`` }]
      });
    }

    // ═══════════════════════════════════════════════════════════
    // OWNER PERK: NO PREFIX — detect command without any prefix
    // If the author is the owner and message doesn't start with
    // the prefix, try parsing it as a bare command anyway.
    // ═══════════════════════════════════════════════════════════
    let args, cmd;
    // Check if user has a DB-granted no-prefix (non-owner users granted by owner)
    const dbNoPrefix = !isOwner(message.author.id) && await db.isNoprefixUser(message.author.id).catch(() => false);
    const ownerMode  = (
      (isOwner(message.author.id) && isNoPrefixEnabled() && !message.content.startsWith(prefix)) ||
      (dbNoPrefix && !message.content.startsWith(prefix))
    );

    if (ownerMode) {
      // Only fire if the first word matches a real command or alias
      const rawArgs    = message.content.trim().split(/ +/g);
      const rawCmd     = rawArgs[0]?.toLowerCase();
      const maybeCmd   = client.prefixCmds.get(rawCmd) ?? client.prefixCmds.get(client.aliases.get(rawCmd));
      if (!maybeCmd) return; // not a command — ignore
      args = rawArgs.slice(1);
      cmd  = rawCmd;
    } else {
      if (!message.content.startsWith(prefix)) return;
      args = message.content.slice(prefix.length).trim().split(/ +/g);
      cmd  = args.shift().toLowerCase();
      if (!cmd) return;
    }

    // ── Ignore list check (owner bypasses) ───────────────────
    if (!isOwner(message.author.id)) {
      const isIgnoredEntity = await db.isIgnored(message.guild.id, message.author.id, message.channel.id).catch(() => false);
      if (isIgnoredEntity) return;
    }

    // ── Resolve command → built-in → guild alias ──────────────
    let command = client.prefixCmds.get(cmd) ?? client.prefixCmds.get(client.aliases.get(cmd));
    if (!command) {
      const guildAlias = await db.getAlias(message.guild.id, cmd).catch(() => null);
      if (guildAlias) command = client.prefixCmds.get(guildAlias.command);
    }
    if (!command) return;

    // ── Module disabled? (owner bypasses) ────────────────────
    if (!isOwner(message.author.id)) {
      const cmdCategory = command.category ?? null;
      if (cmdCategory) {
        const modDisabled = await db.isModuleDisabled(message.guild.id, cmdCategory).catch(() => false);
        if (modDisabled) {
          return message.channel.send({ embeds: [{ color: 0xfee75c, description: `⚠️ ${message.author}: The \`${cmdCategory}\` module is **disabled** in this server` }] }).catch(() => {});
        }
      }
    }

    // ── Command disabled? (owner bypasses) ───────────────────
    if (!isOwner(message.author.id)) {
      const isDisabled = await db.isCommandDisabled(message.guild.id, command.name, message.channel.id).catch(() => false);
      if (isDisabled) {
        return message.channel.send({ embeds: [{ color: 0xfee75c, description: `⚠️ ${message.author}: The \`${command.name}\` command is **disabled** in this server` }] }).catch(() => {});
      }
    }

    // ── Execute ───────────────────────────────────────────────
    try {
      await command.run(client, message, args, ownerMode ? prefix : prefix);
    } catch (err) {
      console.error(`❌ Command error [${cmd}]:`, err);
      message.reply({ content: 'Something went wrong executing that command.' }).catch(() => {});
    }
  });

  // ── Edit snipe ────────────────────────────────────────────────
  client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.partial || newMsg.partial) return;
    if (oldMsg.content === newMsg.content) return;
    db.setEditSnipe(
      oldMsg.channel.id,
      oldMsg.content ?? '',
      newMsg.content ?? '',
      oldMsg.author.tag,
      oldMsg.author.displayAvatarURL({ dynamic: true }),
      newMsg.url
    ).catch(() => {});
  });

  // ── Slash command interactions ────────────────────────────────
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command?.execute) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`❌ Slash [${interaction.commandName}]:`, err);
      const m = { content: 'Something went wrong.', ephemeral: true };
      interaction.replied || interaction.deferred
        ? interaction.followUp(m).catch(() => {})
        : interaction.reply(m).catch(() => {});
    }
  });

  await client.login(process.env.TOKEN);
})().catch(err => { console.error('Fatal:', err); process.exit(1); });

client.on('error', err => console.error('Client error:', err));
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
