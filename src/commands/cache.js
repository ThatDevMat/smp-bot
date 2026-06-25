/**
 * /cache — View and manage the in-memory API cache.
 *
 * Shows cache statistics (hits, misses, keys, server status TTL) and
 * provides a flush subcommand to clear all cached values.  Staff-only.
 */

const { SlashCommandBuilder } = require('discord.js');
const { requireStaff } = require('../utils/permissions');
const cache = require('../utils/cache');
const { cacheStatsEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cache')
    .setDescription('View or manage the in-memory API cache')
    .addSubcommand((sub) =>
      sub
        .setName('stats')
        .setDescription('Show current cache statistics'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('flush')
        .setDescription('Clear all cached values (staff only)'),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'stats') {
      const stats = cache.getStats();
      const ttl = cache.getStatusTtl();

      const embed = cacheStatsEmbed({
        hits: stats.hits,
        misses: stats.misses,
        keys: stats.keys,
        statusTtlRemaining: ttl,
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // flush subcommand — staff only
    if (!requireStaff(interaction)) {
      await interaction.reply({
        content: '\u26D4 You do not have permission to flush the cache.',
        ephemeral: true,
      });
      return;
    }

    cache.flushAll();
    logger.info('Cache flushed manually', {
      userId: interaction.user.id,
    });

    await interaction.reply({
      content: '\u2705 Cache has been cleared.',
      ephemeral: true,
    });
  },
};
