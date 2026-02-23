/**
 * help — Paginated help panel with per-module pages
 * Main menu: dropdown to pick category
 * Per category: pages with ◀️ 🏠 ▶️ ❌ buttons
 * Footer: "Page X/X • N commands in Category"
 */
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { Colors } = require('../../utils/embeds');
const { OWNER_ID } = require('../../utils/owner');

const ACCENT   = 0xf5c518;
const MOD_COL  = 0xe74c3c;
const CFG_COL  = 0x3498db;
const SEC_COL  = 0xff6b35;
const INFO_COL = 0x5865f2;
const UTIL_COL = 0x36393f;
const FUN_COL  = 0xe91e63;
const RP_COL   = 0xff6b9d;
const SRV_COL  = 0x2ecc71;

// ── Page definitions ───────────────────────────────────────────
// Each entry: { title, color, cmds: [ [name, desc], ... ] }
function buildPages(p) {
  return {
    moderation: [
      { title: 'Ban Commands', color: MOD_COL, cmds: [
        ['ban @user [reason]',       'Ban a member from the server'],
        ['tempban @user <dur> [rsn]','Temporarily ban (auto-unbans after duration)'],
        ['softban @user [reason]',   'Ban + immediate unban to purge messages'],
        ['hackban <id> [reason]',    'Ban a user by ID without them being in server'],
      ]},
      { title: 'Hardban & Unban Commands', color: MOD_COL, cmds: [
        ['hardban @user/id [rsn]',   'Permanent ban — user is re-banned on rejoin'],
        ['hardban list [page]',      'View all hardbanned users'],
        ['hardban remove <id>',      'Remove user from hardban list'],
        ['unban <id>',               'Unban a user by ID'],
        ['unbanall',                 'Unban all users in the ban list'],
        ['unbanall cancel',          'Cancel an in-progress unban all task'],
      ]},
      { title: 'Mute Commands', color: MOD_COL, cmds: [
        ['mute @user [reason]',      'Mute a member using the muted role'],
        ['unmute @user',             'Remove mute from a member'],
        ['imute @user [reason]',     'Image-mute: removes Attach Files & Embed Links'],
        ['iunmute @user',            'Remove image-mute (restores file/link perms)'],
        ['rmute @user [reason]',     'Reaction-mute: removes Reactions, Ext Emojis & Stickers'],
        ['runmute @user',            'Remove reaction-mute'],
      ]},
      { title: 'Timeout Commands', color: MOD_COL, cmds: [
        ['timeout @user <dur> [rsn]','Apply Discord native timeout (max 28d)'],
        ['timeout list',             'List all currently timed-out members'],
        ['untimeout @user',          'Remove a timeout from a member'],
      ]},
      { title: 'Warn & Case Commands', color: MOD_COL, cmds: [
        ['warn @user [reason]',       'Issue a warning to a member'],
        ['warnings @user',            'List all warnings for a user'],
        ['reason <id> <reason>',      'Update the reason on a case log'],
        ['history @user',             'View full moderation history for a user'],
        ['history view <id>',         'View details of a specific case'],
        ['history remove <id>',       'Delete a specific case'],
        ['history remove all @user',  'Delete all cases for a user'],
        ['cases @user',               'Quick case list (alias: history)'],
        ['modstats [@mod]',           'View moderation action stats for a mod'],
      ]},
      { title: 'Jail Commands', color: MOD_COL, cmds: [
        ['jailsetup',                 'Setup/configure the jail system'],
        ['jail @user [dur] [reason]', 'Jail a member (removes roles, adds jail role)'],
        ['unjail @user',              'Release a jailed member (restores roles)'],
        ['jaillist',                  'List all currently jailed members'],
      ]},
      { title: 'Lockdown Commands', color: MOD_COL, cmds: [
        ['lockdown [#ch]',            'Lock a channel (default: current)'],
        ['lockdown all [reason]',     'Lock ALL text channels (skips ignore list)'],
        ['lockdown role @role [#ch]', 'Lock a channel for a specific role'],
        ['lockdown ignore add #ch',   'Add channel to lockdown ignore list'],
        ['lockdown ignore remove #ch','Remove channel from ignore list'],
        ['lockdown ignore list',      'View ignored channels'],
        ['unlock [#ch]',              'Unlock a channel (default: current)'],
        ['unlock all',                'Unlock all channels (skips ignore list)'],
      ]},
      { title: 'Kick & Member Tools', color: MOD_COL, cmds: [
        ['kick @user [reason]',   'Kick a member from the server'],
        ['moveall <from> <to>',   'Move all members from one VC to another'],
        ['stripstaff @user',      'Remove all dangerous-permission roles from a member'],
        ['rename @user <nick>',   'Change a member\'s nickname'],
        ['role @user @role',      'Add a role to a member'],
        ['roleremove @user @role','Remove a role from a member'],
        ['rolecreate',            'Create a new role'],
      ]},
      { title: 'Channel & Purge Commands', color: MOD_COL, cmds: [
        ['purge <n>',             'Delete last N messages (max 100)'],
        ['purgeuser @user <n>',   'Delete N messages from a specific user'],
        ['botclear',              'Remove bot messages from channel'],
      ]},
    ],

    configuration: [
      { title: 'Prefix & Settings Commands', color: CFG_COL, cmds: [
        ['prefix',                    'Show the current prefix'],
        ['prefix set <pfx>',          'Change the server prefix'],
        ['prefix remove',             'Reset prefix to default (,)'],
        ['settings',                  'View full server configuration overview'],
        ['settings modlog #ch',       'Set/clear the mod log channel'],
        ['settings staff @role',      'Add/remove a staff role'],
        ['settings muted @role',      'Set the muted role for ,mute'],
        ['settings rmuted @role',     'Set the reaction-muted role for ,rmute'],
        ['settings imuted @role',     'Set the image-muted role for ,imute'],
        ['settings autonick <fmt>',   'Set auto-nickname format for new members'],
        ['settings jailmsg <msg>',    'Set custom jail notification message'],
      ]},
      { title: 'Welcome & Join Commands', color: CFG_COL, cmds: [
        ['welcome add #ch <msg>',   'Add a welcome message to a channel'],
        ['welcome remove #ch',      'Remove welcome from a channel'],
        ['welcome view #ch',        'View welcome config for a channel'],
        ['welcome list',            'List all welcome channels'],
        ['welcome variables',       'List available message variables'],
        ['welcome test [#ch]',      'Send a test welcome message'],
        ['autorole',                'Set/remove the auto-assigned role on join'],
        ['joindm',                  'Set/clear the join DM message'],
        ['antiinvite',              'Toggle blocking of Discord invite links'],
      ]},
      { title: 'Autoresponder & Aliases', color: CFG_COL, cmds: [
        ['autoresponder add <trigger>, <resp>', 'Create an autoresponder trigger'],
        ['autoresponder remove <trigger>',      'Remove an autoresponder'],
        ['autoresponder list',                  'List all autoresponders'],
        ['autoresponder variables',             'List available message variables'],
        ['alias add <shortcut> <cmd>',          'Create a command shortcut alias'],
        ['alias remove <shortcut>',             'Remove an alias'],
        ['alias removeall <cmd>',               'Remove all aliases for a command'],
        ['alias list',                          'List all aliases'],
      ]},
      { title: 'Module & Command Control', color: CFG_COL, cmds: [
        ['disablecommand all <cmd>',      'Disable a command server-wide'],
        ['disablecommand #ch <cmd>',      'Disable a command in a channel'],
        ['enablecommand all <cmd>',       'Re-enable a command server-wide'],
        ['disablemodule all <module>',    'Disable an entire module'],
        ['enablemodule all <module>',     'Re-enable a module'],
        ['disablemodule list',            'List disabled modules'],
        ['copydisabled #src #dst',        'Copy disabled commands from one channel to another'],
        ['ignore add @user/#ch',          'Add to the command ignore list'],
        ['ignore remove @user/#ch',       'Remove from the command ignore list'],
        ['ignore list',                   'View the ignore list'],
        ['stickymessage add #ch <msg>',   'Add a sticky message to a channel'],
        ['stickymessage remove #ch',      'Remove a sticky message'],
      ]},
      { title: 'Fake Permissions & Boosts', color: CFG_COL, cmds: [
        ['fakepermissions list',            'View all fake permission overrides'],
        ['fakepermissions add @role <perm>','Grant a fake permission to a role/user'],
        ['fakepermissions remove @role <p>','Remove a fake permission override'],
        ['fakepermissions reset',           'Clear ALL fake permission overrides'],
        ['fakepermissions reset @role',     'Clear overrides for one role/user'],
        ['boosts add #ch <msg>',            'Add a boost message to a channel'],
        ['boosts view #ch',                 'View boost message config'],
        ['boosts list',                     'List all boost message channels'],
        ['boosts remove #ch',               'Remove a boost message'],
        ['boosts variables',                'List boost message variables'],
      ]},
    ],

    serversetup: [
      { title: 'Server Appearance Commands', color: SRV_COL, cmds: [
        ['seticon <url/attach>',      'Change the server icon via URL or attachment'],
        ['setbanner <url/attach>',    'Change the server banner (requires Level 2)'],
        ['setbanner clear',           'Remove the current server banner'],
        ['customize activity <t> <text>', 'Set bot activity: playing/watching/listening/competing'],
        ['customize activity clear',      'Clear the bot\'s current activity'],
        ['customize status <text>',       'Set bot\'s profile status/About Me'],
        ['customize bio <text>',          'Set a server-specific bot bio'],
        ['customize avatar <url>',        'Change the bot\'s avatar globally'],
        ['customize banner <url>',        'Change the bot\'s banner globally'],
      ]},
      { title: 'Booster Role Commands', color: SRV_COL, cmds: [
        ['boosterrole setup',          'Enable the booster role system (admin — run first)'],
        ['boosterrole disable',        'Disable the booster role system'],
        ['boosterrole create',         'Create your custom booster role (boosters only)'],
        ['boosterrole rename <n>',     'Rename your booster role'],
        ['boosterrole color #hex',     'Set your booster role color'],
        ['boosterrole icon <emoji/url>','Set your booster role icon (Level 2 required)'],
        ['boosterrole share @user',    'Share your role with another member'],
        ['boosterrole share remove @u','Remove a share'],
        ['boosterrole share max <n>',  'Set max shares per booster (admin)'],
        ['boosterrole delete',         'Delete your booster role'],
        ['boosterrole cleanup',        'Remove all ex-booster roles (admin)'],
      ]},
      { title: 'Server Configuration Commands', color: SRV_COL, cmds: [
        ['jailsetup create',      'Auto-create jail role + channel'],
        ['jailsetup role @role',  'Set an existing role as the jail role'],
        ['jailsetup channel #ch', 'Set the jail notification channel'],
        ['jailsetup reset',       'Reset jail configuration'],
        ['logs channel #ch',      'Set the moderation log channel'],
        ['socialmedia',           'Configure social media feed announcements'],
        ['autorole',              'Set/remove the auto-assigned role on join'],
        ['joindm',                'Configure the DM sent to new members'],
      ]},
    ],

    information: [
      { title: 'User Information Commands', color: INFO_COL, cmds: [
        ['userinfo [@user]',      'Detailed info about a user'],
        ['avatar [@user]',        'View a user\'s global avatar'],
        ['serveravatar [@user]',  'View a user\'s server-specific avatar'],
        ['banner [@user]',        'View a user\'s profile banner'],
        ['birthday set/list',     'Set/view member birthdays'],
        ['timezone set/list',     'Set/view member timezones'],
        ['membercount',           'Show server member count breakdown'],
        ['members @role',         'List members with a specific role'],
        ['bots',                  'List all bots in the server'],
      ]},
      { title: 'Server & Bot Information', color: INFO_COL, cmds: [
        ['serverinfo [id]',  'Detailed info about the server'],
        ['roleinfo @role',   'Info about a specific role'],
        ['roles',            'List all server roles'],
        ['channelinfo',      'Info about a channel'],
        ['emoji <name>',     'Info/preview an emoji'],
        ['sticker',          'View/add a sticker'],
        ['guildicon',        'View the server icon'],
        ['guildbanner',      'View the server banner'],
        ['ping',             'Bot latency and API ping'],
        ['botinfo',          'Info about the bot'],
        ['uptime',           'Bot uptime'],
      ]},
    ],

    security: [
      { title: 'Antinuke Commands', color: SEC_COL, cmds: [
        ['antinuke',                       'Open the antinuke dashboard (dropdown)'],
        ['antinuke enable / disable',       'Enable or disable antinuke'],
        ['antinuke whitelist @user',        'Whitelist a user from antinuke checks'],
        ['antinuke unwhitelist @user',      'Remove a user from the whitelist'],
        ['antinuke admin add/remove @user', 'Manage antinuke admin list'],
        ['antinuke limit <action> <n>',     'Set threshold before punishment triggers'],
      ]},
      { title: 'Active Protections', color: SEC_COL, cmds: [
        ['Anti Channel Delete',    '🗑️ Detects and punishes mass channel deletion'],
        ['Anti Channel Create',    '🆕 Detects rapid channel creation'],
        ['Anti Role Delete',       '🔴 Detects and reverses mass role deletion'],
        ['Anti Role Create',       '🟢 Detects rapid role creation'],
        ['Anti Role Rename',       '✏️ Detects mass role renaming'],
        ['Anti Ban',               '🔨 Blocks mass banning attempts'],
        ['Anti Kick',              '👢 Blocks mass kicking attempts'],
        ['Anti Bot Add',           '🤖 Blocks unauthorized bot additions'],
        ['Anti Prune',             '✂️ Detects member pruning attempts'],
        ['Anti Webhook Create',    '🪝 Detects rapid webhook creation'],
        ['Anti Mass Mention',      '📢 Detects mass @mentions'],
        ['Anti Ghost Ping',        '👻 Detects ghost ping attempts'],
        ['Anti Vanity Change',     '🎯 Prevents vanity URL changes'],
        ['Anti Server Rename',     '🏷️ Prevents unauthorized server rename'],
        ['Anti Invite Delete',     '🔗 Detects bulk invite deletion'],
      ]},
    ],

    utility: [
      { title: 'Utility Tool Commands', color: UTIL_COL, cmds: [
        ['afk [reason]',       'Set your AFK status'],
        ['remind <time> <msg>','Set a reminder'],
        ['color #hex',         'Preview a color and get info'],
        ['urban <term>',       'Urban Dictionary lookup'],
        ['steal <emoji>',      'Steal an emoji from another server'],
        ['firstmessage [#ch]', 'Jump to the first message in a channel'],
        ['guildicon',          'View the server icon'],
        ['guildbanner',        'View the server banner'],
        ['createembed',        'Build a custom embed interactively'],
      ]},
    ],

    roleplay: [
      { title: 'Affection & Mood Actions', color: RP_COL, cmds: [
        ['hug @user',       'Give someone a warm hug'],
        ['kiss @user',      'Kiss someone'],
        ['cuddle @user',    'Cuddle with someone'],
        ['pat @user',       'Pat someone on the head'],
        ['nuzzle @user',    'Nuzzle someone'],
        ['handhold @user',  'Hold hands with someone'],
        ['feed @user',      'Feed someone'],
        ['nom @user',       'Nom on someone'],
        ['blush',           'Express blush'],
        ['smile',           'Smile'],
        ['wink',            'Wink'],
        ['pout',            'Pout'],
        ['cry',             'Cry'],
        ['happy',           'Express happiness'],
        ['wave @user',      'Wave at someone'],
        ['dance',           'Break into dance'],
        ['cringe',          'Cringe'],
      ]},
      { title: 'Action Commands', color: RP_COL, cmds: [
        ['slap @user',      'Slap someone'],
        ['punch @user',     'Punch someone'],
        ['bonk @user',      'Bonk someone'],
        ['yeet @user',      'Yeet someone into the void'],
        ['kill @user',      'Dramatically kill someone'],
        ['poke @user',      'Poke someone'],
        ['bite @user',      'Bite someone'],
        ['lick @user',      'Lick someone'],
        ['glomp @user',     'Glomp someone'],
        ['highfive @user',  'Give a high five'],
      ]},
    ],

    fun: [
      { title: 'Fun & Games Commands', color: FUN_COL, cmds: [
        ['8ball <question>',          'Ask the magic 8-ball'],
        ['coinflip',                  'Flip a coin'],
        ['rps <rock/paper/scissors>', 'Play rock paper scissors'],
        ['randomnumber',              'Generate a random number'],
        ['pp [@user]',                'Check a member\'s pp size (joke)'],
        ['gnome @user',               'Gnome someone'],
        ['snipe [#ch]',               'View the last deleted message'],
        ['editsnipe [#ch]',           'View the last edited message'],
        ['poll <question>',           'Create a quick yes/no poll'],
      ]},
    ],

    owner: [
      { title: 'Owner Panel Commands', color: ACCENT, cmds: [
        ['owner',                     'Open the interactive owner panel'],
        ['owner perks',               'List all owner perks'],
        ['owner noprefix',            'Toggle no-prefix mode on/off'],
        ['owner stats',               'Deep runtime & memory stats'],
        ['owner guilds [page]',       'List all servers the bot is in'],
        ['owner leave <guildId>',     'Force the bot to leave a server'],
        ['owner setstatus <t> <text>','Change the bot\'s activity status'],
        ['owner setavatar <url>',     'Change the bot\'s avatar'],
        ['owner resetprefix <gId>',   'Reset a server\'s prefix to default'],
        ['owner dm <userId> <msg>',   'DM any user as the bot'],
        ['owner broadcast <msg>',     'DM all guild owners'],
        ['owner eval <code>',         'Execute JavaScript in bot runtime'],
        ['owner blacklist add <id>',  'Globally block a user from all interactions'],
        ['owner blacklist remove <id>','Unblock a globally blacklisted user'],
        ['owner blacklist list',      'View all blacklisted users'],
        ['owner shutdown',            'Gracefully shut down the bot'],
      ]},
    ],
  };
}

// ── Dropdown for category selection ───────────────────────────
const DROPDOWN_OPTIONS = [
  { label: '🏠 Home',            description: 'Back to main panel',                         value: 'home'          },
  { label: '🔨 Moderation',      description: 'Ban, mute, jail, lockdown and 30+ more',     value: 'moderation'    },
  { label: '⚙️ Configuration',   description: 'Prefix, welcome, modules, autoresponder',    value: 'configuration' },
  { label: '🚀 Server Setup',    description: 'Icon, banner, booster roles, customize',     value: 'serversetup'   },
  { label: '📊 Information',     description: 'User, server, role and bot info',            value: 'information'   },
  { label: '🛡️ Security',        description: 'Antinuke — 15 active protections',           value: 'security'      },
  { label: '🔧 Utility',         description: 'AFK, reminders, tools',                      value: 'utility'       },
  { label: '🎭 Roleplay',        description: 'Anime GIF actions',                          value: 'roleplay'      },
  { label: '🎉 Fun',             description: 'Games, polls, snipe',                        value: 'fun'           },
  { label: '👑 Owner Panel',     description: 'Exclusive owner-only commands',              value: 'owner'         },
];

const CAT_LABELS = {
  moderation: '🔨 Moderation', configuration: '⚙️ Configuration', serversetup: '🚀 Server Setup',
  information: '📊 Information', security: '🛡️ Security', utility: '🔧 Utility',
  roleplay: '🎭 Roleplay', fun: '🎉 Fun', owner: '👑 Owner Panel',
};

// ── Home embed ─────────────────────────────────────────────────
function homeEmbed(botName, prefix, botIcon) {
  const cats = DROPDOWN_OPTIONS.filter(o => o.value !== 'home');
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: `${botName} — Help Menu`, iconURL: botIcon })
    .setDescription([
      `Welcome to the help menu! Select a category below to view commands.`,
      '',
      `Need any command? Then my prefix is: \`${prefix}\``,
      '',
      cats.map(c => `${c.label}`).join('\n'),
      '',
      `**Total Commands: ${Object.values(buildPages(prefix)).reduce((a, cat) => a + cat.reduce((b, p) => b + p.cmds.length, 0), 0)}**`,
    ].join('\n'))
    .setFooter({ text: `${botName} • Select a category from the dropdown below` })
    .setTimestamp();
}

// ── Page embed ─────────────────────────────────────────────────
function pageEmbed(page, pageNum, totalPages, catLabel, botName) {
  const lines = page.cmds.map(([name, desc]) => `\`.${name}\` — ${desc}`).join('\n');
  return new EmbedBuilder()
    .setColor(page.color)
    .setTitle(`${page.title}:`)
    .setDescription(`\`\`\`\n${page.cmds.map(([n, d]) => `${n.padEnd(36)} — ${d}`).join('\n')}\n\`\`\``)
    .setFooter({ text: `Page ${pageNum}/${totalPages} • ${page.cmds.length} commands in ${page.title}` });
}

// ── Button rows ────────────────────────────────────────────────
function navButtons(pageNum, totalPages, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('help_prev').setEmoji('⏪').setStyle(ButtonStyle.Secondary).setDisabled(disabled || pageNum <= 1),
    new ButtonBuilder().setCustomId('help_home').setEmoji('🏠').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('help_next').setEmoji('⏩').setStyle(ButtonStyle.Secondary).setDisabled(disabled || pageNum >= totalPages),
    new ButtonBuilder().setCustomId('help_close').setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function categoryDropdown(active = 'home', disabled = false) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_cat')
      .setPlaceholder('Select a category…')
      .setDisabled(disabled)
      .addOptions(DROPDOWN_OPTIONS.map(o => ({ ...o, default: o.value === active })))
  );
}

// ── Main command ───────────────────────────────────────────────
module.exports = {
  name: 'help',
  aliases: ['h', 'commands', 'cmds'],
  run: async (client, message, args, prefix) => {
    const botIcon = client.user.displayAvatarURL({ dynamic: true });
    const botName = client.user.username;
    const pages   = buildPages(prefix);

    let activeCat  = 'home';
    let pageNum    = 1;
    let catPages   = null;

    // Direct command lookup
    if (args[0] && args[0].toLowerCase() !== 'home') {
      const cmdName = args[0].toLowerCase();
      const cmd = client.prefixCmds.get(cmdName) ?? client.prefixCmds.get(client.aliases.get(cmdName));
      if (cmd) return cmd.run(client, message, [], prefix);
    }

    const msg = await message.channel.send({
      embeds:     [homeEmbed(botName, prefix, botIcon)],
      components: [categoryDropdown('home')],
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === message.author.id,
      time: 180_000,
    });

    collector.on('collect', async i => {
      try {
        if (i.customId === 'help_cat') {
          const val = i.values[0];

          // Owner guard
          if (val === 'owner' && i.user.id !== OWNER_ID) {
            return i.reply({ content: '👑 The **Owner Panel** is restricted to the bot owner.', ephemeral: true });
          }

          if (val === 'home') {
            activeCat = 'home'; pageNum = 1; catPages = null;
            return i.update({ embeds: [homeEmbed(botName, prefix, botIcon)], components: [categoryDropdown('home')] });
          }

          activeCat = val;
          catPages  = pages[val];
          pageNum   = 1;
          const page = catPages[0];
          return i.update({
            embeds:     [pageEmbed(page, 1, catPages.length, CAT_LABELS[val], botName)],
            components: [categoryDropdown(val), navButtons(1, catPages.length)],
          });
        }

        if (i.customId === 'help_home') {
          activeCat = 'home'; pageNum = 1; catPages = null;
          return i.update({ embeds: [homeEmbed(botName, prefix, botIcon)], components: [categoryDropdown('home')] });
        }

        if (i.customId === 'help_prev' && catPages) {
          pageNum = Math.max(1, pageNum - 1);
          return i.update({
            embeds:     [pageEmbed(catPages[pageNum - 1], pageNum, catPages.length, CAT_LABELS[activeCat], botName)],
            components: [categoryDropdown(activeCat), navButtons(pageNum, catPages.length)],
          });
        }

        if (i.customId === 'help_next' && catPages) {
          pageNum = Math.min(catPages.length, pageNum + 1);
          return i.update({
            embeds:     [pageEmbed(catPages[pageNum - 1], pageNum, catPages.length, CAT_LABELS[activeCat], botName)],
            components: [categoryDropdown(activeCat), navButtons(pageNum, catPages.length)],
          });
        }

        if (i.customId === 'help_close') {
          collector.stop('closed');
          return i.update({ components: [categoryDropdown(activeCat, true), navButtons(pageNum, catPages?.length ?? 1, true)] });
        }
      } catch (err) {
        console.error('[help] Interaction error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'closed') return;
      msg.edit({ components: [categoryDropdown(activeCat, true), ...(catPages ? [navButtons(pageNum, catPages.length, true)] : [])] }).catch(() => {});
    });
  }
};
