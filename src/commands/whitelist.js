/**
 * /whitelist — Manage Minecraft server whitelist via RCON.
 *
 * Both subcommands are staff-only. User-supplied usernames are
 * validated against the Minecraft format via Zod before being sent
 * to RCON to prevent command injection.
 */

const { SlashCommandBuilder } = require('discord.js');
const rcon = require('../integrations/rcon');
const { requireStaff } = require('../utils/permissions');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { WhitelistInput } = require('../schemas/players');

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
    // 1. Validate input.
    const rawInput = {
      username: interaction.options.getString('username'),
    };

    let input;
    try {
      input = validateInput(WhitelistInput, rawInput);
    } catch (err) {
      return interaction.reply({
        content: `\u274C ${err.userMessage}`,
        ephemeral: true,
      });
    }

    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    try {
      let response;
      if (subcommand === 'add') {
        response = await rcon.whitelistAdd(input.username);
      } else {
        response = await rcon.whitelistRemove(input.username);
      }

      await interaction.editReply({
        content: `\u2705 \`${input.username}\` ${subcommand === 'add' ? 'added to' : 'removed from'} the whitelist.\n\`\`\`${response}\`\`\``,
      });
    } catch (err) {
      logger.error('Whitelist command error', {
        subcommand,
        username: input.username,
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
