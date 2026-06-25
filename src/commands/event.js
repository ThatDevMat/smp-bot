const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { eventAnnouncementEmbed } = require('../utils/embeds');
const { config } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Manage SMP events')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Schedule a new event (staff only)')
        .addStringOption((opt) => opt.setName('name').setDescription('Event name').setRequired(true))
        .addStringOption((opt) => opt.setName('date').setDescription('Event date (YYYY-MM-DD)').setRequired(true))
        .addStringOption((opt) => opt.setName('time').setDescription('Event time (HH:MM, 24h)').setRequired(true))
        .addStringOption((opt) => opt.setName('timezone').setDescription('Timezone (e.g. UTC, America/New_York)').setRequired(true))
        .addStringOption((opt) => opt.setName('description').setDescription('Event description').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Show upcoming events'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel an event (staff only)')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Event ID').setRequired(true)),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      if (!requireStaff(interaction)) return;

      const name = interaction.options.getString('name');
      const date = interaction.options.getString('date');
      const time = interaction.options.getString('time');
      const timezone = interaction.options.getString('timezone');
      const description = interaction.options.getString('description');

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return interaction.reply({ content: '❌ Date must be in YYYY-MM-DD format.', ephemeral: true });
      }
      // Validate time format (HH:MM)
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return interaction.reply({ content: '❌ Time must be in HH:MM format (24h).', ephemeral: true });
      }

      const eventId = db.createEvent({
        name, description, event_date: date, event_time: time, timezone, created_by: interaction.user.id,
      });

      // Post announcement in the events channel if configured
      const eventData = db.getEventById(eventId);
      const announcementEmbed = eventAnnouncementEmbed(eventData);

      const rsvpButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`rsvp_${eventId}`)
          .setLabel('📅 RSVP')
          .setStyle(ButtonStyle.Primary),
      );

      if (config.channels.events) {
        const eventsChannel = interaction.guild.channels.cache.get(config.channels.events);
        if (eventsChannel) {
          await eventsChannel.send({ embeds: [announcementEmbed], components: [rsvpButton] });
        }
      }

      await interaction.reply({
        content: `✅ Event "${name}" created with ID **${eventId}**.`,
        ephemeral: true,
      });
    }

    else if (subcommand === 'list') {
      const events = db.getUpcomingEvents();
      if (events.length === 0) {
        return interaction.reply({ content: '📅 No upcoming events.', ephemeral: true });
      }

      const embeds = events.map((ev) => {
        return new EmbedBuilder()
          .setColor(0x1abc9c)
          .setTitle(`#${ev.id} — ${ev.name}`)
          .setDescription(ev.description || 'No description')
          .addFields(
            { name: 'Date', value: ev.event_date, inline: true },
            { name: 'Time', value: `${ev.event_time} ${ev.timezone}`, inline: true },
          )
          .setFooter({ text: ev.cancelled ? 'CANCELLED' : 'Upcoming' });
      });

      await interaction.reply({ embeds: embeds.slice(0, 10), ephemeral: false });
    }

    else if (subcommand === 'cancel') {
      if (!requireStaff(interaction)) return;

      const id = interaction.options.getInteger('id');
      const event = db.getEventById(id);

      if (!event) {
        return interaction.reply({ content: '❌ Event not found.', ephemeral: true });
      }

      db.cancelEvent(id);

      // Notify the events channel
      if (config.channels.events) {
        const eventsChannel = interaction.guild.channels.cache.get(config.channels.events);
        if (eventsChannel) {
          await eventsChannel.send({
            content: `❌ **Event Cancelled:** ${event.name} (ID: ${id})`,
          });
        }
      }

      await interaction.reply({ content: `✅ Event "${event.name}" cancelled.`, ephemeral: true });
    }
  },
};
