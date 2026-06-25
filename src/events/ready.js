/**
 * Discord.js event: ClientReady.
 *
 * Logs successful login and sets the bot's "Playing" status.
 */

const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info('Bot logged in', { userTag: client.user.tag });
    client.user.setActivity('Minecraft SMP', { type: 'PLAYING' });
  },
};
