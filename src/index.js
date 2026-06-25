require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const cron = require('node-cron');

const { config, validateConfig } = require('./config');
const rcon = require('./integrations/rcon');
const db = require('./db');
const discordsrv = require('./webhooks/discordsrv');

// Validate required config
validateConfig();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Command collection
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`[Commands] Loaded /${command.data.name}`);
  } else {
    console.warn(`[Commands] Skipped ${file}: missing "data" or "execute"`);
  }
}

// Load event handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`[Events] Loaded ${event.name}`);
}

// ---- Startup ----
(async () => {
  try {
    // Connect RCON
    await rcon.connect();

    // Initialize webhook receiver (Express)
    discordsrv.init(client);

    // Login to Discord
    await client.login(config.bot.token);

    // ---- Cron Jobs ----
    // Check for event reminders every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await checkEventReminders(client);
    });

    console.log('[Cron] Event reminder scheduler started (every 30min)');
    console.log('[Bot] Initialization complete.');
  } catch (err) {
    console.error('[Bot] Startup error:', err);
    process.exit(1);
  }
})();

/**
 * Check upcoming events and send reminders.
 * Runs every 30 minutes. Events within 24h get a 24h reminder.
 * Events within 1h get a 1h reminder. Avoids re-sending.
 */
async function checkEventReminders(discordClient) {
  const events = db.getUpcomingEvents();
  if (events.length === 0) return;

  const now = new Date();

  for (const event of events) {
    const eventDateTime = new Date(`${event.event_date}T${event.event_time}:00`);

    // Skip past events
    if (eventDateTime <= now) continue;

    const diffMs = eventDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const eventsChannel = config.channels.events
      ? discordClient.channels.cache.get(config.channels.events)
      : null;

    if (!eventsChannel) continue;

    // Send 24h reminder (between 23.5h and 24.5h away)
    if (diffHours >= 23 && diffHours <= 24.5) {
      if (!event._reminded24h) {
        await eventsChannel.send({
          content: `⏰ **Reminder:** "${event.name}" is starting in about **24 hours** (${event.event_date} at ${event.event_time} ${event.timezone})!`,
        });
        event._reminded24h = true;
      }
    }

    // Send 1h reminder (between 0.5h and 1.5h away)
    if (diffHours >= 0.5 && diffHours <= 1.5) {
      if (!event._reminded1h) {
        const rsvpCount = db.getRsvpCount(event.id);
        await eventsChannel.send({
          content: `🔔 **Starting Soon:** "${event.name}" is starting in about **1 hour**! (${rsvpCount} attending)`,
        });
        event._reminded1h = true;
      }
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Bot] Shutting down...');
  await rcon.disconnect();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Bot] Shutting down...');
  await rcon.disconnect();
  client.destroy();
  process.exit(0);
});
