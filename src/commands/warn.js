/**
 * /warn — Issue a local warning (Discord-side tracking).
 *
 * Staff-only.  Stores the warning in SQLite.  If the target has linked
 * their Discord account via /register, sends a DM notification.
 * All inputs validated through Zod before processing.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { resolvePlayer } = require('../utils/playerResolver');
const { warningIssuedEmbed, warningDmEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { WarnInput } = require('../schemas/moderation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a player (staff only)')
    .addStringOption((opt) =>
      opt
        .setName('player')
        .setDescription('Minecraft username or UUID')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true),
    ),

  async execute(interaction) {
    // 1. Validate input before any business logic.
    const rawInput = {
      player: interaction.options.getString('player'),
      reason: interaction.options.getString('reason'),
    };

    let input;
    try {
      input = validateInput(WarnInput, rawInput);
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

      // Check if the player has linked a Discord account.
      const registration = db.getPlayerByUuid(player.uuid);

      db.addWarning({
        playerUuid: player.uuid,
        discordId: registration ? registration.discord_id : null,
        reason: input.reason,
        issuedBy: interaction.user.id,
      });

      const embed = warningIssuedEmbed(
        player.username,
        player.uuid,
        input.reason,
        interaction.user.id,
      );
      await interaction.editReply({ embeds: [embed] });

      // DM the linked Discord user if registered.
      if (registration) {
        try {
          const warnedUser = await interaction.client.users.fetch(
            registration.discord_id,
          );
          if (warnedUser) {
            await warnedUser.send({
              embeds: [warningDmEmbed(player.username, input.reason)],
            });
          }
        } catch (dmErr) {
          logger.warn('Could not DM user about warning', {
            discordId: registration.discord_id,
            error: dmErr.message,
          });
        }
      }
    } catch (err) {
      logger.error('Warn command error', {
        player: input.player,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      await interaction.editReply({
        content: '\u274C An error occurred while issuing the warning.',
      });
    }
  },
};
