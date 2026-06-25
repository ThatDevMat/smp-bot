/**
 * /status — Server status.
 *
 * Tries RCON first for live player data, then supplements with
 * mcsrvstat.us for MOTD/version/uptime.  If RCON is unreachable,
 * falls back entirely to the public API.
 *
 * The mcsrvstat.us result is cached for 30 seconds.  If the cache
 * returns stale data (API unreachable) a footer warning is appended
 * to the embed.
 */

const { SlashCommandBuilder } = require('discord.js');
const rcon = require('../integrations/rcon');
const { fetchStatus } = require('../integrations/mcsrvstat');
const { statusEmbed } = require('../utils/embeds');
const { config } = require('../config');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription(
      'Show the Minecraft server status, player count, and online players',
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Primary path: live data via RCON.
      const rconData = await rcon.getOnlinePlayers();

      const embedData = {
        online: true,
        players: {
          online: rconData.count,
          max: rconData.max,
          list: rconData.players || [],
        },
      };

      // Supplement with public API metadata (non-critical — swallow failures).
      try {
        const meta = await fetchStatus(config.rcon.host);
        if (meta && meta.online) {
          embedData.version = meta.version;
          embedData.software = meta.software;
          embedData.motd = meta.motd;
          embedData.stale = meta.stale;
        }
      } catch {
        logger.debug('mcsrvstat.us supplement failed (non-fatal)');
      }

      const embed = statusEmbed(embedData);
      if (embedData.stale) {
        embed.setFooter({
          text: '\u26A0\uFE0F Server status may be outdated \u2014 API unreachable',
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      // RCON failed — full fallback to public API.
      logger.warn('RCON status failed, falling back to mcsrvstat.us', {
        error: err.message,
      });
      try {
        const mcsrvData = await fetchStatus(config.rcon.host);
        const embed = statusEmbed(mcsrvData);

        if (mcsrvData.stale) {
          embed.setFooter({
            text: '\u26A0\uFE0F Server status may be outdated \u2014 API unreachable',
          });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (fallbackErr) {
        logger.error('Both RCON and mcsrvstat.us failed', {
          rconError: err.message,
          fallbackError: fallbackErr.message,
          stack: fallbackErr.stack,
        });
        await interaction.editReply({
          content:
            '\u274C Could not fetch server status. Both RCON and the status API are unreachable.',
        });
      }
    }
  },
};
