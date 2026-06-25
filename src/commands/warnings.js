/**
 * /warnings — View local warning history.
 *
 * Staff-only.  Reads from SQLite (not AdvancedBans).
 * Input validated through Zod before processing.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { resolvePlayer } = require('../utils/playerResolver');
const { localWarningsEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { CheckPunishmentsInput } = require('../schemas/moderation');

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
    // 1. Validate input.
    const rawInput = {
      player: interaction.options.getString('player'),
    };

    let input;
    try {
      input = validateInput(CheckPunishmentsInput, rawInput);
    } catch (err) {
      return interaction.reply({
        content: `\u274C ${err.userMessage}`,
        ephemeral: true,
      });
    }

    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const player = await resolvePlayer(input.player);
      if (!player) {
        return interaction.editReply({
          content: `\u274C Could not find Minecraft account "${input.player}".`,
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
        player: input.player,
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
