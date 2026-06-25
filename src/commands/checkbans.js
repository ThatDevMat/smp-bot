/**
 * /checkbans — Query AdvancedBans for active punishments.
 *
 * Staff-only.  Accepts a Minecraft username or UUID, resolves it via
 * the Mojang API if needed, then queries the AdvancedBans MySQL DB.
 */

const { SlashCommandBuilder } = require('discord.js');
const advancedbans = require('../integrations/advancedbans');
const { requireStaff } = require('../utils/permissions');
const { resolvePlayer } = require('../utils/playerResolver');
const { activePunishmentsEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkbans')
    .setDescription('Check active punishments for a player (staff only)')
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

      const punishments = await advancedbans.getActivePunishments(player.uuid);

      if (punishments.length === 0) {
        return interaction.editReply({
          content: `\u2705 \`${player.username}\` has no active punishments.`,
        });
      }

      const embed = activePunishmentsEmbed(player.username, punishments);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Checkbans query failed', {
        player: input,
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
