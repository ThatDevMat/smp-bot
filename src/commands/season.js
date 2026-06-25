/**
 * /season — View or set SMP season information.
 *
 * Subcommands: info (public), set (staff only).
 * Season data is stored in SQLite.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { seasonInfoEmbed } = require('../utils/embeds');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('season')
    .setDescription('View or set SMP season info')
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('Show current season information'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set or update season info (staff only)')
        .addIntegerOption((opt) =>
          opt
            .setName('number')
            .setDescription('Season number')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('start_date')
            .setDescription('Season start date (YYYY-MM-DD)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('seed').setDescription('World seed').setRequired(false),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'info') {
        await handleInfo(interaction);
      } else if (subcommand === 'set') {
        await handleSet(interaction);
      }
    } catch (err) {
      console.error(
        `[Season/${subcommand}] Error for ${interaction.user.tag}:`,
        err.message,
      );
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '\u274C An error occurred while managing season data.',
          ephemeral: true,
        });
      }
    }
  },
};

/* ------------------------------------------------------------------ */

async function handleInfo(interaction) {
  const season = db.getCurrentSeason();

  if (!season) {
    return interaction.reply({
      content:
        'No season data set yet. Use `/season set` to configure the current season.',
      ephemeral: true,
    });
  }

  const startDate = new Date(season.start_date);
  const today = new Date();
  const daysElapsed = Math.floor((today - startDate) / MS_PER_DAY);

  const embed = seasonInfoEmbed(season, daysElapsed);
  await interaction.reply({ embeds: [embed] });
}

async function handleSet(interaction) {
  if (!requireStaff(interaction)) return;

  const number = interaction.options.getInteger('number');
  const startDate = interaction.options.getString('start_date');
  const seed = interaction.options.getString('seed') || null;

  if (!DATE_RE.test(startDate)) {
    return interaction.reply({
      content: '\u274C Start date must be in YYYY-MM-DD format.',
      ephemeral: true,
    });
  }

  db.setSeason({ seasonNumber: number, startDate, seed });

  await interaction.reply({
    content: `\u2705 Season ${number} set (start: ${startDate}${seed ? `, seed: \`${seed}\`` : ''}).`,
    ephemeral: true,
  });
}
