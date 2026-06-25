/**
 * /warn — Issue a local warning (Discord-side tracking).
 *
 * Staff-only.  Stores the warning in SQLite.  If the target has linked
 * their Discord account via /register, sends a DM notification.
 * Warnings are independent of AdvancedBans.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { resolvePlayer } = require('../utils/playerResolver');
const { warningIssuedEmbed, warningDmEmbed } = require('../utils/embeds');

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
    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const input = interaction.options.getString('player');
    const reason = interaction.options.getString('reason');

    try {
      const player = await resolvePlayer(input);
      if (!player) {
        return interaction.editReply({
          content: `\u274C Could not find Minecraft account "${input}".`,
        });
      }

      // Check if the player has linked a Discord account.
      const registration = db.getPlayerByUuid(player.uuid);

      db.addWarning({
        playerUuid: player.uuid,
        discordId: registration ? registration.discord_id : null,
        reason,
        issuedBy: interaction.user.id,
      });

      const embed = warningIssuedEmbed(
        player.username,
        player.uuid,
        reason,
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
              embeds: [warningDmEmbed(player.username, reason)],
            });
          }
        } catch (dmErr) {
          // DM can fail if the user has DMs disabled or the bot is blocked.
          console.warn(
            `[Warn] Could not DM user ${registration.discord_id}: ${dmErr.message}`,
          );
        }
      }
    } catch (err) {
      console.error(
        `[Warn] Error for ${input} (user ${interaction.user.tag}): ${err.message}`,
      );
      await interaction.editReply({
        content: '\u274C An error occurred while issuing the warning.',
      });
    }
  },
};
