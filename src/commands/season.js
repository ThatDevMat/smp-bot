const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('season')
    .setDescription('View or set SMP season info')
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Show current season information'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set or update season info (staff only)')
        .addIntegerOption((opt) => opt.setName('number').setDescription('Season number').setRequired(true))
        .addStringOption((opt) => opt.setName('start_date').setDescription('Season start date (YYYY-MM-DD)').setRequired(true))
        .addStringOption((opt) => opt.setName('seed').setDescription('World seed').setRequired(false)),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'info') {
      const season = db.getCurrentSeason();

      if (!season) {
        return interaction.reply({
          content: '📅 No season data set yet. Use `/season set` to configure the current season.',
          ephemeral: true,
        });
      }

      const startDate = new Date(season.start_date);
      const today = new Date();
      const daysElapsed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`📅 Season ${season.season_number}`)
        .addFields(
          { name: 'Season', value: `#${season.season_number}`, inline: true },
          { name: 'Start Date', value: season.start_date, inline: true },
          { name: 'Days Elapsed', value: `${daysElapsed} days`, inline: true },
        )
        .setTimestamp();

      if (season.seed) {
        embed.addFields({ name: 'World Seed', value: `\`${season.seed}\``, inline: false });
      }

      await interaction.reply({ embeds: [embed] });
    }

    else if (subcommand === 'set') {
      if (!requireStaff(interaction)) return;

      const number = interaction.options.getInteger('number');
      const startDate = interaction.options.getString('start_date');
      const seed = interaction.options.getString('seed') || null;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return interaction.reply({ content: '❌ Start date must be in YYYY-MM-DD format.', ephemeral: true });
      }

      db.setSeason({ seasonNumber: number, startDate, seed });

      await interaction.reply({
        content: `✅ Season ${number} set (start: ${startDate}${seed ? `, seed: \`${seed}\`` : ''}).`,
        ephemeral: true,
      });
    }
  },
};
