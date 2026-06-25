/**
 * /backup — Trigger an immediate database backup (staff only).
 *
 * Runs the full backup cycle (hot backup → compress → prune) and
 * replies with an ephemeral embed showing the result.
 */

const { SlashCommandBuilder } = require('discord.js');
const { requireStaff } = require('../utils/permissions');
const { runBackup } = require('../utils/backup');
const { backupResultEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Trigger an immediate database backup (staff only)'),

  async execute(interaction) {
    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await runBackup();
      const embed = backupResultEmbed(result);
      await interaction.editReply({ embeds: [embed] });
      logger.info('Manual backup completed via /backup', {
        userId: interaction.user.id,
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
        durationMs: result.durationMs,
      });
    } catch (err) {
      logger.error('Manual backup failed via /backup', {
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      await interaction.editReply({
        content: '\\u274C Backup failed. Check the bot logs for details.',
      });
    }
  },
};
