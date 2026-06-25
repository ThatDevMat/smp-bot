/**
 * Global test setup & shared factories.
 *
 * Provides reusable stubs and factory functions so individual test
 * files don't have to re-create Discord interaction mocks, embed
 * assertions, or HTTP request/response stubs from scratch.
 *
 * Environment variables are set here so they are available before
 * any module that reads process.env (e.g. config.js) is imported.
 */

/* ------------------------------------------------------------------ */
/*  Environment bootstrap (runs once at import)                        */
/* ------------------------------------------------------------------ */

const TEST_ENV = {
  BOT_TOKEN: 'test-bot-token',
  CLIENT_ID: 'test-client-id',
  GUILD_ID: '222222',
  RCON_HOST: '127.0.0.1',
  RCON_PORT: '25575',
  RCON_PASSWORD: 'test-rcon-password',
  MYSQL_HOST: '127.0.0.1',
  MYSQL_PORT: '3306',
  MYSQL_USER: 'test-user',
  MYSQL_PASSWORD: 'test-pass',
  MYSQL_DB: 'test-db',
  WEBHOOK_PORT: '3001',
  WEBHOOK_SECRET: 'test-webhook-secret',
  CHANNEL_MINECRAFT_CHAT: '100001',
  CHANNEL_SERVER_LOG: '100002',
  CHANNEL_SERVER_STATUS: '100003',
  CHANNEL_EVENTS: '100004',
  CHANNEL_POLLS: '100005',
  STAFF_ROLE_IDS: '333333,555555',
  BACKUP_DIR: './test-backups',
  BACKUP_RETAIN_DAILY: '30',
  BACKUP_RETAIN_WEEKLY: '4',
};

for (const [key, val] of Object.entries(TEST_ENV)) {
  if (!process.env[key]) {
    process.env[key] = val;
  }
}

/* ------------------------------------------------------------------ */
/*  Discord interaction factory                                        */
/* ------------------------------------------------------------------ */

/**
 * Create a minimal mock Discord command interaction.
 *
 * @param {object}  opts
 * @param {string}  [opts.userId='111111']      Discord user ID
 * @param {string}  [opts.userTag='User#0000']  Discord user tag
 * @param {string}  [opts.guildId='222222']      Guild ID
 * @param {boolean} [opts.isStaff=false]         Whether the user has staff role
 * @param {Array}   [opts.staffRoleIds]          The configured staff role IDs
 * @returns {object} A stub interaction with jest.fn() methods.
 */
function createMockInteraction(opts = {}) {
  const {
    userId = '111111',
    userTag = 'User#0000',
    guildId = '222222',
    isStaff = false,
    staffRoleIds = ['333333'],
  } = opts;

  // Build a set of options that getString / getInteger / getUser / etc.
  // read from.  Test files populate this before calling execute().
  const optionsMap = {};

  const mockInteraction = {
    user: { id: userId, tag: userTag },
    client: { users: { fetch: jest.fn() } },
    guildId,
    guild: {
      id: guildId,
      ownerId: '000000',
      channels: {
        cache: new Map(),
      },
    },
    commandName: '',
    options: {
      getSubcommand: jest.fn(),
      getString: jest.fn((name) => optionsMap[name]),
      getInteger: jest.fn((name) => optionsMap[name]),
      getNumber: jest.fn((name) => optionsMap[name]),
      getUser: jest.fn((name) => optionsMap[name]),
      getBoolean: jest.fn((name) => optionsMap[name]),
      _setOption(name, value) {
        optionsMap[name] = value;
      },
    },
    // Permissions mock: the member has staff roles when isStaff === true.
    member: {
      id: userId,
      roles: {
        cache: isStaff
          ? new Map(staffRoleIds.map((id) => [id, { id, name: 'Staff' }]))
          : new Map(),
      },
      permissions: {
        has: jest.fn(() => false),
      },
    },
    replied: false,
    deferred: false,
    ephemeral: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    fetchReply: jest.fn().mockResolvedValue({
      react: jest.fn().mockResolvedValue(undefined),
    }),
    // For convenience, track the embed payload passed to reply/editReply.
    _lastEmbed: null,
    _lastEmbeds: null,
    _lastContent: null,
  };

  // Spy on reply et al. to capture embed payloads for assertions.
  const origReply = mockInteraction.reply;
  mockInteraction.reply = jest.fn((payload) => {
    if (payload && payload.embeds) {
      mockInteraction._lastEmbeds = payload.embeds;
    }
    if (payload && payload.content) {
      mockInteraction._lastContent = payload.content;
    }
    mockInteraction.replied = true;
    return Promise.resolve(undefined);
  });

  const origEditReply = mockInteraction.editReply;
  mockInteraction.editReply = jest.fn((payload) => {
    if (payload && payload.embeds) {
      mockInteraction._lastEmbeds = payload.embeds;
    }
    if (payload && payload.content) {
      mockInteraction._lastContent = payload.content;
    }
    mockInteraction.deferred = true;
    return Promise.resolve(undefined);
  });

  const origDeferReply = mockInteraction.deferReply;
  mockInteraction.deferReply = jest.fn((opts) => {
    mockInteraction.deferred = true;
    mockInteraction.ephemeral = opts?.ephemeral || false;
    return Promise.resolve(undefined);
  });

  return mockInteraction;
}

/* ------------------------------------------------------------------ */
/*  Express req / res factory                                          */
/* ------------------------------------------------------------------ */

/**
 * Create a mock Express Request object.
 */
function createMockReq(overrides = {}) {
  return {
    body: null,
    headers: {},
    query: {},
    ...overrides,
  };
}

/**
 * Create a mock Express Response object with jest.fn() spies.
 */
function createMockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

/* ------------------------------------------------------------------ */
/*  Discord Embed assertions                                           */
/* ------------------------------------------------------------------ */

/**
 * Extract the top-level fields from a Discord embed object for assertion.
 */
function parseEmbed(embed) {
  if (!embed) return null;
  return {
    title: embed.title,
    description: embed.description,
    color: embed.color,
    fields: embed.fields || [],
    footer: embed.footer,
    timestamp: embed.timestamp,
  };
}

/**
 * Find an embed field by name.
 */
function findField(embed, name) {
  return (embed.fields || []).find((f) => f.name === name);
}

/* ------------------------------------------------------------------ */
/*  Staff role / config helpers                                        */
/* ------------------------------------------------------------------ */

/**
 * The staff role ID used in permission tests.
 */
const STAFF_ROLE_ID = '333333';

/**
 * Set environment variables needed by src/config.js before requiring it.
 */
function setTestEnv() {
  process.env.BOT_TOKEN = 'test-bot-token';
  process.env.CLIENT_ID = 'test-client-id';
  process.env.GUILD_ID = '222222';
  process.env.RCON_HOST = '127.0.0.1';
  process.env.RCON_PORT = '25575';
  process.env.RCON_PASSWORD = 'test-rcon-password';
  process.env.MYSQL_HOST = '127.0.0.1';
  process.env.MYSQL_PORT = '3306';
  process.env.MYSQL_USER = 'test-user';
  process.env.MYSQL_PASSWORD = 'test-pass';
  process.env.MYSQL_DB = 'test-db';
  process.env.WEBHOOK_PORT = '3001';
  process.env.WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.CHANNEL_MINECRAFT_CHAT = '100001';
  process.env.CHANNEL_SERVER_LOG = '100002';
  process.env.CHANNEL_SERVER_STATUS = '100003';
  process.env.CHANNEL_EVENTS = '100004';
  process.env.CHANNEL_POLLS = '100005';
  process.env.STAFF_ROLE_IDS = STAFF_ROLE_ID;
}

module.exports = {
  createMockInteraction,
  createMockReq,
  createMockRes,
  parseEmbed,
  findField,
  setTestEnv,
  STAFF_ROLE_ID,
};
