/**
 * owner.js — Bot owner configuration
 * Owner: matchalatte_with_banana (1365744417465696437)
 */

const OWNER_ID  = '1365744417465696437';
const OWNER_TAG = 'matchalatte_with_banana';

const OWNER_PERKS = [
  '⚡ No prefix — toggle with `,owner noprefix`',
  '🔑 All permission checks bypassed in every command',
  '🛡️ Antinuke access in every server (cannot be punished)',
  '🚫 Immune to: ignore list, disabled commands, disabled modules, blacklist',
  '🌐 `guilds [page]` — list every server the bot is in',
  '👢 `leave <id>` — force-leave any server',
  '🔇 `blacklist add/remove/list` — globally block any user',
  '💀 `gban <id> [reason]` — ban a user from ALL servers at once',
  '🔓 `gunban <id>` — unban a user from ALL servers at once',
  '🔒 `lock <guildId> <channelId>` — remotely lock any channel in any server',
  '🔓 `unlock <guildId> <channelId>` — remotely unlock any channel',
  '🛡️ `antinuke <guildId> <enable/disable>` — remotely control antinuke',
  '🕵️ `spy <guildId>` — view full config & stats for any server',
  '⚡ `massban <id> [id]...` — ban multiple users instantly',
  '🎭 `setstatus <type> <text>` — change bot activity globally',
  '🖼️ `setavatar <url>` — change bot avatar',
  '📩 `dm <userId> <msg>` — DM any user as the bot',
  '📡 `broadcast <msg>` — DM all guild owners',
  '🔧 `resetprefix <guildId>` — reset any server prefix',
  '📊 `stats` — deep runtime & memory stats',
  '💻 `eval <code>` — execute JavaScript in bot runtime',
  '🔌 `shutdown` — gracefully stop the bot',
];

function isOwner(id) {
  return id === OWNER_ID;
}

// ── No-prefix toggle (in-memory, resets on restart) ──────────
let _noPrefixEnabled = false;
function isNoPrefixEnabled() { return _noPrefixEnabled; }
function setNoPrefix(val)    { _noPrefixEnabled = Boolean(val); return _noPrefixEnabled; }
function toggleNoPrefix()    { _noPrefixEnabled = !_noPrefixEnabled; return _noPrefixEnabled; }

module.exports = { OWNER_ID, OWNER_TAG, OWNER_PERKS, isOwner, isNoPrefixEnabled, setNoPrefix, toggleNoPrefix };
