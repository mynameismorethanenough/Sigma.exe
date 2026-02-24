const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS guilds (
        guild_id    VARCHAR(20) PRIMARY KEY,
        name        TEXT,
        prefix      VARCHAR(10) DEFAULT ',',
        log_channel VARCHAR(20),
        joined_at   TIMESTAMPTZ DEFAULT NOW(),
        is_active   BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id                VARCHAR(20) PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
        welcome_channel         VARCHAR(20),
        welcome_message         TEXT,
        welcome_enabled         BOOLEAN DEFAULT TRUE,
        welcome_embed_title     TEXT,
        welcome_embed_desc      TEXT,
        welcome_embed_color     INT,
        welcome_embed_thumbnail VARCHAR(10),
        welcome_embed_image     TEXT,
        autorole_id             VARCHAR(20),
        joindm_message          TEXT,
        joindm_enabled          BOOLEAN DEFAULT TRUE,
        joindm_embed_title      TEXT,
        joindm_embed_desc       TEXT,
        joindm_embed_color      INT,
        joindm_embed_thumbnail  VARCHAR(10),
        joindm_embed_image      TEXT,
        joindm_embed_footer     TEXT,
        antiinvite              BOOLEAN DEFAULT FALSE,
        anti_new_accounts       BOOLEAN DEFAULT FALSE,
        fake_permissions        JSONB DEFAULT '{}'::jsonb
      );

      CREATE TABLE IF NOT EXISTS antinuke_config (
        guild_id              VARCHAR(20) PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
        enabled               BOOLEAN DEFAULT TRUE,
        punishment            VARCHAR(20) DEFAULT 'ban',
        channel_delete_limit  INT DEFAULT 2,
        channel_create_limit  INT DEFAULT 3,
        role_delete_limit     INT DEFAULT 2,
        role_create_limit     INT DEFAULT 3,
        bot_add_limit         INT DEFAULT 1,
        ban_limit             INT DEFAULT 3,
        webhook_create_limit  INT DEFAULT 2,
        kick_limit            INT DEFAULT 3,
        mention_limit         INT DEFAULT 10,
        prune_limit           INT DEFAULT 5,
        role_rename_limit     INT DEFAULT 3,
        server_rename_limit   INT DEFAULT 2,
        invite_delete_limit   INT DEFAULT 3,
        ghost_ping_enabled    BOOLEAN DEFAULT TRUE,
        vanity_enabled        BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS antinuke_whitelist (
        guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
        user_id  VARCHAR(20),
        added_by VARCHAR(20),
        added_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );

      -- Antinuke admins: can whitelist/unwhitelist but cannot change punishment/limits
      CREATE TABLE IF NOT EXISTS antinuke_admins (
        guild_id VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
        user_id  VARCHAR(20),
        added_by VARCHAR(20),
        added_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );

      -- Social media feeds
      CREATE TABLE IF NOT EXISTS social_feeds (
        id             BIGSERIAL PRIMARY KEY,
        guild_id       VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
        platform       VARCHAR(20) NOT NULL,
        handle         VARCHAR(100) NOT NULL,
        channel_id     VARCHAR(20) NOT NULL,
        custom_message TEXT,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(guild_id, platform, handle)
      );

      CREATE TABLE IF NOT EXISTS infractions (
        id             BIGSERIAL PRIMARY KEY,
        guild_id       VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
        target_user_id VARCHAR(20),
        mod_user_id    VARCHAR(20),
        type           VARCHAR(20),
        reason         TEXT,
        expires_at     TIMESTAMPTZ,
        is_active      BOOLEAN DEFAULT TRUE,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_infractions_guild_target ON infractions(guild_id, target_user_id);

      CREATE TABLE IF NOT EXISTS afk_status (
        guild_id VARCHAR(20),
        user_id  VARCHAR(20),
        message  TEXT DEFAULT 'AFK',
        set_at   TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS snipes (
        channel_id    VARCHAR(20) PRIMARY KEY,
        content       TEXT,
        author_tag    TEXT,
        author_avatar TEXT,
        image_url     TEXT,
        deleted_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS edit_snipes (
        channel_id     VARCHAR(20) PRIMARY KEY,
        before_content TEXT,
        after_content  TEXT,
        author_tag     TEXT,
        author_avatar  TEXT,
        message_url    TEXT,
        edited_at      TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS jail_config (
        guild_id        VARCHAR(20) PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
        jail_role_id    VARCHAR(20),
        jail_channel_id VARCHAR(20)
      );

      CREATE TABLE IF NOT EXISTS jailed_members (
        guild_id       VARCHAR(20) REFERENCES guilds(guild_id) ON DELETE CASCADE,
        user_id        VARCHAR(20),
        previous_roles TEXT,
        jailed_by      VARCHAR(20),
        reason         TEXT,
        expires_at     TIMESTAMPTZ,
        is_active      BOOLEAN DEFAULT TRUE,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS voice_sessions (
        id            BIGSERIAL PRIMARY KEY,
        guild_id      VARCHAR(20),
        user_id       VARCHAR(20),
        channel_id    VARCHAR(20),
        channel_name  TEXT,
        joined_at     TIMESTAMPTZ DEFAULT NOW(),
        left_at       TIMESTAMPTZ,
        duration_secs INT
      );

      CREATE TABLE IF NOT EXISTS voice_stats (
        guild_id      VARCHAR(20),
        user_id       VARCHAR(20),
        total_seconds BIGINT DEFAULT 0,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_voice_open ON voice_sessions(guild_id, user_id) WHERE left_at IS NULL;

      CREATE TABLE IF NOT EXISTS invite_tracking (
        guild_id    VARCHAR(20),
        invite_code VARCHAR(20),
        inviter_id  VARCHAR(20),
        uses        INT DEFAULT 0,
        PRIMARY KEY (guild_id, invite_code)
      );

      CREATE TABLE IF NOT EXISTS invite_uses (
        id          BIGSERIAL PRIMARY KEY,
        guild_id    VARCHAR(20),
        invitee_id  VARCHAR(20),
        inviter_id  VARCHAR(20),
        invite_code VARCHAR(20),
        joined_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS birthdays (
        guild_id    VARCHAR(20),
        user_id     VARCHAR(20),
        birth_month INT NOT NULL,
        birth_day   INT NOT NULL,
        birth_year  INT,
        set_at      TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS birthday_config (
        guild_id        VARCHAR(20) PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
        channel_id      VARCHAR(20),
        role_id         VARCHAR(20),
        message         TEXT DEFAULT 'Happy Birthday {user}! 🎂'
      );

      CREATE TABLE IF NOT EXISTS timezones (
        user_id   VARCHAR(20) PRIMARY KEY,
        timezone  VARCHAR(100) NOT NULL,
        set_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS message_tracking (
        guild_id        VARCHAR(20),
        user_id         VARCHAR(20),
        message_count   BIGINT DEFAULT 0,
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    // ── Safe column additions for existing DBs ────────────────
    const safeAdd = async (table, col, type) => {
      await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    };
    await safeAdd('guild_settings', 'welcome_enabled',         'BOOLEAN DEFAULT TRUE');
    await safeAdd('guild_settings', 'welcome_embed_title',     'TEXT');
    await safeAdd('guild_settings', 'welcome_embed_desc',      'TEXT');
    await safeAdd('guild_settings', 'welcome_embed_color',     'INT');
    await safeAdd('guild_settings', 'welcome_embed_thumbnail', 'VARCHAR(10)');
    await safeAdd('guild_settings', 'welcome_embed_image',     'TEXT');
    await safeAdd('guild_settings', 'joindm_enabled',          'BOOLEAN DEFAULT TRUE');
    await safeAdd('guild_settings', 'joindm_embed_title',      'TEXT');
    await safeAdd('guild_settings', 'joindm_embed_desc',       'TEXT');
    await safeAdd('guild_settings', 'joindm_embed_color',      'INT');
    await safeAdd('guild_settings', 'joindm_embed_thumbnail',  'VARCHAR(10)');
    await safeAdd('guild_settings', 'joindm_embed_image',      'TEXT');
    await safeAdd('guild_settings', 'joindm_embed_footer',     'TEXT');
    await safeAdd('guild_settings', 'fake_permissions',        "JSONB DEFAULT '{}'::jsonb");

    // Antinuke new columns (safe add for existing DBs)
    await safeAdd('antinuke_config', 'kick_limit',          'INT DEFAULT 3');
    await safeAdd('antinuke_config', 'mention_limit',       'INT DEFAULT 10');
    await safeAdd('antinuke_config', 'prune_limit',         'INT DEFAULT 5');
    await safeAdd('antinuke_config', 'role_rename_limit',   'INT DEFAULT 3');
    await safeAdd('antinuke_config', 'server_rename_limit', 'INT DEFAULT 2');
    await safeAdd('antinuke_config', 'invite_delete_limit', 'INT DEFAULT 3');
    await safeAdd('antinuke_config', 'ghost_ping_enabled',  'BOOLEAN DEFAULT TRUE');
    await safeAdd('antinuke_config', 'vanity_enabled',      'BOOLEAN DEFAULT TRUE');

    // Disabled commands
    await client.query(`CREATE TABLE IF NOT EXISTS disabled_commands (guild_id VARCHAR(20), command_name VARCHAR(50), channel_id VARCHAR(20) DEFAULT '', disabled_by VARCHAR(20), disabled_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (guild_id, command_name, channel_id));`);

    // Personal user prefixes
    await client.query(`CREATE TABLE IF NOT EXISTS user_prefixes (
      guild_id VARCHAR(20),
      user_id  VARCHAR(20),
      prefix   VARCHAR(10) NOT NULL,
      set_at   TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );`);

    // Booster roles
    await client.query(`
      CREATE TABLE IF NOT EXISTS booster_role_config (
        guild_id   VARCHAR(20) PRIMARY KEY,
        enabled    BOOLEAN DEFAULT TRUE,
        max_shares INT DEFAULT 3
      );
      CREATE TABLE IF NOT EXISTS booster_roles (
        guild_id   VARCHAR(20),
        user_id    VARCHAR(20),
        role_id    VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS booster_role_shares (
        guild_id       VARCHAR(20),
        owner_id       VARCHAR(20),
        target_user_id VARCHAR(20),
        shared_at      TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, owner_id, target_user_id)
      );
    `);

    // Staff roles
    await client.query(`CREATE TABLE IF NOT EXISTS staff_roles (
      guild_id VARCHAR(20),
      role_id  VARCHAR(20),
      added_by VARCHAR(20),
      added_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, role_id)
    );`);

    // Extended guild_settings columns (v9)
    await safeAdd('guild_settings', 'autonick_format',  'TEXT');
    await safeAdd('guild_settings', 'muted_role_id',    'VARCHAR(20)');
    await safeAdd('guild_settings', 'rmuted_role_id',   'VARCHAR(20)');
    await safeAdd('guild_settings', 'imuted_role_id',   'VARCHAR(20)');

    // Custom jail message in jail_config
    await safeAdd('jail_config', 'custom_jail_message', 'TEXT');


    // ── v10 New Feature Tables ─────────────────────────────────

    // Boost messages (per-channel boost announcements)
    await client.query(`
      CREATE TABLE IF NOT EXISTS boost_messages (
        guild_id   VARCHAR(20),
        channel_id VARCHAR(20),
        message    TEXT NOT NULL,
        use_embed  BOOLEAN DEFAULT FALSE,
        embed_color INT DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, channel_id)
      );
    `);

    // Guild command aliases (custom shortcuts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS guild_aliases (
        guild_id   VARCHAR(20),
        shortcut   VARCHAR(50),
        command    TEXT NOT NULL,
        created_by VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, shortcut)
      );
    `);

    // Sticky messages (per-channel)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sticky_messages (
        guild_id    VARCHAR(20),
        channel_id  VARCHAR(20),
        message     TEXT NOT NULL,
        last_msg_id VARCHAR(20),
        PRIMARY KEY (guild_id, channel_id)
      );
    `);

    // Autoresponders
    await client.query(`
      CREATE TABLE IF NOT EXISTS autoresponders (
        id                   BIGSERIAL PRIMARY KEY,
        guild_id             VARCHAR(20),
        trigger              TEXT NOT NULL,
        response             TEXT NOT NULL,
        strict               BOOLEAN DEFAULT TRUE,
        exclusive            BOOLEAN DEFAULT FALSE,
        self_destruct        INT DEFAULT NULL,
        ignore_command_check BOOLEAN DEFAULT FALSE,
        delete_trigger       BOOLEAN DEFAULT FALSE,
        created_by           VARCHAR(20),
        created_at           TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(guild_id, trigger)
      );
    `);

    // Ignored members/channels (bypass all commands)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ignored_entities (
        guild_id    VARCHAR(20),
        entity_id   VARCHAR(20),
        entity_type VARCHAR(10),
        added_by    VARCHAR(20),
        added_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, entity_id, entity_type)
      );
    `);

    // Multi-channel welcome messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS welcome_channels (
        guild_id   VARCHAR(20),
        channel_id VARCHAR(20),
        message    TEXT NOT NULL,
        use_embed  BOOLEAN DEFAULT FALSE,
        embed_color INT DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, channel_id)
      );
    `);

    // Disabled modules (category-level disabling)
    await client.query(`
      CREATE TABLE IF NOT EXISTS disabled_modules (
        guild_id    VARCHAR(20),
        module_name VARCHAR(30),
        channel_id  VARCHAR(20) DEFAULT '',
        disabled_by VARCHAR(20),
        disabled_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, module_name, channel_id)
      );
    `);


    // ── Global blacklist (owner-controlled) ────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_blacklist (
        user_id    VARCHAR(20) PRIMARY KEY,
        reason     TEXT,
        added_by   VARCHAR(20),
        added_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);


    // ── Member profiles (customize bio/banner/avatar) ──────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS member_profiles (
        guild_id   VARCHAR(20),
        user_id    VARCHAR(20),
        bio        TEXT,
        avatar_url TEXT,
        banner_url TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    // ── Badge system ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS badge_roles (
        guild_id   VARCHAR(20),
        role_id    VARCHAR(20),
        badge_name VARCHAR(100),
        badge_emoji VARCHAR(20),
        added_by   VARCHAR(20),
        added_at   TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, role_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS badge_config (
        guild_id        VARCHAR(20) PRIMARY KEY,
        guild_tag       VARCHAR(50),
        badge_message   TEXT,
        sync_enabled    BOOLEAN DEFAULT TRUE,
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS member_badges (
        guild_id   VARCHAR(20),
        user_id    VARCHAR(20),
        role_id    VARCHAR(20),
        synced_at  TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id, role_id)
      );
    `);


    // ── Add new columns to member_profiles if not present ──────
    await safeAdd('member_profiles', 'activity_status', 'VARCHAR(128)');
    await safeAdd('member_profiles', 'profile_status',  'VARCHAR(128)');

    await client.query('COMMIT');
    console.log('✅ Database migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const q = (text, params) => pool.query(text, params);

// ── Guild ──────────────────────────────────────────────────────
async function ensureGuild(guildId, name) {
  await q(`INSERT INTO guilds (guild_id,name) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET name=EXCLUDED.name,is_active=TRUE`, [guildId, name]);
  await q(`INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`, [guildId]);
  await q(`INSERT INTO antinuke_config (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`, [guildId]);
  await q(`INSERT INTO jail_config (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`, [guildId]);
  await q(`INSERT INTO birthday_config (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`, [guildId]);
}
async function getGuild(guildId) {
  const { rows } = await q('SELECT * FROM guilds WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null;
}
async function getPrefix(guildId) {
  const { rows } = await q('SELECT prefix FROM guilds WHERE guild_id=$1', [guildId]);
  return rows[0]?.prefix ?? ',';
}
async function setPrefix(guildId, prefix)    { await q('UPDATE guilds SET prefix=$1 WHERE guild_id=$2', [prefix, guildId]); }
async function setLogChannel(guildId, channelId) { await q('UPDATE guilds SET log_channel=$1 WHERE guild_id=$2', [channelId, guildId]); }

// ── Settings ───────────────────────────────────────────────────
async function getSettings(guildId) {
  const { rows } = await q('SELECT * FROM guild_settings WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null;
}
async function setWelcome(guildId, channelId, message) {
  await q(`INSERT INTO guild_settings (guild_id,welcome_channel,welcome_message) VALUES ($1,$2,$3)
    ON CONFLICT (guild_id) DO UPDATE SET welcome_channel=$2,welcome_message=$3`,
    [guildId, channelId, message]);
}
// Dynamic partial-update for welcome extra columns
async function setWelcomeExtra(guildId, fields) {
  const keys = Object.keys(fields);
  const setClauses = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
  const values = [guildId, ...Object.values(fields)];
  await q(`INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO UPDATE SET ${setClauses}`, values);
}
async function clearWelcome(guildId) {
  await q(`UPDATE guild_settings SET
    welcome_channel=NULL,welcome_message=NULL,welcome_enabled=TRUE,
    welcome_embed_title=NULL,welcome_embed_desc=NULL,welcome_embed_color=NULL,
    welcome_embed_thumbnail=NULL,welcome_embed_image=NULL
    WHERE guild_id=$1`, [guildId]);
}

async function setAutorole(guildId, roleId) {
  await q(`INSERT INTO guild_settings (guild_id,autorole_id) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET autorole_id=$2`, [guildId, roleId]);
}
async function setJoinDM(guildId, message) {
  await q(`INSERT INTO guild_settings (guild_id,joindm_message) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET joindm_message=$2`, [guildId, message]);
}
async function setJoinDMExtra(guildId, fields) {
  const keys = Object.keys(fields);
  const setClauses = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
  const values = [guildId, ...Object.values(fields)];
  await q(`INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO UPDATE SET ${setClauses}`, values);
}
async function clearJoinDM(guildId) {
  await q(`UPDATE guild_settings SET
    joindm_message=NULL,joindm_enabled=TRUE,
    joindm_embed_title=NULL,joindm_embed_desc=NULL,joindm_embed_color=NULL,
    joindm_embed_thumbnail=NULL,joindm_embed_image=NULL,joindm_embed_footer=NULL
    WHERE guild_id=$1`, [guildId]);
}
async function setAntiInvite(guildId, enabled) {
  await q(`INSERT INTO guild_settings (guild_id,antiinvite) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET antiinvite=$2`, [guildId, enabled]);
}

// ── Fake Permissions ───────────────────────────────────────────
// Schema: { users: { userId: { grant: [], deny: [] } }, roles: { roleId: { grant: [], deny: [] } } }

async function getFakePerms(guildId) {
  const { rows } = await q('SELECT fake_permissions FROM guild_settings WHERE guild_id=$1', [guildId]);
  const fp = rows[0]?.fake_permissions ?? {};
  // Normalise: if old flat schema (no users/roles keys), migrate to new schema
  if (fp && !fp.users && !fp.roles) {
    return { users: fp, roles: {} };
  }
  return { users: fp.users ?? {}, roles: fp.roles ?? {} };
}

async function getEntityFakePerms(guildId, kind, entityId) {
  const all = await getFakePerms(guildId);
  const ns  = kind === 'role' ? all.roles : all.users;
  return ns[entityId] ?? { grant: [], deny: [] };
}

// Legacy helper kept for backward compat
async function getUserFakePerms(guildId, userId) {
  return getEntityFakePerms(guildId, 'user', userId);
}

async function setFakePerm(guildId, kind, entityId, type, perm) {
  const ns       = kind === 'role' ? 'roles' : 'users';
  const opposite = type === 'grant' ? 'deny' : 'grant';

  // Read current, modify in JS, write back — simpler than nested jsonb_set for nested schema
  const current = await getFakePerms(guildId);
  const target  = current[ns][entityId] ?? { grant: [], deny: [] };

  // Remove from opposite list
  target[opposite] = (target[opposite] ?? []).filter(p => p !== perm);
  // Add to type list (dedup)
  if (!target[type].includes(perm)) target[type].push(perm);

  current[ns][entityId] = target;

  await q(`UPDATE guild_settings SET fake_permissions=$1::jsonb WHERE guild_id=$2`, [JSON.stringify(current), guildId]);
}

async function clearFakePerm(guildId, kind, entityId, perm) {
  const ns      = kind === 'role' ? 'roles' : 'users';
  const current = await getFakePerms(guildId);
  const target  = current[ns][entityId] ?? { grant: [], deny: [] };
  target.grant  = (target.grant ?? []).filter(p => p !== perm);
  target.deny   = (target.deny  ?? []).filter(p => p !== perm);
  current[ns][entityId] = target;
  await q(`UPDATE guild_settings SET fake_permissions=$1::jsonb WHERE guild_id=$2`, [JSON.stringify(current), guildId]);
}

async function clearAllFakePerms(guildId, kind, entityId) {
  const ns      = kind === 'role' ? 'roles' : 'users';
  const current = await getFakePerms(guildId);
  delete current[ns][entityId];
  await q(`UPDATE guild_settings SET fake_permissions=$1::jsonb WHERE guild_id=$2`, [JSON.stringify(current), guildId]);
}

// ── Antinuke ───────────────────────────────────────────────────
async function getAntinukeConfig(guildId) {
  const { rows } = await q('SELECT * FROM antinuke_config WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null;
}
async function setAntinukePunishment(guildId, punishment) {
  await q('UPDATE antinuke_config SET punishment=$1 WHERE guild_id=$2', [punishment, guildId]);
}
async function isWhitelisted(guildId, userId) {
  const { rows } = await q('SELECT 1 FROM antinuke_whitelist WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows.length > 0;
}
async function addWhitelist(guildId, userId, addedBy) {
  await q(`INSERT INTO antinuke_whitelist (guild_id,user_id,added_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [guildId, userId, addedBy]);
}
async function removeWhitelist(guildId, userId) {
  const { rowCount } = await q('DELETE FROM antinuke_whitelist WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rowCount > 0;
}
async function getWhitelist(guildId) {
  const { rows } = await q('SELECT * FROM antinuke_whitelist WHERE guild_id=$1', [guildId]);
  return rows;
}

// ── Antinuke Admins ────────────────────────────────────────────
async function getAntinukeAdmins(guildId) {
  const { rows } = await q('SELECT * FROM antinuke_admins WHERE guild_id=$1', [guildId]);
  return rows;
}
async function isAntinukeAdmin(guildId, userId) {
  const { rows } = await q('SELECT 1 FROM antinuke_admins WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows.length > 0;
}
async function addAntinukeAdmin(guildId, userId, addedBy) {
  await q(`INSERT INTO antinuke_admins (guild_id,user_id,added_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [guildId, userId, addedBy]);
}
async function removeAntinukeAdmin(guildId, userId) {
  const { rowCount } = await q('DELETE FROM antinuke_admins WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rowCount > 0;
}

// ── Social Feeds ───────────────────────────────────────────────
async function addSocialFeed(guildId, platform, handle, channelId) {
  await q(`INSERT INTO social_feeds (guild_id,platform,handle,channel_id) VALUES ($1,$2,$3,$4)
    ON CONFLICT (guild_id,platform,handle) DO UPDATE SET channel_id=$4`, [guildId, platform, handle, channelId]);
}
async function removeSocialFeed(guildId, platform, handle) {
  const { rowCount } = await q('DELETE FROM social_feeds WHERE guild_id=$1 AND platform=$2 AND handle=$3', [guildId, platform, handle]);
  return rowCount > 0;
}
async function getSocialFeed(guildId, platform, handle) {
  const { rows } = await q('SELECT * FROM social_feeds WHERE guild_id=$1 AND platform=$2 AND handle=$3', [guildId, platform, handle]);
  return rows[0] ?? null;
}
async function getSocialFeeds(guildId) {
  const { rows } = await q('SELECT * FROM social_feeds WHERE guild_id=$1 ORDER BY platform, handle', [guildId]);
  return rows;
}
async function setSocialFeedMessage(guildId, platform, handle, message) {
  await q(`UPDATE social_feeds SET custom_message=$1 WHERE guild_id=$2 AND platform=$3 AND handle=$4`, [message, guildId, platform, handle]);
}
async function clearSocialFeeds(guildId) {
  await q('DELETE FROM social_feeds WHERE guild_id=$1', [guildId]);
}

// ── Infractions ────────────────────────────────────────────────
async function addInfraction({ guildId, targetUserId, modUserId, type, reason, expiresAt = null }) {
  const { rows } = await q(
    `INSERT INTO infractions (guild_id,target_user_id,mod_user_id,type,reason,expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [guildId, targetUserId, modUserId, type, reason, expiresAt]
  );
  return rows[0].id;
}
async function getUserInfractions(guildId, userId) {
  const { rows } = await q(`SELECT * FROM infractions WHERE guild_id=$1 AND target_user_id=$2 ORDER BY created_at DESC LIMIT 15`, [guildId, userId]);
  return rows;
}

// ── AFK ────────────────────────────────────────────────────────
async function setAfk(guildId, userId, message) {
  await q(`INSERT INTO afk_status (guild_id,user_id,message) VALUES ($1,$2,$3) ON CONFLICT (guild_id,user_id) DO UPDATE SET message=$3,set_at=NOW()`, [guildId, userId, message]);
}
async function getAfk(guildId, userId) {
  const { rows } = await q('SELECT * FROM afk_status WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0] ?? null;
}
async function clearAfk(guildId, userId) { await q('DELETE FROM afk_status WHERE guild_id=$1 AND user_id=$2', [guildId, userId]); }

// ── Snipes ─────────────────────────────────────────────────────
async function setSnipe(channelId, content, authorTag, authorAvatar, imageUrl) {
  await q(`INSERT INTO snipes (channel_id,content,author_tag,author_avatar,image_url,deleted_at) VALUES ($1,$2,$3,$4,$5,NOW())
    ON CONFLICT (channel_id) DO UPDATE SET content=$2,author_tag=$3,author_avatar=$4,image_url=$5,deleted_at=NOW()`,
    [channelId, content, authorTag, authorAvatar, imageUrl]);
}
async function getSnipe(channelId) {
  const { rows } = await q('SELECT * FROM snipes WHERE channel_id=$1', [channelId]);
  return rows[0] ?? null;
}
async function setEditSnipe(channelId, before, after, authorTag, authorAvatar, messageUrl) {
  await q(`INSERT INTO edit_snipes (channel_id,before_content,after_content,author_tag,author_avatar,message_url,edited_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT (channel_id) DO UPDATE SET before_content=$2,after_content=$3,author_tag=$4,author_avatar=$5,message_url=$6,edited_at=NOW()`,
    [channelId, before, after, authorTag, authorAvatar, messageUrl]);
}
async function getEditSnipe(channelId) {
  const { rows } = await q('SELECT * FROM edit_snipes WHERE channel_id=$1', [channelId]);
  return rows[0] ?? null;
}

// ── Jail ───────────────────────────────────────────────────────
async function getJailConfig(guildId) {
  const { rows } = await q('SELECT * FROM jail_config WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null;
}
async function setJailConfig(guildId, roleId, channelId) {
  await q(`INSERT INTO jail_config (guild_id,jail_role_id,jail_channel_id) VALUES ($1,$2,$3)
    ON CONFLICT (guild_id) DO UPDATE SET jail_role_id=$2,jail_channel_id=$3`, [guildId, roleId, channelId]);
}
async function jailMember(guildId, userId, jailedBy, reason, previousRoles, expiresAt) {
  await q(`INSERT INTO jailed_members (guild_id,user_id,previous_roles,jailed_by,reason,expires_at,is_active) VALUES ($1,$2,$3,$4,$5,$6,TRUE)
    ON CONFLICT (guild_id,user_id) DO UPDATE SET previous_roles=$3,jailed_by=$4,reason=$5,expires_at=$6,is_active=TRUE,created_at=NOW()`,
    [guildId, userId, previousRoles, jailedBy, reason, expiresAt]);
}
async function getJailedMember(guildId, userId) {
  const { rows } = await q('SELECT * FROM jailed_members WHERE guild_id=$1 AND user_id=$2 AND is_active=TRUE', [guildId, userId]);
  return rows[0] ?? null;
}
async function unjailMember(guildId, userId) {
  const { rows } = await q(`UPDATE jailed_members SET is_active=FALSE WHERE guild_id=$1 AND user_id=$2 AND is_active=TRUE RETURNING previous_roles`, [guildId, userId]);
  return rows[0]?.previous_roles ?? null;
}
async function getExpiredJails() {
  const { rows } = await q(`SELECT * FROM jailed_members WHERE is_active=TRUE AND expires_at IS NOT NULL AND expires_at<=NOW()`);
  return rows;
}

// ── Voice Tracking ─────────────────────────────────────────────
async function openVoiceSession(guildId, userId, channelId, channelName) {
  await closeVoiceSession(guildId, userId);
  await q(`INSERT INTO voice_sessions (guild_id,user_id,channel_id,channel_name) VALUES ($1,$2,$3,$4)`, [guildId, userId, channelId, channelName]);
}
async function closeVoiceSession(guildId, userId) {
  const { rows } = await q(`UPDATE voice_sessions SET left_at=NOW(),duration_secs=EXTRACT(EPOCH FROM (NOW()-joined_at))::INT
    WHERE guild_id=$1 AND user_id=$2 AND left_at IS NULL RETURNING duration_secs`, [guildId, userId]);
  const secs = rows[0]?.duration_secs ?? 0;
  if (secs > 0) {
    await q(`INSERT INTO voice_stats (guild_id,user_id,total_seconds) VALUES ($1,$2,$3)
      ON CONFLICT (guild_id,user_id) DO UPDATE SET total_seconds=voice_stats.total_seconds+$3,updated_at=NOW()`,
      [guildId, userId, secs]);
  }
}
async function getVoiceStats(guildId, userId) {
  const { rows } = await q('SELECT * FROM voice_stats WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0] ?? null;
}
async function getVoiceLeaderboard(guildId, limit = 10) {
  const { rows } = await q(`SELECT * FROM voice_stats WHERE guild_id=$1 ORDER BY total_seconds DESC LIMIT $2`, [guildId, limit]);
  return rows;
}

// ── Invite Tracking ────────────────────────────────────────────
async function upsertInvite(guildId, code, inviterId, uses) {
  await q(`INSERT INTO invite_tracking (guild_id,invite_code,inviter_id,uses) VALUES ($1,$2,$3,$4)
    ON CONFLICT (guild_id,invite_code) DO UPDATE SET uses=$4,inviter_id=$3`, [guildId, code, inviterId, uses]);
}
async function logInviteUse(guildId, inviteeId, inviterId, code) {
  await q(`INSERT INTO invite_uses (guild_id,invitee_id,inviter_id,invite_code) VALUES ($1,$2,$3,$4)`, [guildId, inviteeId, inviterId, code]);
}
async function getInviterStats(guildId, inviterId) {
  const { rows } = await q(`SELECT COUNT(*) AS total FROM invite_uses WHERE guild_id=$1 AND inviter_id=$2`, [guildId, inviterId]);
  return parseInt(rows[0]?.total ?? 0);
}
async function getInviteLeaderboard(guildId, limit = 10) {
  const { rows } = await q(`SELECT inviter_id, COUNT(*) AS total FROM invite_uses WHERE guild_id=$1 GROUP BY inviter_id ORDER BY total DESC LIMIT $2`, [guildId, limit]);
  return rows;
}

// ── Message Tracking ───────────────────────────────────────────
async function incrementMessageCount(guildId, userId) {
  await q(`INSERT INTO message_tracking (guild_id,user_id,message_count) VALUES ($1,$2,1)
    ON CONFLICT (guild_id,user_id) DO UPDATE SET message_count=message_tracking.message_count+1,last_message_at=NOW()`, [guildId, userId]);
}
async function getMessageStats(guildId, userId) {
  const { rows } = await q('SELECT * FROM message_tracking WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0] ?? null;
}
async function getMessageLeaderboard(guildId, limit = 10) {
  const { rows } = await q(`SELECT * FROM message_tracking WHERE guild_id=$1 ORDER BY message_count DESC LIMIT $2`, [guildId, limit]);
  return rows;
}

// ── Birthday ──────────────────────────────────────────────────────
async function setBirthday(guildId, userId, month, day, year) {
  await q(`INSERT INTO birthdays (guild_id,user_id,birth_month,birth_day,birth_year) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (guild_id,user_id) DO UPDATE SET birth_month=$3,birth_day=$4,birth_year=$5,set_at=NOW()`,
    [guildId, userId, month, day, year]);
}
async function getBirthday(guildId, userId) {
  const { rows } = await q('SELECT * FROM birthdays WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0] ?? null;
}
async function getBirthdayList(guildId) {
  const { rows } = await q('SELECT * FROM birthdays WHERE guild_id=$1 ORDER BY birth_month,birth_day', [guildId]);
  return rows;
}
async function getTodayBirthdays(guildId) {
  const now = new Date();
  const { rows } = await q('SELECT * FROM birthdays WHERE guild_id=$1 AND birth_month=$2 AND birth_day=$3',
    [guildId, now.getMonth()+1, now.getDate()]);
  return rows;
}
async function getBirthdayConfig(guildId) {
  const { rows } = await q('SELECT * FROM birthday_config WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null;
}
async function setBirthdayConfig(guildId, field, value) {
  await q(`UPDATE birthday_config SET ${field}=$1 WHERE guild_id=$2`, [value, guildId]);
}
// ── Timezone ──────────────────────────────────────────────────────
async function setTimezone(userId, tz) {
  await q(`INSERT INTO timezones (user_id,timezone) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET timezone=$2,set_at=NOW()`, [userId, tz]);
}
async function getTimezone(userId) {
  const { rows } = await q('SELECT * FROM timezones WHERE user_id=$1', [userId]);
  return rows[0] ?? null;
}
async function getGuildTimezones(userIds) {
  if (!userIds.length) return [];
  const { rows } = await q(`SELECT * FROM timezones WHERE user_id = ANY($1)`, [userIds]);
  return rows;
}

module.exports = {
  pool, q, migrate,
  ensureGuild, getGuild, getPrefix, setPrefix, setLogChannel,
  getSettings, setWelcome, setWelcomeExtra, clearWelcome,
  setAutorole, setJoinDM, setJoinDMExtra, clearJoinDM, setAntiInvite,
  getFakePerms, getEntityFakePerms, getUserFakePerms, setFakePerm, clearFakePerm, clearAllFakePerms,
  getAntinukeConfig, setAntinukePunishment,
  isWhitelisted, addWhitelist, removeWhitelist, getWhitelist,
  getAntinukeAdmins, isAntinukeAdmin, addAntinukeAdmin, removeAntinukeAdmin,
  addSocialFeed, removeSocialFeed, getSocialFeed, getSocialFeeds, setSocialFeedMessage, clearSocialFeeds,
  addInfraction, getUserInfractions,
  setAfk, getAfk, clearAfk,
  setSnipe, getSnipe, setEditSnipe, getEditSnipe,
  getJailConfig, setJailConfig, jailMember, getJailedMember, unjailMember, getExpiredJails,
  openVoiceSession, closeVoiceSession, getVoiceStats, getVoiceLeaderboard,
  upsertInvite, logInviteUse, getInviterStats, getInviteLeaderboard,
  incrementMessageCount, getMessageStats, getMessageLeaderboard,
  setBirthday, getBirthday, getBirthdayList, getTodayBirthdays,
  getBirthdayConfig, setBirthdayConfig,
  setTimezone, getTimezone, getGuildTimezones,
};

// ═══════════════════════════════════════════════════════════════════
// NEW TABLES & FUNCTIONS — added in v9
// ═══════════════════════════════════════════════════════════════════

// ── Disabled Commands ──────────────────────────────────────────────
// (channel_id='' means guild-wide; specific id = that channel only)

async function disableCommand(guildId, commandName, channelId = '', disabledBy) {
  await q(
    `INSERT INTO disabled_commands (guild_id, command_name, channel_id, disabled_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, command_name, channel_id) DO UPDATE SET disabled_by=$4, disabled_at=NOW()`,
    [guildId, commandName, channelId, disabledBy]
  );
}
async function enableCommand(guildId, commandName, channelId = '') {
  const { rowCount } = await q(
    `DELETE FROM disabled_commands WHERE guild_id=$1 AND command_name=$2 AND channel_id=$3`,
    [guildId, commandName, channelId]
  );
  return rowCount > 0;
}
async function isCommandDisabled(guildId, commandName, channelId) {
  const { rows } = await q(
    `SELECT 1 FROM disabled_commands
     WHERE guild_id=$1 AND command_name=$2 AND (channel_id='' OR channel_id=$3) LIMIT 1`,
    [guildId, commandName, channelId]
  );
  return rows.length > 0;
}
async function getDisabledCommands(guildId) {
  const { rows } = await q(
    `SELECT * FROM disabled_commands WHERE guild_id=$1 ORDER BY command_name, channel_id`,
    [guildId]
  );
  return rows;
}

// ── Personal Prefix ────────────────────────────────────────────────
async function getUserPrefix(guildId, userId) {
  const { rows } = await q(
    'SELECT prefix FROM user_prefixes WHERE guild_id=$1 AND user_id=$2', [guildId, userId]
  );
  return rows[0]?.prefix ?? null;
}
async function setUserPrefix(guildId, userId, prefix) {
  await q(
    `INSERT INTO user_prefixes (guild_id, user_id, prefix)
     VALUES ($1,$2,$3) ON CONFLICT (guild_id, user_id) DO UPDATE SET prefix=$3, set_at=NOW()`,
    [guildId, userId, prefix]
  );
}
async function removeUserPrefix(guildId, userId) {
  const { rowCount } = await q(
    'DELETE FROM user_prefixes WHERE guild_id=$1 AND user_id=$2', [guildId, userId]
  );
  return rowCount > 0;
}

// ── Booster Roles ─────────────────────────────────────────────────
async function getBoosterRoleConfig(guildId) {
  const { rows } = await q('SELECT * FROM booster_role_config WHERE guild_id=$1', [guildId]);
  return rows[0] ?? { guild_id: guildId, enabled: true, max_shares: 3 };
}
async function setBoosterRoleConfig(guildId, field, value) {
  await q(
    `INSERT INTO booster_role_config (guild_id) VALUES ($1)
     ON CONFLICT (guild_id) DO NOTHING`, [guildId]
  );
  await q(`UPDATE booster_role_config SET ${field}=$1 WHERE guild_id=$2`, [value, guildId]);
}

async function getBoosterRoleConfigRaw(guildId) {
  const { rows } = await q('SELECT * FROM booster_role_config WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null; // null means no setup row exists
}

async function getBoosterRole(guildId, userId) {
  const { rows } = await q(
    'SELECT * FROM booster_roles WHERE guild_id=$1 AND user_id=$2', [guildId, userId]
  );
  return rows[0] ?? null;
}
async function setBoosterRole(guildId, userId, roleId) {
  await q(
    `INSERT INTO booster_roles (guild_id, user_id, role_id)
     VALUES ($1,$2,$3) ON CONFLICT (guild_id, user_id) DO UPDATE SET role_id=$3, created_at=NOW()`,
    [guildId, userId, roleId]
  );
}
async function removeBoosterRole(guildId, userId) {
  await q('DELETE FROM booster_roles WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
}
async function getAllBoosterRoles(guildId) {
  const { rows } = await q('SELECT * FROM booster_roles WHERE guild_id=$1', [guildId]);
  return rows;
}
async function getBoosterShares(guildId, ownerId) {
  const { rows } = await q(
    'SELECT * FROM booster_role_shares WHERE guild_id=$1 AND owner_id=$2', [guildId, ownerId]
  );
  return rows;
}
async function addBoosterShare(guildId, ownerId, targetUserId) {
  await q(
    `INSERT INTO booster_role_shares (guild_id, owner_id, target_user_id)
     VALUES ($1,$2,$3) ON CONFLICT (guild_id, owner_id, target_user_id) DO NOTHING`,
    [guildId, ownerId, targetUserId]
  );
}
async function removeBoosterShare(guildId, ownerId, targetUserId) {
  const { rowCount } = await q(
    'DELETE FROM booster_role_shares WHERE guild_id=$1 AND owner_id=$2 AND target_user_id=$3',
    [guildId, ownerId, targetUserId]
  );
  return rowCount > 0;
}

// ── Server Settings (extended) ────────────────────────────────────
async function updateSetting(guildId, field, value) {
  await q(
    `INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`, [guildId]
  );
  await q(`UPDATE guild_settings SET ${field}=$1 WHERE guild_id=$2`, [value, guildId]);
}

// ── Staff Roles ───────────────────────────────────────────────────
async function addStaffRole(guildId, roleId, addedBy) {
  await q(
    `INSERT INTO staff_roles (guild_id, role_id, added_by)
     VALUES ($1,$2,$3) ON CONFLICT (guild_id, role_id) DO NOTHING`,
    [guildId, roleId, addedBy]
  );
}
async function removeStaffRole(guildId, roleId) {
  const { rowCount } = await q(
    'DELETE FROM staff_roles WHERE guild_id=$1 AND role_id=$2', [guildId, roleId]
  );
  return rowCount > 0;
}
async function getStaffRoles(guildId) {
  const { rows } = await q(
    'SELECT * FROM staff_roles WHERE guild_id=$1 ORDER BY added_at', [guildId]
  );
  return rows;
}

module.exports = {
  pool, q, migrate,
  ensureGuild, getGuild, getPrefix, setPrefix, setLogChannel,
  getSettings, setWelcome, setWelcomeExtra, clearWelcome,
  setAutorole, setJoinDM, setJoinDMExtra, clearJoinDM, setAntiInvite,
  getFakePerms, getEntityFakePerms, getUserFakePerms, setFakePerm, clearFakePerm, clearAllFakePerms,
  getAntinukeConfig, setAntinukePunishment,
  isWhitelisted, addWhitelist, removeWhitelist, getWhitelist,
  getAntinukeAdmins, isAntinukeAdmin, addAntinukeAdmin, removeAntinukeAdmin,
  addSocialFeed, removeSocialFeed, getSocialFeed, getSocialFeeds, setSocialFeedMessage, clearSocialFeeds,
  addInfraction, getUserInfractions,
  setAfk, getAfk, clearAfk,
  setSnipe, getSnipe, setEditSnipe, getEditSnipe,
  getJailConfig, setJailConfig, jailMember, getJailedMember, unjailMember, getExpiredJails,
  openVoiceSession, closeVoiceSession, getVoiceStats, getVoiceLeaderboard,
  upsertInvite, logInviteUse, getInviterStats, getInviteLeaderboard,
  incrementMessageCount, getMessageStats, getMessageLeaderboard,
  setBirthday, getBirthday, getBirthdayList, getTodayBirthdays,
  getBirthdayConfig, setBirthdayConfig,
  setTimezone, getTimezone, getGuildTimezones,
  // v9 additions
  disableCommand, enableCommand, isCommandDisabled, getDisabledCommands,
  getUserPrefix, setUserPrefix, removeUserPrefix,
  getBoosterRoleConfig, setBoosterRoleConfig, getBoosterRoleConfigRaw,
  getBoosterRole, setBoosterRole, removeBoosterRole, getAllBoosterRoles,
  getBoosterShares, addBoosterShare, removeBoosterShare,
  updateSetting,
  addStaffRole, removeStaffRole, getStaffRoles,
};

// ═══════════════════════════════════════════════════════════════
// v10 NEW DB FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ── Boost Messages ─────────────────────────────────────────────
async function setBoostMessage(guildId, channelId, message, useEmbed = false, embedColor = null) {
  await q(`INSERT INTO boost_messages (guild_id,channel_id,message,use_embed,embed_color)
    VALUES ($1,$2,$3,$4,$5) ON CONFLICT (guild_id,channel_id) DO UPDATE SET message=$3,use_embed=$4,embed_color=$5`,
    [guildId, channelId, message, useEmbed, embedColor]);
}
async function getBoostMessage(guildId, channelId) {
  const { rows } = await q('SELECT * FROM boost_messages WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rows[0] ?? null;
}
async function getAllBoostMessages(guildId) {
  const { rows } = await q('SELECT * FROM boost_messages WHERE guild_id=$1 ORDER BY created_at', [guildId]);
  return rows;
}
async function removeBoostMessage(guildId, channelId) {
  const { rowCount } = await q('DELETE FROM boost_messages WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rowCount > 0;
}

// ── Guild Aliases ──────────────────────────────────────────────
async function addAlias(guildId, shortcut, command, createdBy) {
  await q(`INSERT INTO guild_aliases (guild_id,shortcut,command,created_by) VALUES ($1,$2,$3,$4)
    ON CONFLICT (guild_id,shortcut) DO UPDATE SET command=$3,created_by=$4,created_at=NOW()`,
    [guildId, shortcut.toLowerCase(), command, createdBy]);
}
async function removeAlias(guildId, shortcut) {
  const { rowCount } = await q('DELETE FROM guild_aliases WHERE guild_id=$1 AND shortcut=$2', [guildId, shortcut.toLowerCase()]);
  return rowCount > 0;
}
async function removeAllAliasesForCommand(guildId, command) {
  const { rowCount } = await q('DELETE FROM guild_aliases WHERE guild_id=$1 AND command=$2', [guildId, command]);
  return rowCount;
}
async function getAlias(guildId, shortcut) {
  const { rows } = await q('SELECT * FROM guild_aliases WHERE guild_id=$1 AND shortcut=$2', [guildId, shortcut.toLowerCase()]);
  return rows[0] ?? null;
}
async function getAliases(guildId) {
  const { rows } = await q('SELECT * FROM guild_aliases WHERE guild_id=$1 ORDER BY shortcut', [guildId]);
  return rows;
}

// ── Sticky Messages ────────────────────────────────────────────
async function setStickyMessage(guildId, channelId, message) {
  await q(`INSERT INTO sticky_messages (guild_id,channel_id,message) VALUES ($1,$2,$3)
    ON CONFLICT (guild_id,channel_id) DO UPDATE SET message=$3`, [guildId, channelId, message]);
}
async function getStickyMessage(guildId, channelId) {
  const { rows } = await q('SELECT * FROM sticky_messages WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rows[0] ?? null;
}
async function getAllStickyMessages(guildId) {
  const { rows } = await q('SELECT * FROM sticky_messages WHERE guild_id=$1 ORDER BY channel_id', [guildId]);
  return rows;
}
async function removeStickyMessage(guildId, channelId) {
  const { rowCount } = await q('DELETE FROM sticky_messages WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rowCount > 0;
}
async function updateStickyLastMsg(guildId, channelId, msgId) {
  await q('UPDATE sticky_messages SET last_msg_id=$1 WHERE guild_id=$2 AND channel_id=$3', [msgId, guildId, channelId]);
}

// ── Autoresponders ─────────────────────────────────────────────
async function addAutoresponder(guildId, trigger, response, opts = {}) {
  await q(`INSERT INTO autoresponders (guild_id,trigger,response,strict,exclusive,self_destruct,ignore_command_check,delete_trigger,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (guild_id,trigger) DO UPDATE
    SET response=$3,strict=$4,exclusive=$5,self_destruct=$6,ignore_command_check=$7,delete_trigger=$8,created_at=NOW()`,
    [guildId, trigger, response,
     opts.strict ?? true, opts.exclusive ?? false, opts.selfDestruct ?? null,
     opts.ignoreCommandCheck ?? false, opts.delete ?? false, opts.createdBy ?? null]);
}
async function removeAutoresponder(guildId, trigger) {
  const { rowCount } = await q('DELETE FROM autoresponders WHERE guild_id=$1 AND trigger=$2', [guildId, trigger]);
  return rowCount > 0;
}
async function getAutoresponders(guildId) {
  const { rows } = await q('SELECT * FROM autoresponders WHERE guild_id=$1 ORDER BY trigger', [guildId]);
  return rows;
}
async function matchAutoresponder(guildId, content) {
  // Try strict (exact) match first, then non-strict (contains)
  const { rows } = await q('SELECT * FROM autoresponders WHERE guild_id=$1', [guildId]);
  for (const ar of rows) {
    const lower = content.toLowerCase();
    const triggerLower = ar.trigger.toLowerCase();
    if (ar.strict ? lower === triggerLower : lower.includes(triggerLower)) return ar;
  }
  return null;
}

// ── Ignored Entities ───────────────────────────────────────────
async function addIgnored(guildId, entityId, entityType, addedBy) {
  await q(`INSERT INTO ignored_entities (guild_id,entity_id,entity_type,added_by) VALUES ($1,$2,$3,$4)
    ON CONFLICT (guild_id,entity_id,entity_type) DO NOTHING`, [guildId, entityId, entityType, addedBy]);
}
async function removeIgnored(guildId, entityId, entityType) {
  const { rowCount } = await q('DELETE FROM ignored_entities WHERE guild_id=$1 AND entity_id=$2 AND entity_type=$3', [guildId, entityId, entityType]);
  return rowCount > 0;
}
async function isIgnored(guildId, userId, channelId) {
  const { rows } = await q(
    `SELECT 1 FROM ignored_entities WHERE guild_id=$1 AND (
      (entity_id=$2 AND entity_type='user') OR (entity_id=$3 AND entity_type='channel')
    ) LIMIT 1`,
    [guildId, userId, channelId]);
  return rows.length > 0;
}
async function getIgnoredList(guildId) {
  const { rows } = await q('SELECT * FROM ignored_entities WHERE guild_id=$1 ORDER BY entity_type,added_at', [guildId]);
  return rows;
}

// ── Welcome Channels (multi-channel) ──────────────────────────
async function addWelcomeChannel(guildId, channelId, message, useEmbed = false, embedColor = null) {
  await q(`INSERT INTO welcome_channels (guild_id,channel_id,message,use_embed,embed_color)
    VALUES ($1,$2,$3,$4,$5) ON CONFLICT (guild_id,channel_id) DO UPDATE SET message=$3,use_embed=$4,embed_color=$5`,
    [guildId, channelId, message, useEmbed, embedColor]);
}
async function removeWelcomeChannel(guildId, channelId) {
  const { rowCount } = await q('DELETE FROM welcome_channels WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rowCount > 0;
}
async function getWelcomeChannel(guildId, channelId) {
  const { rows } = await q('SELECT * FROM welcome_channels WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rows[0] ?? null;
}
async function getAllWelcomeChannels(guildId) {
  const { rows } = await q('SELECT * FROM welcome_channels WHERE guild_id=$1 ORDER BY created_at', [guildId]);
  return rows;
}

// ── Disabled Modules ───────────────────────────────────────────
async function disableModule(guildId, moduleName, channelId = '', disabledBy) {
  await q(`INSERT INTO disabled_modules (guild_id,module_name,channel_id,disabled_by) VALUES ($1,$2,$3,$4)
    ON CONFLICT (guild_id,module_name,channel_id) DO UPDATE SET disabled_by=$4,disabled_at=NOW()`,
    [guildId, moduleName, channelId, disabledBy]);
}
async function enableModule(guildId, moduleName, channelId = '') {
  const { rowCount } = await q('DELETE FROM disabled_modules WHERE guild_id=$1 AND module_name=$2 AND channel_id=$3', [guildId, moduleName, channelId]);
  return rowCount > 0;
}
async function isModuleDisabled(guildId, moduleName) {
  const { rows } = await q(`SELECT 1 FROM disabled_modules WHERE guild_id=$1 AND module_name=$2 AND channel_id='' LIMIT 1`, [guildId, moduleName]);
  return rows.length > 0;
}
async function getDisabledModules(guildId) {
  const { rows } = await q('SELECT * FROM disabled_modules WHERE guild_id=$1 ORDER BY module_name', [guildId]);
  return rows;
}

// Patch module.exports with v10 additions
const _v9exports = module.exports;
module.exports = {
  ..._v9exports,
  // Boost messages
  setBoostMessage, getBoostMessage, getAllBoostMessages, removeBoostMessage,
  // Aliases
  addAlias, removeAlias, removeAllAliasesForCommand, getAlias, getAliases,
  // Sticky messages
  setStickyMessage, getStickyMessage, getAllStickyMessages, removeStickyMessage, updateStickyLastMsg,
  // Autoresponders
  addAutoresponder, removeAutoresponder, getAutoresponders, matchAutoresponder,
  // Ignored entities
  addIgnored, removeIgnored, isIgnored, getIgnoredList,
  // Welcome channels (multi)
  addWelcomeChannel, removeWelcomeChannel, getWelcomeChannel, getAllWelcomeChannels,
  // Disabled modules
  disableModule, enableModule, isModuleDisabled, getDisabledModules,
};

// ── Global Blacklist ──────────────────────────────────────────
async function addBlacklist(userId, reason, addedBy) {
  await q(`INSERT INTO global_blacklist (user_id,reason,added_by) VALUES ($1,$2,$3)
    ON CONFLICT (user_id) DO UPDATE SET reason=$2,added_by=$3,added_at=NOW()`,
    [userId, reason ?? 'No reason', addedBy]);
}
async function removeBlacklist(userId) {
  const { rowCount } = await q('DELETE FROM global_blacklist WHERE user_id=$1', [userId]);
  return rowCount > 0;
}
async function isBlacklisted(userId) {
  const { rows } = await q('SELECT 1 FROM global_blacklist WHERE user_id=$1 LIMIT 1', [userId]);
  return rows.length > 0;
}
async function getBlacklist() {
  const { rows } = await q('SELECT * FROM global_blacklist ORDER BY added_at DESC');
  return rows;
}

// Patch exports with blacklist additions
const _v10exports = module.exports;
module.exports = {
  ..._v10exports,
  addBlacklist, removeBlacklist, isBlacklisted, getBlacklist,
};

// ── Member Profiles ────────────────────────────────────────────
async function getProfile(guildId, userId) {
  const { rows } = await q('SELECT * FROM member_profiles WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0] ?? null;
}
async function setProfile(guildId, userId, fields) {
  const sets = Object.keys(fields).map((k, i) => `${k}=$${i + 3}`).join(',');
  const vals = Object.values(fields);
  await q(`INSERT INTO member_profiles (guild_id,user_id,${Object.keys(fields).join(',')},updated_at)
    VALUES ($1,$2,${vals.map((_,i)=>`$${i+3}`).join(',')},NOW())
    ON CONFLICT (guild_id,user_id) DO UPDATE SET ${sets},updated_at=NOW()`,
    [guildId, userId, ...vals]);
}

// ── Badge System ───────────────────────────────────────────────
async function getBadgeConfig(guildId) {
  const { rows } = await q('SELECT * FROM badge_config WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null;
}
async function setBadgeConfig(guildId, fields) {
  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const sets = keys.map((k, i) => `${k}=$${i + 2}`).join(',');
  await q(`INSERT INTO badge_config (guild_id,${keys.join(',')},updated_at) VALUES ($1,${vals.map((_,i)=>`$${i+2}`).join(',')},NOW())
    ON CONFLICT (guild_id) DO UPDATE SET ${sets},updated_at=NOW()`,
    [guildId, ...vals]);
}
async function addBadgeRole(guildId, roleId, badgeName, badgeEmoji, addedBy) {
  await q(`INSERT INTO badge_roles (guild_id,role_id,badge_name,badge_emoji,added_by) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (guild_id,role_id) DO UPDATE SET badge_name=$3,badge_emoji=$4,added_by=$5`,
    [guildId, roleId, badgeName, badgeEmoji ?? '🏅', addedBy]);
}
async function removeBadgeRole(guildId, roleId) {
  const { rowCount } = await q('DELETE FROM badge_roles WHERE guild_id=$1 AND role_id=$2', [guildId, roleId]);
  return rowCount > 0;
}
async function getBadgeRoles(guildId) {
  const { rows } = await q('SELECT * FROM badge_roles WHERE guild_id=$1 ORDER BY added_at', [guildId]);
  return rows;
}
async function syncMemberBadges(guildId, userId, roleIds) {
  // Clear existing, re-insert current
  await q('DELETE FROM member_badges WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  for (const roleId of roleIds) {
    await q(`INSERT INTO member_badges (guild_id,user_id,role_id,synced_at) VALUES ($1,$2,$3,NOW())
      ON CONFLICT (guild_id,user_id,role_id) DO UPDATE SET synced_at=NOW()`,
      [guildId, userId, roleId]);
  }
}
async function getMemberBadges(guildId, userId) {
  const { rows } = await q('SELECT mb.*, br.badge_name, br.badge_emoji FROM member_badges mb JOIN badge_roles br USING(guild_id,role_id) WHERE mb.guild_id=$1 AND mb.user_id=$2', [guildId, userId]);
  return rows;
}

const _v11exports = module.exports;
module.exports = {
  ..._v11exports,
  getProfile, setProfile,
  getBadgeConfig, setBadgeConfig, addBadgeRole, removeBadgeRole, getBadgeRoles, syncMemberBadges, getMemberBadges,
};

// ═══════════════════════════════════════════════════════════════════════════════
// V12+ ADDITIONS: Server whitelist, guild join tracking, per-user noprefix
// ═══════════════════════════════════════════════════════════════════════════════

// ── Tables (appended to migrate) ─────────────────────────────────────────────
// These are created in the migrate() call above but since migrate is already
// called, we patch them here with a standalone initialiser called at startup.
async function migrateV12plus() {
  await q(`
    CREATE TABLE IF NOT EXISTS server_whitelist (
      guild_id   VARCHAR(20) PRIMARY KEY,
      added_by   VARCHAR(20) NOT NULL,
      reason     TEXT,
      added_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await q(`
    CREATE TABLE IF NOT EXISTS guild_join_log (
      guild_id     VARCHAR(20) PRIMARY KEY,
      guild_name   TEXT,
      inviter_id   VARCHAR(20),
      inviter_tag  TEXT,
      member_count INT,
      joined_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await q(`
    CREATE TABLE IF NOT EXISTS noprefix_users (
      user_id    VARCHAR(20) PRIMARY KEY,
      granted_by VARCHAR(20) NOT NULL,
      granted_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // hardban_list (added in v12 session — create if missing)
  await q(`
    CREATE TABLE IF NOT EXISTS hardban_list (
      guild_id  VARCHAR(20),
      user_id   VARCHAR(20),
      reason    TEXT,
      banned_by VARCHAR(20),
      banned_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );
  `);
  // lockdown ignore list
  await q(`
    CREATE TABLE IF NOT EXISTS lockdown_ignore (
      guild_id   VARCHAR(20),
      channel_id VARCHAR(20),
      added_by   VARCHAR(20),
      added_at   TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, channel_id)
    );
  `);
}

// ── Server Whitelist ──────────────────────────────────────────────────────────
async function isServerWhitelisted(guildId) {
  const { rows } = await q('SELECT 1 FROM server_whitelist WHERE guild_id=$1 LIMIT 1', [guildId]);
  return rows.length > 0;
}
async function addServerWhitelist(guildId, addedBy, reason = 'No reason') {
  await q(`INSERT INTO server_whitelist (guild_id, added_by, reason) VALUES ($1,$2,$3)
    ON CONFLICT (guild_id) DO UPDATE SET added_by=$2, reason=$3, added_at=NOW()`,
    [guildId, addedBy, reason]);
}
async function removeServerWhitelist(guildId) {
  const { rowCount } = await q('DELETE FROM server_whitelist WHERE guild_id=$1', [guildId]);
  return rowCount > 0;
}
async function getServerWhitelist() {
  const { rows } = await q('SELECT * FROM server_whitelist ORDER BY added_at DESC');
  return rows;
}
async function getServerWhitelistEntry(guildId) {
  const { rows } = await q('SELECT * FROM server_whitelist WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null;
}

// ── Guild Join Log ────────────────────────────────────────────────────────────
async function logGuildJoin(guildId, guildName, inviterId, inviterTag, memberCount) {
  await q(`INSERT INTO guild_join_log (guild_id, guild_name, inviter_id, inviter_tag, member_count, joined_at)
    VALUES ($1,$2,$3,$4,$5,NOW())
    ON CONFLICT (guild_id) DO UPDATE SET guild_name=$2, inviter_id=$3, inviter_tag=$4, member_count=$5, joined_at=NOW()`,
    [guildId, guildName, inviterId ?? null, inviterTag ?? null, memberCount]);
}
async function getGuildJoinLog(guildId) {
  const { rows } = await q('SELECT * FROM guild_join_log WHERE guild_id=$1', [guildId]);
  return rows[0] ?? null;
}
async function getAllGuildJoinLogs() {
  const { rows } = await q('SELECT * FROM guild_join_log ORDER BY joined_at DESC');
  return rows;
}

// ── Per-User No-Prefix ────────────────────────────────────────────────────────
async function addNoprefixUser(userId, grantedBy) {
  await q(`INSERT INTO noprefix_users (user_id, granted_by) VALUES ($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET granted_by=$2, granted_at=NOW()`,
    [userId, grantedBy]);
}
async function removeNoprefixUser(userId) {
  const { rowCount } = await q('DELETE FROM noprefix_users WHERE user_id=$1', [userId]);
  return rowCount > 0;
}
async function isNoprefixUser(userId) {
  const { rows } = await q('SELECT 1 FROM noprefix_users WHERE user_id=$1 LIMIT 1', [userId]);
  return rows.length > 0;
}
async function getNoprefixUsers() {
  const { rows } = await q('SELECT * FROM noprefix_users ORDER BY granted_at DESC');
  return rows;
}

// ── Hardban (v12 — in case missing from earlier session) ─────────────────────
async function addHardban(guildId, userId, reason, bannedBy) {
  await q(`INSERT INTO hardban_list (guild_id, user_id, reason, banned_by)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (guild_id, user_id) DO UPDATE SET reason=$3, banned_by=$4, banned_at=NOW()`,
    [guildId, userId, reason ?? 'No reason', bannedBy]);
}
async function removeHardban(guildId, userId) {
  const { rowCount } = await q('DELETE FROM hardban_list WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rowCount > 0;
}
async function getHardbans(guildId) {
  const { rows } = await q('SELECT * FROM hardban_list WHERE guild_id=$1 ORDER BY banned_at DESC', [guildId]);
  return rows;
}
async function isHardbanned(guildId, userId) {
  const { rows } = await q('SELECT 1 FROM hardban_list WHERE guild_id=$1 AND user_id=$2 LIMIT 1', [guildId, userId]);
  return rows.length > 0;
}

// ── Lockdown ignore (v12) ─────────────────────────────────────────────────────
async function getLockdownIgnoreList(guildId) {
  const { rows } = await q('SELECT * FROM lockdown_ignore WHERE guild_id=$1', [guildId]);
  return rows;
}
async function addLockdownIgnore(guildId, channelId, addedBy) {
  await q(`INSERT INTO lockdown_ignore (guild_id, channel_id, added_by)
    VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [guildId, channelId, addedBy]);
}
async function removeLockdownIgnore(guildId, channelId) {
  const { rowCount } = await q('DELETE FROM lockdown_ignore WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rowCount > 0;
}
async function isLockdownIgnored(guildId, channelId) {
  const { rows } = await q('SELECT 1 FROM lockdown_ignore WHERE guild_id=$1 AND channel_id=$2 LIMIT 1', [guildId, channelId]);
  return rows.length > 0;
}

// ── Infraction helpers (v12) ──────────────────────────────────────────────────
async function getInfractionById(id) {
  const { rows } = await q('SELECT * FROM infractions WHERE id=$1', [id]);
  return rows[0] ?? null;
}
async function updateInfractionReason(id, reason) {
  await q('UPDATE infractions SET reason=$1 WHERE id=$2', [reason, id]);
}
async function deleteInfraction(guildId, id) {
  const { rowCount } = await q('DELETE FROM infractions WHERE guild_id=$1 AND id=$2', [guildId, id]);
  return rowCount > 0;
}
async function deleteAllInfractions(guildId, userId) {
  const { rowCount } = await q('DELETE FROM infractions WHERE guild_id=$1 AND target_user_id=$2', [guildId, userId]);
  return rowCount;
}
async function getUserWarnings(guildId, userId) {
  const { rows } = await q(`SELECT * FROM infractions WHERE guild_id=$1 AND target_user_id=$2 AND type='warn' ORDER BY created_at DESC`, [guildId, userId]);
  return rows;
}
async function getModStats(guildId, modUserId) {
  const { rows } = await q(`SELECT type, COUNT(*)::int AS count FROM infractions WHERE guild_id=$1 AND mod_user_id=$2 GROUP BY type`, [guildId, modUserId]);
  return rows;
}
async function getAllModStats(guildId) {
  const { rows } = await q(`SELECT mod_user_id, type, COUNT(*)::int AS count FROM infractions WHERE guild_id=$1 GROUP BY mod_user_id, type ORDER BY count DESC`, [guildId]);
  return rows;
}
async function getJailedList(guildId) {
  const { rows } = await q('SELECT * FROM jailed_members WHERE guild_id=$1 ORDER BY jailed_at DESC', [guildId]);
  return rows;
}

const _v12exports = module.exports;
module.exports = {
  ..._v12exports,
  migrateV12plus,
  // Whitelist
  isServerWhitelisted, addServerWhitelist, removeServerWhitelist, getServerWhitelist, getServerWhitelistEntry,
  // Join log
  logGuildJoin, getGuildJoinLog, getAllGuildJoinLogs,
  // No-prefix users
  addNoprefixUser, removeNoprefixUser, isNoprefixUser, getNoprefixUsers,
  // Hardban
  addHardban, removeHardban, getHardbans, isHardbanned,
  // Lockdown ignore
  getLockdownIgnoreList, addLockdownIgnore, removeLockdownIgnore, isLockdownIgnored,
  // Infraction helpers
  getInfractionById, updateInfractionReason, deleteInfraction, deleteAllInfractions,
  getUserWarnings, getModStats, getAllModStats, getJailedList,
};
