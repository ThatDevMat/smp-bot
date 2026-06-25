/**
 * /poi — Manage points of interest on the server.
 *
 * Subcommands: add, list (paginated embeds), remove (staff only).
 * Embed building is delegated to shared helpers in src/utils/embeds.js.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { poiRegisteredEmbed, poiListEmbed } = require('../utils/embeds');

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
          opt.setName('name').setDescription('POI name').setRequired(true))
        .addNumberOption((opt) =>
          opt.setName('x').setDescription('X coordinate').setRequired(true))
        .addNumberOption((opt) =>
          opt.setName('y').setDescription('Y coordinate').setRequired(true))
        .addNumberOption((opt) =>
          opt.setName('z').setDescription('Z coordinate').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('dimension')
            .setDescription('Dimension')
            .setRequired(true)
            .addChoices(
              { name: 'Overworld', value: 'overworld' },
              { name: 'Nether', value: 'nether' },
              { name: 'The End', value: 'the_end' },
            ))
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Description').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all points of interest'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a POI (staff only)')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('POI name').setRequired(true)),
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
      console.error(`[POI/${subcommand}] Error for ${interaction.user.tag}:`, err.message);
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
  const name = interaction.options.getString('name');
  const x = interaction.options.getNumber('x');
  const y = interaction.options.getNumber('y');
  const z = interaction.options.getNumber('z');
  const dimension = interaction.options.getString('dimension');
  const description = interaction.options.getString('description');

  // Reject excessively long names (DB column is TEXT, but Discord UX suffers).
  if (name.length > 64) {
    return interaction.reply({
      content: '\u274C POI name must be 64 characters or fewer.',
      ephemeral: true,
    });
  }

  const existing = db.getPoiByName(name);
  if (existing) {
    return interaction.reply({
      content: `\u274C A POI named "${name}" already exists.`,
      ephemeral: true,
    });
  }

  db.addPoi({ name, x, y, z, dimension, description, createdBy: interaction.user.id });

  const embed = poiRegisteredEmbed({ name, x, y, z, dimension, description });
  await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction) {
  const pois = db.getAllPois();

  if (pois.length === 0) {
    return interaction.reply({ content: '\u{1F4CD} No points of interest registered yet.' });
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
    // Future improvement: use button pagination to navigate pages.
    // For now the operator sees the first page only.
  }
}

async function handleRemove(interaction) {
  if (!requireStaff(interaction)) return;

  const name = interaction.options.getString('name');
  const poi = db.getPoiByName(name);

  if (!poi) {
    return interaction.reply({
      content: `\u274C No POI found with name "${name}".`,
      ephemeral: true,
    });
  }

  db.removePoi(name);
  await interaction.reply({
    content: `\u2705 POI "${name}" removed.`,
    ephemeral: true,
  });
}
