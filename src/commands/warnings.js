/**
 * /warnings — View local warning history.
 *
 * Staff-only.  Reads from SQLite (not AdvancedBans).
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { resolvePlayer } = require('../utils/playerResolver');
const { localWarningsEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warning history for a player (staff only)')
    .addStringOption((opt) =>
      opt
        .setName('player')
        .setDescription('Minecraft username or UUID')
        .setRequired(true),
    ),

  async execute(interaction) {
    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const input = interaction.options.getString('player');

    try {
      const player = await resolvePlayer(input);
      if (!player) {
        return interaction.editReply({
          content: `\u274C Could not find Minecraft account "${input}".`,
        });
      }

      const warnings = db.getWarningsByUuid(player.uuid);

      if (warnings.length === 0) {
        return interaction.editReply({
          content: `\u2705 \`${player.username}\` has no local warnings.`,
        });
      }

      const embed = localWarningsEmbed(player.username, warnings);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Warnings lookup failed', {
        player: input,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      await interaction.editReply({
        content: '\u274C An error occurred while looking up warnings.',
      });
    }
  },
};
