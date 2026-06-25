/**
 * /poi — Manage points of interest on the server.
 *
 * Subcommands: add, list (paginated embeds), remove (staff only).
 * All inputs validated through Zod schemas before processing.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { poiRegisteredEmbed, poiListEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { AddPOIInput, RemovePOIInput } = require('../schemas/pois');

const POIS_PER_PAGE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poi')
    .setDescription('Manage points of interest on the server')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Register a point of interest')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('POI name').setRequired(true),
        )
        .addNumberOption((opt) =>
          opt.setName('x').setDescription('X coordinate').setRequired(true),
        )
        .addNumberOption((opt) =>
          opt.setName('y').setDescription('Y coordinate').setRequired(true),
        )
        .addNumberOption((opt) =>
          opt.setName('z').setDescription('Z coordinate').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('dimension')
            .setDescription('Dimension')
            .setRequired(true)
            .addChoices(
              { name: 'Overworld', value: 'overworld' },
              { name: 'Nether', value: 'nether' },
              { name: 'The End', value: 'the_end' },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName('description')
            .setDescription('Description')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all points of interest'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a POI (staff only)')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('POI name').setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'add') {
        await handleAdd(interaction);
      } else if (subcommand === 'list') {
        await handleList(interaction);
      } else if (subcommand === 'remove') {
        await handleRemove(interaction);
      }
    } catch (err) {
      logger.error('POI command error', {
        subcommand,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '\u274C An error occurred while managing POIs.',
          ephemeral: true,
        });
      }
    }
  },
};

/* ------------------------------------------------------------------ */

async function handleAdd(interaction) {
  // 1. Validate input.
  const rawInput = {
    name: interaction.options.getString('name'),
    x: interaction.options.getNumber('x'),
    y: interaction.options.getNumber('y'),
    z: interaction.options.getNumber('z'),
    dimension: interaction.options.getString('dimension'),
    description: interaction.options.getString('description'),
  };

  let input;
  try {
    input = validateInput(AddPOIInput, rawInput);
  } catch (err) {
    return interaction.reply({
      content: `\u274C ${err.userMessage}`,
      ephemeral: true,
    });
  }

  const existing = db.getPoiByName(input.name);
  if (existing) {
    return interaction.reply({
      content: `\u274C A POI named "${input.name}" already exists.`,
      ephemeral: true,
    });
  }

  db.addPoi({
    name: input.name,
    x: input.x,
    y: input.y,
    z: input.z,
    dimension: input.dimension,
    description: input.description,
    createdBy: interaction.user.id,
  });

  const embed = poiRegisteredEmbed({
    name: input.name,
    x: input.x,
    y: input.y,
    z: input.z,
    dimension: input.dimension,
    description: input.description,
  });
  await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction) {
  const pois = db.getAllPois();

  if (pois.length === 0) {
    return interaction.reply({
      content: '\u{1F4CD} No points of interest registered yet.',
    });
  }

  const totalPages = Math.ceil(pois.length / POIS_PER_PAGE);

  for (let page = 0; page < totalPages; page++) {
    const slice = pois.slice(page * POIS_PER_PAGE, (page + 1) * POIS_PER_PAGE);
    if (page === 0) {
      // Send the first page as the reply.
      await interaction.reply({
        embeds: [poiListEmbed(slice, page + 1, totalPages)],
      });
    }
  }
}

async function handleRemove(interaction) {
  // 1. Validate input.
  const rawInput = {
    name: interaction.options.getString('name'),
  };

  let input;
  try {
    input = validateInput(RemovePOIInput, rawInput);
  } catch (err) {
    return interaction.reply({
      content: `\u274C ${err.userMessage}`,
      ephemeral: true,
    });
  }

  if (!requireStaff(interaction)) return;

  const poi = db.getPoiByName(input.name);

  if (!poi) {
    return interaction.reply({
      content: `\u274C No POI found with name "${input.name}".`,
      ephemeral: true,
    });
  }

  db.removePoi(input.name);
  await interaction.reply({
    content: `\u2705 POI "${input.name}" removed.`,
    ephemeral: true,
  });
}
