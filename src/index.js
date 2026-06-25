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
 *
 * Global error handlers catch unhandled promise rejections and
 * forward them to the logging system so the bot never silently crashes.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const cron = require('node-cron');

const { config, validateConfig } = require('./config');
const rcon = require('./integrations/rcon');
const db = require('./db');
const discordsrv = require('./webhooks/discordsrv');

/* ------------------------------------------------------------------ */
/*  Global error handlers                                              */
/* ------------------------------------------------------------------ */

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
  // Let the process exit naturally — the PM2 / Docker supervisor
  // will restart it.
});

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
    console.log(`[Commands] Loaded /${command.data.name}`);
  } else {
    console.warn(`[Commands] Skipped ${file}: missing "data" or "execute"`);
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
  console.log(`[Events] Loaded ${event.name}`);
}

/* ------------------------------------------------------------------ */
/*  Startup                                                            */
/* ------------------------------------------------------------------ */

(async () => {
  try {
    // RCON — non-fatal; commands will retry on demand.
    await rcon.connect();

    // Express webhook receiver.
    discordsrv.init(client);

    // Discord login.
    await client.login(config.bot.token);

    // Event reminder scheduler (every 30 minutes).
    cron.schedule('*/30 * * * *', () => {
      checkEventReminders(client);
    });

    console.log('[Cron] Event reminder scheduler started (every 30min)');
    console.log('[Bot] Initialization complete.');
  } catch (err) {
    console.error('[Bot] Startup error:', err);
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
    const eventDateTime = new Date(`${event.event_date}T${event.event_time}:00`);

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
            `\u23F0 **Reminder:** "${event.name}" is starting in about **24 hours** ` +
            `(${event.event_date} at ${event.event_time} ${event.timezone})!`,
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
            `\u{1F514} **Starting Soon:** "${event.name}" is starting in about **1 hour**! ` +
            `(${rsvpCount} attending)`,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Graceful shutdown                                                  */
/* ------------------------------------------------------------------ */

function shutdown(signal) {
  console.log(`\n[Bot] ${signal} received. Shutting down...`);
  rcon.disconnect().catch(() => {});
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
