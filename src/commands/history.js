/**
 * /history — Full punishment history from AdvancedBans.
 *
 * Staff-only. Shows the last 100 entries (capped in the SQL query).
 * Input validated through Zod before processing.
 */

const { SlashCommandBuilder } = require('discord.js');
const advancedbans = require('../integrations/advancedbans');
const { requireStaff } = require('../utils/permissions');
const { resolvePlayer } = require('../utils/playerResolver');
const { punishmentHistoryEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { CheckPunishmentsInput } = require('../schemas/moderation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show full punishment history for a player (staff only)')
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

      const history = await advancedbans.getPunishmentHistory(player.uuid);

      if (history.length === 0) {
        return interaction.editReply({
          content: `\u{1F4DD} \`${player.username}\` has no punishment history.`,
        });
      }

      const embed = punishmentHistoryEmbed(player.username, history);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('History query failed', {
        player: input.player,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      await interaction.editReply({
        content:
          '\u274C Could not query the punishment database. Is the AdvancedBans MySQL server reachable?',
      });
    }
  },
};
