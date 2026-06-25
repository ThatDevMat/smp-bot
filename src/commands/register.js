/**
 * /register — Link a Discord account to a Minecraft username.
 *
 * Resolves the username via the Mojang API and stores the mapping
 * in SQLite.  Subsequent lookups (/whois) and moderation actions
 * (DM notifications) rely on this registration.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const mojang = require('../integrations/mojang');
const { registrationEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');

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
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('minecraft_username');

    try {
      const profile = await mojang.getUuidByUsername(username);

      if (!profile) {
        return interaction.editReply({
          content:
            `\u274C Could not find a Minecraft account with the username "${username}". ` +
            'Make sure you typed it correctly and the account exists.',
        });
      }

      db.registerPlayer(interaction.user.id, profile.username, profile.uuid);

      const embed = registrationEmbed(profile, interaction.user.id);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Mojang API error during registration', {
        username,
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
