const express = require('express');
const { config } = require('../config');
const { chatMessageEmbed, playerEventEmbed, advancementEmbed, serverEventEmbed } = require('../utils/embeds');

let client = null;

/**
 * Initialize the Express webhook server to receive DiscordSRV payloads.
 * @param {import('discord.js').Client} discordClient
 */
function init(discordClient) {
  client = discordClient;
  const app = express();

  app.use(express.json());

  // Webhook secret validation middleware
  app.use((req, res, next) => {
    if (config.webhook.secret) {
      const token = req.headers['x-webhook-secret'] || req.query.secret;
      if (token !== config.webhook.secret) {
        return res.status(403).json({ error: 'Invalid webhook secret' });
      }
    }
    next();
  });

  /**
   * DiscordSRV webhook endpoint.
   * Expected JSON payload structure (DiscordSRV):
   * {
   *   "channel": "global",          // or "advancement", "death", "join", "leave"
   *   "username": "Steve",
   *   "message": "Hello everyone!",
   *   "type": "chat"                // or "join", "leave", "death", "advancement", "start", "stop"
   * }
   */
  app.post('/srvchat', async (req, res) => {
    try {
      const payload = req.body;
      if (!payload) {
        return res.status(400).json({ error: 'Empty payload' });
      }

      const { channel, username, message, type } = payload;

      // Determine what kind of event this is
      const eventType = type || channel || 'chat';

      switch (eventType) {
        case 'chat':
        case 'global':
          await relayMessage('minecraftChat', chatMessageEmbed(username, message));
          break;

        case 'join':
          await relayMessage('serverLog', playerEventEmbed(username, 'join'));
          break;

        case 'leave':
          await relayMessage('serverLog', playerEventEmbed(username, 'leave'));
          break;

        case 'death':
          await relayMessage('serverLog', playerEventEmbed(username || message, 'death'));
          break;

        case 'advancement': {
          // DiscordSRV sends: { "username": "Steve", "message": "advancement_title", "advancement": "title" }
          const advTitle = payload.advancement || message || 'Unknown Advancement';
          const advDescription = payload.description || '';
          await relayMessage('serverLog', advancementEmbed(username, advTitle, advDescription));
          break;
        }

        case 'start':
          await relayMessage('serverStatus', serverEventEmbed('start'));
          break;

        case 'stop':
          await relayMessage('serverStatus', serverEventEmbed('stop'));
          break;

        default:
          // Unknown type — try to relay as chat
          await relayMessage('minecraftChat', chatMessageEmbed(username || 'Server', message || JSON.stringify(payload)));
      }

      res.json({ status: 'ok' });
    } catch (err) {
      console.error('[Webhook] Error processing payload:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  const port = config.webhook.port || 3000;
  app.listen(port, () => {
    console.log(`[Webhook] DiscordSRV receiver listening on port ${port}`);
  });
}

/**
 * Send an embed to a configured channel.
 */
async function relayMessage(channelKey, embed) {
  const channelId = config.channels[channelKey];
  if (!channelId) {
    console.warn(`[Webhook] Channel "${channelKey}" not configured — skipping message.`);
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error(`[Webhook] Failed to send to channel ${channelId}:`, err.message);
  }
}

module.exports = { init };
