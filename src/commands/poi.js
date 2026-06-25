/**
 * /poi — Manage points of interest on the server.
 *
 * Subcommands: add, list (paginated embeds), remove (staff only).
 * All inputs validated through Zod schemas before processing.
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { poiRegisteredEmbed, poiListEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const { AddPOIInput, RemovePOIInput } = require('../schemas/pois');
const { logAction } = require('../utils/audit');

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
  let currentPage = 0;

  /**
   * Build the embed + action row for a given page index.
   */
  function buildPage(page) {
    const slice = pois.slice(page * POIS_PER_PAGE, (page + 1) * POIS_PER_PAGE);
    const embed = poiListEmbed(slice, page + 1, totalPages);

    const prevBtn = new ButtonBuilder()
      .setCustomId('poi_prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);

    const nextBtn = new ButtonBuilder()
      .setCustomId('poi_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1);

    const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
    return { embeds: [embed], components: [row] };
  }

  // Send the first page.
  const reply = await interaction.reply({
    ...buildPage(0),
    fetchReply: true,
  });

  // Create a collector that expires after 2 minutes.
  const collector = reply.createMessageComponentCollector({
    time: 120_000,
  });

  collector.on('collect', async (btnInteraction) => {
    if (btnInteraction.user.id !== interaction.user.id) {
      return btnInteraction.reply({
        content: 'You cannot control this pagination.',
        ephemeral: true,
      });
    }

    if (btnInteraction.customId === 'poi_prev' && currentPage > 0) {
      currentPage--;
    } else if (
      btnInteraction.customId === 'poi_next' &&
      currentPage < totalPages - 1
    ) {
      currentPage++;
    }

    await btnInteraction.update(buildPage(currentPage));
  });

  collector.on('end', async () => {
    // Disable buttons after collector expires.
    try {
      const currentSlice = pois.slice(
        currentPage * POIS_PER_PAGE,
        (currentPage + 1) * POIS_PER_PAGE,
      );
      const embed = poiListEmbed(currentSlice, currentPage + 1, totalPages);
      const prevBtn = new ButtonBuilder()
        .setCustomId('poi_prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      const nextBtn = new ButtonBuilder()
        .setCustomId('poi_next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch {
      // Reply may have been deleted — ignore.
    }
  });
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

  await logAction({
    client: interaction.client,
    type: 'poi_remove',
    staff: interaction.user,
    target: input.name,
    details: '',
  });

  await interaction.reply({
    content: `\u2705 POI "${input.name}" removed.`,
    ephemeral: true,
  });
}
