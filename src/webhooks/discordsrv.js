/**
 * DiscordSRV webhook (Express) receiver.
 *
 * Listens for HTTP POST payloads from the DiscordSRV Minecraft plugin
 * and relays them to the appropriate Discord text channels as rich
 * embeds.
 *
 * Incoming payloads are validated against a Zod discriminated union
 * before any field is accessed.  Invalid payloads return 400 with a
 * flattened error report and are logged at debug level.
 */

const express = require('express');
const morgan = require('morgan');
const { config } = require('../config');
const logger = require('../utils/logger');
const {
  chatMessageEmbed,
  playerEventEmbed,
  advancementEmbed,
  serverEventEmbed,
} = require('../utils/embeds');
const { validateInput } = require('../utils/validate');
const { DiscordSRVPayload } = require('../schemas/webhooks');

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

  // HTTP request logging via Morgan piped through Winston at 'http' level.
  app.use(
    morgan(':method :url :status :response-time ms - :remote-addr', {
      stream: {
        write: (message) => logger.http(message.trim()),
      },
    }),
  );

  // Warn operators if the webhook secret is left empty.
  if (!config.webhook.secret) {
    logger.warn(
      'WEBHOOK_SECRET is not set \u2014 anyone who knows your server address can POST to /srvchat',
    );
  }

  // Health-check endpoint (no auth required).
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
      // Validate the payload immediately after parsing.
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      // Normalize legacy DiscordSRV format: { channel: 'global', ... }
      // rather than { type: 'chat', ... } so Zod's discriminatedUnion can
      // parse it.
      const bodyToValidate = { ...req.body };
      if (bodyToValidate.channel === 'global' && !bodyToValidate.type) {
        bodyToValidate.type = 'chat';
      }

      let payload;
      try {
        payload = validateInput(DiscordSRVPayload, bodyToValidate);
      } catch (err) {
        // validateInput always throws ValidationError — ZodErrors are
        // caught and wrapped internally.
        logger.debug('Invalid webhook payload received', {
          raw: req.body,
          error: err.zodError,
        });
        return res.status(400).json({
          error: 'Invalid payload',
          details: err.zodError.flatten(),
        });
      }

      switch (payload.type) {
        case 'chat':
          await relayMessage(
            'minecraftChat',
            chatMessageEmbed(payload.username, payload.message),
          );
          break;

        case 'join':
          await relayMessage(
            'serverLog',
            playerEventEmbed(payload.username, 'join'),
          );
          break;

        case 'leave':
          await relayMessage(
            'serverLog',
            playerEventEmbed(payload.username, 'leave'),
          );
          break;

        case 'death':
          await relayMessage(
            'serverLog',
            playerEventEmbed(payload.username || payload.message, 'death'),
          );
          break;

        case 'advancement': {
          const advTitle =
            payload.advancementTitle ||
            payload.advancement ||
            payload.message ||
            'Unknown Advancement';
          const advDescription =
            payload.advancementDescription || payload.description || '';
          await relayMessage(
            'serverLog',
            advancementEmbed(payload.username, advTitle, advDescription),
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
          await relayMessage(
            'minecraftChat',
            chatMessageEmbed(
              payload.username || 'Server',
              payload.message || JSON.stringify(payload),
            ),
          );
      }

      res.json({ status: 'ok' });
    } catch (err) {
      // Log the full error internally but never expose details to callers.
      logger.error('DiscordSRV webhook error processing payload', {
        error: err.message,
        stack: err.stack,
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const port = config.webhook.port || 3000;
  const server = app.listen(port, () => {
    logger.info('DiscordSRV webhook receiver started', {
      port,
      secretConfigured: !!config.webhook.secret,
    });
  });

  return server;
}

/**
 * Send an embed to one of the configured Discord channels.
 */
async function relayMessage(channelKey, embed) {
  const channelId = config.channels[channelKey];

  if (!channelId) {
    logger.info(
      `DiscordSRV channel "${channelKey}" not configured \u2014 skipping message`,
    );
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    logger.error('Failed to send webhook message to Discord channel', {
      channelId,
      error: err.message,
      stack: err.stack,
    });
  }
}

module.exports = { init, getApp: () => app };
