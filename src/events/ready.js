/**
 * Discord.js event: ClientReady.
 *
 * Logs successful login and sets the bot's "Playing" status.
 */

const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`\u2705 Bot logged in as ${client.user.tag}`);
    client.user.setActivity('Minecraft SMP', { type: 'PLAYING' });
  },
};
