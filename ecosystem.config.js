/**
 * PM2 Ecosystem Configuration
 *
 * Manages the minecraft-bot process on the production server.
 * Populate environment variables directly on the server — never commit
 * real values to this file.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart minecraft-bot
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'minecraft-bot',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        // Populate these on the server (see .env or ~/smp-bot/.env)
        // BOT_TOKEN: '',
        // CLIENT_ID: '',
        // GUILD_ID: '',
        // RCON_HOST: '',
        // RCON_PORT: '',
        // RCON_PASSWORD: '',
        // MYSQL_HOST: '',
        // MYSQL_PORT: '',
        // MYSQL_USER: '',
        // MYSQL_PASSWORD: '',
        // MYSQL_DB: '',
        // WEBHOOK_PORT: '',
        // WEBHOOK_SECRET: '',
        // CHANNEL_MINECRAFT_CHAT: '',
        // CHANNEL_SERVER_LOG: '',
        // CHANNEL_SERVER_STATUS: '',
        // CHANNEL_EVENTS: '',
        // CHANNEL_POLLS: '',
        // STAFF_ROLE_IDS: '',
        NODE_ENV: 'production',
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
      listen_timeout: 3000,
    },
  ],
};
