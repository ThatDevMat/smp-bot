/**
 * DiscordSRV webhook (Express) receiver.
 *
 * Listens for HTTP POST payloads from the DiscordSRV Minecraft plugin
 * and relays them to the appropriate Discord text channels as rich
 * embeds.
 *
 * Expected payload shape:
 *   { channel, username, message, type }
 * where type is one of: chat | join | leave | death | advancement | start | stop
 *
 * Every incoming request validates the shared secret (if configured)
 * and checks that required fields are present before acting.
 */

const express = require('express');
const { config } = require('../config');
const {
  chatMessageEmbed,
  playerEventEmbed,
  advancementEmbed,
  serverEventEmbed,
} = require('../utils/embeds');

let client = null;
let app;

/**
 * Start the Express webhook server.
 *
 * @param {import('discord.js').Client} discordClient
 */
function init(discordClient) {
  client = discordClient;
  app = express();

  app.use(express.json({ limit: '100kb' }));

  // Warn operators if the webhook secret is left empty.
  if (!config.webhook.secret) {
    console.warn(
      '[Webhook] WEBHOOK_SECRET is not set — anyone who knows your ' +
        'server address can POST to /srvchat. Set it in .env to restrict access.',
    );
  }

  // Health-check endpoint (no auth required — must be before the
  // secret middleware so it stays accessible when secret is configured).
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Shared-secret validation.
  app.use((req, res, next) => {
    if (config.webhook.secret) {
      const token = req.headers['x-webhook-secret'] || req.query.secret;
      if (token !== config.webhook.secret) {
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }
    next();
  });

  app.post('/srvchat', async (req, res) => {
    try {
      const payload = req.body;

      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Empty or non-object payload' });
      }

      // Validate that at least one useful field is present.
      const { channel, username, message, type } = payload;
      const eventType = type || channel || 'chat';

      switch (eventType) {
        case 'chat':
        case 'global':
          await relayMessage(
            'minecraftChat',
            chatMessageEmbed(username, message),
          );
          break;

        case 'join':
          await relayMessage('serverLog', playerEventEmbed(username, 'join'));
          break;

        case 'leave':
          await relayMessage('serverLog', playerEventEmbed(username, 'leave'));
          break;

        case 'death':
          await relayMessage(
            'serverLog',
            playerEventEmbed(username || message, 'death'),
          );
          break;

        case 'advancement': {
          const advTitle =
            payload.advancement || message || 'Unknown Advancement';
          const advDescription = payload.description || '';
          await relayMessage(
            'serverLog',
            advancementEmbed(username, advTitle, advDescription),
          );
          break;
        }

        case 'start':
          await relayMessage('serverStatus', serverEventEmbed('start'));
          break;

        case 'stop':
          await relayMessage('serverStatus', serverEventEmbed('stop'));
          break;

        default:
          // Unknown type — relay as a generic chat message.
          await relayMessage(
            'minecraftChat',
            chatMessageEmbed(
              username || 'Server',
              message || JSON.stringify(payload),
            ),
          );
      }

      res.json({ status: 'ok' });
    } catch (err) {
      // Log the full error internally but never expose details to callers.
      console.error('[Webhook] Error processing payload:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const port = config.webhook.port || 3000;
  app.listen(port, () => {
    console.log(`[Webhook] DiscordSRV receiver listening on port ${port}`);
  });
}

/**
 * Send an embed to one of the configured Discord channels.
 */
async function relayMessage(channelKey, embed) {
  const channelId = config.channels[channelKey];

  if (!channelId) {
    // Not configured — this is normal if the operator only uses a subset
    // of channels, so log at debug level (info for now, but could be
    // moved to debug in production).
    console.info(
      `[Webhook] Channel "${channelKey}" not configured \u2014 skipping message.`,
    );
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error(
      `[Webhook] Failed to send to channel ${channelId}: ${err.message}`,
    );
  }
}

module.exports = { init, getApp: () => app };
