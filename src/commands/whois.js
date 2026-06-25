/**
 * /whois — Look up a Discord user's registered Minecraft account.
 *
 * Input validated through Zod before database access.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { whoisEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { WhoisInput } = require('../schemas/players');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whois')
    .setDescription("Look up a player's registered Minecraft account")
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('The Discord user to look up')
        .setRequired(true),
    ),

  async execute(interaction) {
    // 1. Validate input from the user option.
    const targetUser = interaction.options.getUser('user');
    const rawInput = {
      user: targetUser ? targetUser.id : null,
    };

    let input;
    try {
      input = validateInput(WhoisInput, rawInput);
    } catch (err) {
      return interaction.reply({
        content: `\u274C ${err.userMessage}`,
        ephemeral: true,
      });
    }

    try {
      const registration = db.getPlayerByDiscord(input.user);

      if (!registration) {
        return interaction.reply({
          content:
            `\u274C <@${input.user}> has not registered a Minecraft account yet. ` +
            'Use `/register` to link one.',
          ephemeral: true,
        });
      }

      const embed = whoisEmbed(registration);
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Whois lookup error', {
        targetId: input.user,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      await interaction.reply({
        content: '\u274C An error occurred while looking up that user.',
        ephemeral: true,
      });
    }
  },
};
