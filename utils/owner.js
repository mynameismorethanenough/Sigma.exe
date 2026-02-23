/**
 * owner.js — Bot owner configuration
 * Owner: matchalatte_with_banana (1365744417465696437)
 */

const OWNER_ID  = '1365744417465696437';
const OWNER_TAG = 'matchalatte_with_banana';

const OWNER_PERKS = [
  '⚡ No prefix — toggle with `,owner noprefix`',
  '🔑 All permission checks bypassed globally',
  '🚫 Immune to ignore list, disable, and module blocks',
  '💻 `eval` — execute JavaScript in bot runtime',
  '📡 `broadcast` — DM all guild owners',
  '🌐 `guilds` — list every server the bot is in',
  '👢 `leave <id>` — force-leave any server',
  '🔇 `blacklist add/remove <id>` — globally block any user',
  '🎭 `setstatus <type> <text>` — change bot activity',
  '🖼️ `setavatar <url>` — change bot avatar',
  '📩 `dm <userId> <msg>` — DM any user as the bot',
  '🔧 `resetprefix <guildId>` — reset any server prefix',
  '📊 `stats` — deep runtime & memory stats',
  '🔌 `shutdown` — gracefully stop the bot',
];

function isOwner(id) {
  return id === OWNER_ID;
}

// ── No-prefix toggle (in-memory, resets on restart) ───────────
// Use a module-level variable so all files share it via require cache
let _noPrefixEnabled = false;

function isNoPrefixEnabled() { return _noPrefixEnabled; }
function setNoPrefix(val)    { _noPrefixEnabled = Boolean(val); return _noPrefixEnabled; }
function toggleNoPrefix()    { _noPrefixEnabled = !_noPrefixEnabled; return _noPrefixEnabled; }

module.exports = { OWNER_ID, OWNER_TAG, OWNER_PERKS, isOwner, isNoPrefixEnabled, setNoPrefix, toggleNoPrefix };
