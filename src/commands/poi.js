const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poi')
    .setDescription('Manage points of interest on the server')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Register a point of interest')
        .addStringOption((opt) => opt.setName('name').setDescription('POI name').setRequired(true))
        .addNumberOption((opt) => opt.setName('x').setDescription('X coordinate').setRequired(true))
        .addNumberOption((opt) => opt.setName('y').setDescription('Y coordinate').setRequired(true))
        .addNumberOption((opt) => opt.setName('z').setDescription('Z coordinate').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('dimension')
            .setDescription('Dimension')
            .setRequired(true)
            .addChoices(
              { name: 'Overworld', value: 'overworld' },
              { name: 'Nether', value: 'nether' },
              { name: 'The End', value: 'the_end' },
            ))
        .addStringOption((opt) => opt.setName('description').setDescription('Description').setRequired(true)),
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
        .addStringOption((opt) => opt.setName('name').setDescription('POI name').setRequired(true)),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const name = interaction.options.getString('name');
      const x = interaction.options.getNumber('x');
      const y = interaction.options.getNumber('y');
      const z = interaction.options.getNumber('z');
      const dimension = interaction.options.getString('dimension');
      const description = interaction.options.getString('description');

      // Check if name already exists
      const existing = db.getPoiByName(name);
      if (existing) {
        return interaction.reply({ content: `❌ A POI named "${name}" already exists.`, ephemeral: true });
      }

      const dimEmoji = { overworld: '🌍', nether: '🔥', the_end: '💜' };

      db.addPoi({ name, x, y, z, dimension, description, createdBy: interaction.user.id });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('📍 POI Registered')
        .addFields(
          { name: 'Name', value: name, inline: true },
          { name: 'Location', value: `\`${x}, ${y}, ${z}\``, inline: true },
          { name: 'Dimension', value: `${dimEmoji[dimension] || ''} ${dimension}`, inline: true },
          { name: 'Description', value: description, inline: false },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    else if (subcommand === 'list') {
      const pois = db.getAllPois();

      if (pois.length === 0) {
        return interaction.reply({ content: '📍 No points of interest registered yet.' });
      }

      const dimEmoji = { overworld: '🌍', nether: '🔥', the_end: '💜' };

      // Paginate: 5 POIs per embed
      const pageSize = 5;
      const pages = [];
      for (let i = 0; i < pois.length; i += pageSize) {
        const slice = pois.slice(i, i + pageSize);
        const embed = new EmbedBuilder()
          .setColor(0x1abc9c)
          .setTitle('📍 Points of Interest')
          .setFooter({ text: `Page ${Math.floor(i / pageSize) + 1}/${Math.ceil(pois.length / pageSize)}` })
          .setTimestamp();

        slice.forEach((poi) => {
          embed.addFields({
            name: poi.name,
            value: `**Location:** \`${poi.x}, ${poi.y}, ${poi.z}\` ${dimEmoji[poi.dimension] || ''}\n**Description:** ${poi.description || 'None'}`,
            inline: false,
          });
        });

        pages.push(embed);
      }

      await interaction.reply({ embeds: [pages[0]] });

      // For simplicity, send first page. Could implement button pagination.
    }

    else if (subcommand === 'remove') {
      if (!requireStaff(interaction)) return;

      const name = interaction.options.getString('name');
      const poi = db.getPoiByName(name);

      if (!poi) {
        return interaction.reply({ content: `❌ No POI found with name "${name}".`, ephemeral: true });
      }

      db.removePoi(name);
      await interaction.reply({ content: `✅ POI "${name}" removed.`, ephemeral: true });
    }
  },
};
