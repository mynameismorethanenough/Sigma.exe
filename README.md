# ConnectBot v5

A bleed-style Discord bot with moderation, security, music, Spotify integration, and more.

---

## Setup

### 1. Install dependencies
```
npm install
```

### 2. Configure `.env`
```env
TOKEN=your_discord_bot_token
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=connectbot

# Optional — enables Spotify integration & music bot Spotify URL support
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Get Spotify credentials free at https://developer.spotify.com/dashboard

### 3. Run
```
npm start
```

---

## Music Bot

> Requires a voice channel. Bot needs **Connect** + **Speak** permissions.

| Command | Aliases | Description |
|---------|---------|-------------|
| `,play <query/URL>` | `,p` | Play a song — YouTube URL, Spotify URL, or search term |
| `,queue [page]` | `,q`, `,np` | View the queue / now playing |
| `,skip` | `,s`, `,next` | Skip the current track |
| `,pause` | | Pause playback |
| `,resume` | `,r`, `,unpause` | Resume playback |
| `,stop` | `,dc`, `,leave` | Stop and disconnect |
| `,volume [0-200]` | `,vol` | Get or set volume |
| `,loop <off/track/queue>` | `,repeat` | Set loop mode |
| `,shuffle` | | Shuffle the queue |
| `,remove <position>` | `,rm` | Remove a track from the queue |

### Supported sources
- **YouTube** — URLs (`youtube.com/watch`, `youtu.be/`) or search terms
- **Spotify** — track, album, and playlist URLs (resolved to YouTube audio)

### Spotify `.env` requirement
Music bot works without Spotify credentials for YouTube. For Spotify URLs, add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.

---

## Spotify Info Command

`,spotify track <name or URL>` — detailed track info  
`,spotify album <name or URL>` — full album with tracklist  
`,spotify artist <name>` — artist profile + top 5 tracks  
`,spotify playlist <URL>` — playlist overview  

Aliases: `,sp`

---

## Fake Permissions

Grant or deny bot-level permissions to **users OR roles** without touching real Discord permissions.

| Command | Description |
|---------|-------------|
| `,fakeperm grant @user/@role <perm>` | Grant a permission |
| `,fakeperm deny @user/@role <perm>` | Deny a permission |
| `,fakeperm reset @user/@role [perm]` | Clear one or all overrides |
| `,fakeperm view @user/@role` | View overrides |
| `,fakeperm list` | List all overrides |
| `,fakeperm perms` | List valid permission names |

### Priority order
`User deny` → `User grant` → `Role deny` → `Role grant` → Real Discord permission

### Valid permissions
`administrator` `manage_guild` `manage_channels` `manage_roles` `manage_messages`  
`manage_webhooks` `manage_nicknames` `manage_emojis` `kick_members` `ban_members`  
`moderate_members` `mention_everyone` `view_audit_log` `deafen_members` `move_members`

### Using in your own commands
```js
const { checkPerm } = require('../../utils/checkPerm');
if (!await checkPerm(message.member, 'manage_guild')) return noPerms();
```

---

## Antinuke

Owner-only. Protects against mass channel/role deletion, mass bans, unauthorized bots.

```
,antinuke                    — status dashboard
,antinuke enable/disable     — toggle protection
,antinuke punishment <type>  — ban/kick/strip/timeout
,antinuke whitelist @user    — trust a user
,antinuke admin add @user    — delegate antinuke management
,antinuke limit <action> <n> — adjust action thresholds
```

---

## Welcome & JoinDM

Full embed support with variables.

```
,welcome channel #channel
,welcome embed title Welcome to {guild.name}!
,welcome embed description Hey {user}, you're our {membercount.ordinal} member
,welcome embed color #5865f2
,welcome embed thumbnail user
,welcome test
```

Variables: `{user}` `{user.name}` `{user.tag}` `{user.id}` `{user.avatar}`  
`{membercount}` `{membercount.ordinal}` `{guild.name}` `{guild.id}` `{guild.icon}`

---

## Social Media Feeds

```
,sm add youtube MrBeast #announcements
,sm add twitch shroud #streams
,sm message youtube MrBeast 🔴 {handle} just uploaded: {title} → {url}
,sm list
,sm test youtube MrBeast
```

Supported: `youtube` `twitch` `twitter` `tiktok` `reddit` `instagram`

