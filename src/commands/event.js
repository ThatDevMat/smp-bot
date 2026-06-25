/**
 * /event — Event management.
 *
 * Subcommands: create (staff), list, cancel (staff).
 * Uses the shared embeds module for all embed building.
 * Sends RSVP-button-enabled announcements to the configured events channel.
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { eventAnnouncementEmbed, eventListEmbed } = require('../utils/embeds');
const { config } = require('../config');
const logger = require('../utils/logger');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Manage SMP events')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Schedule a new event (staff only)')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Event name').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('date')
            .setDescription('Event date (YYYY-MM-DD)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('time')
            .setDescription('Event time (HH:MM, 24h)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('timezone')
            .setDescription('Timezone (e.g. UTC, America/New_York)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('description')
            .setDescription('Event description')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Show upcoming events'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel an event (staff only)')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Event ID').setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'create') {
        await handleCreate(interaction);
      } else if (subcommand === 'list') {
        await handleList(interaction);
      } else if (subcommand === 'cancel') {
        await handleCancel(interaction);
      }
    } catch (err) {
      logger.error('Event command error', {
        subcommand,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            '\u274C An error occurred while processing the event command.',
          ephemeral: true,
        });
      }
    }
  },
};

/* ------------------------------------------------------------------ */

async function handleCreate(interaction) {
  if (!requireStaff(interaction)) return;

  const name = interaction.options.getString('name');
  const date = interaction.options.getString('date');
  const time = interaction.options.getString('time');
  const timezone = interaction.options.getString('timezone');
  const description = interaction.options.getString('description');

  if (!DATE_RE.test(date)) {
    return interaction.reply({
      content: '\u274C Date must be in YYYY-MM-DD format.',
      ephemeral: true,
    });
  }
  if (!TIME_RE.test(time)) {
    return interaction.reply({
      content: '\u274C Time must be in HH:MM format (24h).',
      ephemeral: true,
    });
  }

  const eventId = db.createEvent({
    name,
    description,
    event_date: date,
    event_time: time,
    timezone,
    created_by: interaction.user.id,
  });

  const eventData = db.getEventById(eventId);
  const announcementEmbed = eventAnnouncementEmbed(eventData);

  const rsvpButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rsvp_${eventId}`)
      .setLabel('\u{1F4C5} RSVP')
      .setStyle(ButtonStyle.Primary),
  );

  // Post announcement in the configured events channel.
  const eventsChannel = getEventsChannel(interaction);
  if (eventsChannel) {
    await eventsChannel.send({
      embeds: [announcementEmbed],
      components: [rsvpButton],
    });
  }

  await interaction.reply({
    content: `\u2705 Event "${name}" created with ID **${eventId}**.`,
    ephemeral: true,
  });
}

async function handleList(interaction) {
  const events = db.getUpcomingEvents();

  if (events.length === 0) {
    return interaction.reply({
      content: '\u{1F4C5} No upcoming events.',
      ephemeral: true,
    });
  }

  const embeds = eventListEmbed(events);
  await interaction.reply({ embeds: embeds.slice(0, 10) });
}

async function handleCancel(interaction) {
  if (!requireStaff(interaction)) return;

  const id = interaction.options.getInteger('id');
  const event = db.getEventById(id);

  if (!event) {
    return interaction.reply({
      content: '\u274C Event not found.',
      ephemeral: true,
    });
  }

  db.cancelEvent(id);

  // Notify the events channel.
  const eventsChannel = getEventsChannel(interaction);
  if (eventsChannel) {
    await eventsChannel.send({
      content: `\u274C **Event Cancelled:** ${event.name} (ID: ${id})`,
    });
  }

  await interaction.reply({
    content: `\u2705 Event "${event.name}" cancelled.`,
    ephemeral: true,
  });
}

/* ------------------------------------------------------------------ */

function getEventsChannel(interaction) {
  if (!config.channels.events) return null;
  return interaction.guild.channels.cache.get(config.channels.events) || null;
}
