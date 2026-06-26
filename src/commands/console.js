/**
 * /console — Send RCON commands to the Minecraft server (admin only).
 *
 * Validates the command against a blocklist of dangerous server-management
 * commands that should only be run via SSH. Sends the validated command via
 * RCON and returns the truncated output.
 */

const { SlashCommandBuilder } = require('discord.js');
const rcon = require('../integrations/rcon');
const { requireAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { ConsoleInput } = require('../schemas/moderation');
const { consoleResultEmbed } = require('../utils/embeds');
const { logAction } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('console')
    .setDescription('Send an RCON command to the Minecraft server (admin only)')
    .addStringOption((opt) =>
      opt
        .setName('command')
        .setDescription('Command to execute')
        .setRequired(true),
    ),

  async execute(interaction) {
    // 1. Permission check — admin only.
    if (!requireAdmin(interaction)) return;

    // 2. Validate input against Zod schema (blocks dangerous commands).
    const rawInput = {
      command: interaction.options.getString('command'),
    };

    let input;
    try {
      input = validateInput(ConsoleInput, rawInput);
    } catch (err) {
      return interaction.reply({
        content: `\\u274C ${err.userMessage}`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // 3. Send via RCON.
    try {
      const output = await rcon.send(input.command);

      // Truncate output for audit log.
      const truncatedOutput = (output || '').slice(0, 500);

      await logAction({
        client: interaction.client,
        type: 'console',
        staff: interaction.user,
        target: input.command,
        details: truncatedOutput || '(no output)',
      });

      const embed = consoleResultEmbed(input.command, output);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Console command error', {
        command: input.command,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      await interaction.editReply({
        content:
          '\\u274C Failed to execute console command. RCON may be disconnected.',
      });
    }
  },
};
