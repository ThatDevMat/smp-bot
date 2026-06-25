/**
 * /whois — Look up a Discord user's registered Minecraft account.
 *
 * Requires the target to have previously run /register.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { whoisEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Look up a player\'s registered Minecraft account')
    .addUserOption((opt) =>
      opt.setName('user')
        .setDescription('The Discord user to look up')
        .setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');

    try {
      const registration = db.getPlayerByDiscord(target.id);

      if (!registration) {
        return interaction.reply({
          content:
            `\u274C <@${target.id}> has not registered a Minecraft account yet. ` +
            'Use `/register` to link one.',
          ephemeral: true,
        });
      }

      const embed = whoisEmbed(registration);
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(`[Whois] Lookup error for ${target.tag}:`, err.message);
      await interaction.reply({
        content: '\u274C An error occurred while looking up that user.',
        ephemeral: true,
      });
    }
  },
};
