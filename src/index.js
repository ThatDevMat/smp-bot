/**
 * SMP Bot — entry point.
 *
 * Boot sequence:
 *   1. Validate required environment variables.
 *   2. Create Discord client with the necessary intents.
 *   3. Load every command file in src/commands/ into a Collection.
 *   4. Load every event handler file in src/events/.
 *   5. Connect RCON (non-fatal on failure).
 *   6. Start the DiscordSRV webhook (Express) server.
 *   7. Log in to Discord.
 *   8. Start the cron-based event reminder scheduler.
 *   9. Register graceful shutdown handlers.
 *  10. Signal PM2 that the process is ready.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const cron = require('node-cron');

const { config, validateConfig } = require('./config');
const logger = require('./utils/logger');
const rcon = require('./integrations/rcon');
const advancedbans = require('./integrations/advancedbans');
const db = require('./db');
const discordsrv = require('./webhooks/discordsrv');
const { registerShutdownHandlers } = require('./utils/shutdown');
const { runBackup } = require('./utils/backup');

/* ------------------------------------------------------------------ */
/*  Validate environment                                               */
/* ------------------------------------------------------------------ */

validateConfig();

/* ------------------------------------------------------------------ */
/*  Discord client setup                                               */
/* ------------------------------------------------------------------ */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();

/* ------------------------------------------------------------------ */
/*  Load commands                                                      */
/* ------------------------------------------------------------------ */

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    logger.info('Command loaded', { command: command.data.name });
  } else {
    logger.warn('Command file skipped — missing "data" or "execute"', { file });
  }
}

/* ------------------------------------------------------------------ */
/*  Load event handlers                                                */
/* ------------------------------------------------------------------ */

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  logger.info('Event handler loaded', { event: event.name });
}

/* ------------------------------------------------------------------ */
/*  Startup                                                            */
/* ------------------------------------------------------------------ */

let httpServer;

(async () => {
  try {
    // RCON — non-fatal; commands will retry on demand.
    await rcon.connect();

    // Express webhook receiver.
    httpServer = discordsrv.init(client);

    // Discord login.
    await client.login(config.bot.token);

    // Event reminder scheduler (every 30 minutes).
    cron.schedule('*/30 * * * *', () => {
      checkEventReminders(client);
    });
    logger.info('Event reminder scheduler started', { interval: '30min' });

    // Backup scheduler (daily at configured cron time).
    logger.info('Backup scheduler started', { cron: config.backup.cron });
    cron.schedule(config.backup.cron, () => {
      runBackup().catch((err) =>
        logger.error('Scheduled backup failed', {
          error: err.message,
          stack: err.stack,
        }),
      );
    });

    // Run one backup immediately after startup.
    runBackup().catch((err) =>
      logger.error('Startup backup failed', {
        error: err.message,
        stack: err.stack,
      }),
    );

    logger.info('Bot initialization complete');

    // Graceful shutdown — pass live instances.
    registerShutdownHandlers({
      httpServer,
      discordClient: client,
      rcon,
      mysql: advancedbans,
      sqlite: db.getDb(),
    });

    // Signal PM2 that the process is ready.
    if (process.send) {
      process.send('ready');
    }
  } catch (err) {
    logger.error('Bot startup error', { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();

/* ------------------------------------------------------------------ */
/*  Event reminders                                                    */
/* ------------------------------------------------------------------ */

/**
 * Track which reminders have already been sent in this process
 * lifetime so they don't fire repeatedly on every cron tick.
 * Keys:  "${eventId}-24h"  /  "${eventId}-1h"
 */
const sentReminders = new Set();

/**
 * Check upcoming events and send reminder notifications.
 * Runs every 30 minutes via node-cron.
 *
 * Reminder schedule:
 *   - ~24 hours before → "starting in 24 hours" message
 *   - ~1 hour before   → "starting soon" message + RSVP count
 */
async function checkEventReminders(discordClient) {
  const events = db.getUpcomingEvents();
  if (events.length === 0) return;

  const now = new Date();
  const eventsChannel = config.channels.events
    ? discordClient.channels.cache.get(config.channels.events)
    : null;

  if (!eventsChannel) return;

  for (const event of events) {
    const eventDateTime = new Date(
      `${event.event_date}T${event.event_time}:00`,
    );

    // Skip events that have already passed.
    if (eventDateTime <= now) continue;

    const diffMs = eventDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // 24-hour reminder (window: 23.0 – 24.5 hours before).
    if (diffHours >= 23 && diffHours <= 24.5) {
      const key = `${event.id}-24h`;
      if (!sentReminders.has(key)) {
        sentReminders.add(key);
        await eventsChannel.send({
          content:
            `\\u23F0 **Reminder:** "${event.name}" is starting in about **24 hours** ` +
            `(${event.event_date} at ${event.event_time} ${event.timezone})!`,
        });
        logger.info('Sent 24h event reminder', {
          eventId: event.id,
          eventName: event.name,
        });
      }
    }

    // 1-hour reminder (window: 0.5 – 1.5 hours before).
    if (diffHours >= 0.5 && diffHours <= 1.5) {
      const key = `${event.id}-1h`;
      if (!sentReminders.has(key)) {
        sentReminders.add(key);
        const rsvpCount = db.getRsvpCount(event.id);
        await eventsChannel.send({
          content:
            `\\u{1F514} **Starting Soon:** "${event.name}" is starting in about **1 hour**! ` +
            `(${rsvpCount} attending)`,
        });
        logger.info('Sent 1h event reminder', {
          eventId: event.id,
          eventName: event.name,
          rsvpCount,
        });
      }
    }
  }
}
