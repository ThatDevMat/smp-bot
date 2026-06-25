/**
 * /register — Link a Discord account to a Minecraft username.
 *
 * All inputs validated through Zod before any API calls.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const mojang = require('../integrations/mojang');
const { registrationEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { RegisterInput } = require('../schemas/players');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Link your Discord account to your Minecraft username')
    .addStringOption((opt) =>
      opt
        .setName('minecraft_username')
        .setDescription('Your Minecraft username')
        .setRequired(true),
    ),

  async execute(interaction) {
    // 1. Validate input before any business logic.
    const rawInput = {
      minecraftUsername: interaction.options.getString('minecraft_username'),
    };

    let input;
    try {
      input = validateInput(RegisterInput, rawInput);
    } catch (err) {
      return interaction.reply({
        content: `\u274C ${err.userMessage}`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const profile = await mojang.getUuidByUsername(input.minecraftUsername);

      if (!profile) {
        return interaction.editReply({
          content:
            `\u274C Could not find a Minecraft account with the username "${input.minecraftUsername}". ` +
            'Make sure you typed it correctly and the account exists.',
        });
      }

      db.registerPlayer(interaction.user.id, profile.username, profile.uuid);

      const embed = registrationEmbed(profile, interaction.user.id);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Mojang API error during registration', {
        username: input.minecraftUsername,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      await interaction.editReply({
        content:
          '\u274C Could not verify your Minecraft username right now. ' +
          'The Mojang API may be temporarily unavailable. Please try again later.',
      });
    }
  },
};
