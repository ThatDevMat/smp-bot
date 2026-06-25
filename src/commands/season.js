/**
 * /season — View or set SMP season information.
 *
 * Subcommands: info (public), set (staff only).
 * Season data is stored in SQLite.  Input validated through Zod.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { seasonInfoEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { SetSeasonInput } = require('../schemas/season');
const { logAction } = require('../utils/audit');

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
      logger.error('Season command error', {
        subcommand,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
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
  // 1. Validate input.
  const rawInput = {
    number: interaction.options.getInteger('number'),
    startDate: interaction.options.getString('start_date'),
    seed: interaction.options.getString('seed') || null,
  };

  let input;
  try {
    input = validateInput(SetSeasonInput, rawInput);
  } catch (err) {
    return interaction.reply({
      content: `\u274C ${err.userMessage}`,
      ephemeral: true,
    });
  }

  if (!requireStaff(interaction)) return;

  db.setSeason({
    seasonNumber: input.number,
    startDate: input.startDate,
    seed: input.seed,
  });

  await logAction({
    client: interaction.client,
    type: 'season_set',
    staff: interaction.user,
    target: `Season #${input.number}`,
    details: `Start: ${input.startDate}${input.seed ? `, Seed: ${input.seed}` : ''}`,
  });

  await interaction.reply({
    content: `\u2705 Season ${input.number} set (start: ${input.startDate}${input.seed ? `, seed: \`${input.seed}\`` : ''}).`,
    ephemeral: true,
  });
}
