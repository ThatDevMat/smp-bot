/**
 * /history — Full punishment history from AdvancedBans.
 *
 * Staff-only. Shows the last 100 entries (capped in the SQL query).
 */

const { SlashCommandBuilder } = require('discord.js');
const advancedbans = require('../integrations/advancedbans');
const { requireStaff } = require('../utils/permissions');
const { resolvePlayer } = require('../utils/playerResolver');
const { punishmentHistoryEmbed } = require('../utils/embeds');

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

      const history = await advancedbans.getPunishmentHistory(player.uuid);

      if (history.length === 0) {
        return interaction.editReply({
          content: `\u{1F4DD} \`${player.username}\` has no punishment history.`,
        });
      }

      const embed = punishmentHistoryEmbed(player.username, history);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(
        `[History] Error for ${input} (user ${interaction.user.tag}): ${err.message}`,
      );
      await interaction.editReply({
        content:
          '\u274C Could not query the punishment database. Is the AdvancedBans MySQL server reachable?',
      });
    }
  },
};
