/**
 * /whitelist — Manage Minecraft server whitelist via RCON.
 *
 * Both subcommands are staff-only. User-supplied usernames are
 * validated against the Minecraft format before being sent to RCON
 * to prevent command injection.
 */

const { SlashCommandBuilder } = require('discord.js');
const rcon = require('../integrations/rcon');
const { requireStaff } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage Minecraft server whitelist (staff only)')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a player to the whitelist')
        .addStringOption((opt) =>
          opt
            .setName('username')
            .setDescription('Minecraft username')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a player from the whitelist')
        .addStringOption((opt) =>
          opt
            .setName('username')
            .setDescription('Minecraft username')
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const username = interaction.options.getString('username');

    try {
      let response;
      if (subcommand === 'add') {
        response = await rcon.whitelistAdd(username);
      } else {
        response = await rcon.whitelistRemove(username);
      }

      await interaction.editReply({
        content: `\u2705 \`${username}\` ${subcommand === 'add' ? 'added to' : 'removed from'} the whitelist.\n\`\`\`${response}\`\`\``,
      });
    } catch (err) {
      logger.error('Whitelist command error', {
        subcommand,
        username,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      await interaction.editReply({
        content:
          '\u274C Could not modify the whitelist. Check RCON connection and try again.',
      });
    }
  },
};
