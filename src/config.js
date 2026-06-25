/**
 * Configuration loader.
 *
 * Reads all environment variables from `.env` (via dotenv) and exports
 * a typed `config` object.  Also provides `validateConfig()` which
 * must be called at startup to ensure that required secrets are present.
 *
 * No secrets are hardcoded anywhere in the codebase — everything comes
 * from environment variables.
 */

require('dotenv').config();

const config = {
  bot: {
    token: process.env.BOT_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
  },

  rcon: {
    host: process.env.RCON_HOST || '127.0.0.1',
    port: parseInt(process.env.RCON_PORT, 10) || 25575,
    password: process.env.RCON_PASSWORD,
  },

  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'advancedbans',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB || 'advancedbans',
  },

  webhook: {
    port: parseInt(process.env.WEBHOOK_PORT, 10) || 3000,
    secret: process.env.WEBHOOK_SECRET,
  },

  channels: {
    minecraftChat: process.env.CHANNEL_MINECRAFT_CHAT,
    serverLog: process.env.CHANNEL_SERVER_LOG,
    serverStatus: process.env.CHANNEL_SERVER_STATUS,
    events: process.env.CHANNEL_EVENTS,
    polls: process.env.CHANNEL_POLLS,
  },

  staffRoleIds: (process.env.STAFF_ROLE_IDS || '').split(',').filter(Boolean),
};

function validateConfig() {
  const required = [
    ['BOT_TOKEN', config.bot.token],
    ['CLIENT_ID', config.bot.clientId],
    ['GUILD_ID', config.bot.guildId],
  ];

  const missing = required.filter(([, val]) => !val).map(([key]) => key);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
    console.error('Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }
}

module.exports = { config, validateConfig };
