/**
 * /announce — Manage scheduled announcements (staff only).
 *
 * Subcommands:
 *   create  — Schedule a recurring message in a channel.
 *   list    — Show all scheduled announcements.
 *   cancel  — Disable a scheduled announcement.
 *
 * Cron expressions are validated via node-cron's validate() before storage.
 */

const { SlashCommandBuilder } = require('discord.js');
const cron = require('node-cron');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const {
  AnnounceCreateInput,
  AnnounceCancelInput,
} = require('../schemas/moderation');
const { announceCreatedEmbed, announceListEmbed } = require('../utils/embeds');
const { logAction } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Manage scheduled announcements (staff only)')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Schedule a recurring announcement')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to post the announcement in')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Message content to announce')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('cron')
            .setDescription(
              'Cron expression (e.g. "0 9 * * 1" for every Monday at 9 AM)',
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Show all scheduled announcements'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Disable a scheduled announcement')
        .addIntegerOption((opt) =>
          opt
            .setName('id')
            .setDescription('Announcement ID to cancel')
            .setRequired(true),
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
      logger.error('Announce command error', {
        subcommand,
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            '\\u274C An error occurred while processing the announce command.',
          ephemeral: true,
        });
      }
    }
  },
};

/* ------------------------------------------------------------------ */

async function handleCreate(interaction) {
  // 1. Permission check.
  if (!requireStaff(interaction)) return;

  // 2. Validate input.
  const rawInput = {
    channel: interaction.options.getChannel('channel')?.id || '',
    message: interaction.options.getString('message'),
    cron: interaction.options.getString('cron'),
  };

  let input;
  try {
    input = validateInput(AnnounceCreateInput, rawInput);
  } catch (err) {
    return interaction.reply({
      content: `\\u274C ${err.userMessage}`,
      ephemeral: true,
    });
  }

  // 3. Validate cron expression via node-cron.
  if (!cron.validate(input.cron)) {
    return interaction.reply({
      content:
        '\\u274C Invalid cron expression. Please use a valid 5-field cron pattern (e.g. `0 9 * * 1`).',
      ephemeral: true,
    });
  }

  // 4. Store in database.
  const announcementId = db.createAnnouncement({
    channelId: input.channel,
    message: input.message,
    cronExpression: input.cron,
    createdBy: interaction.user.id,
  });

  // 5. Audit log.
  await logAction({
    client: interaction.client,
    type: 'announce_create',
    staff: interaction.user,
    target: `#${announcementId}`,
    details: `Channel: ${input.channel} | Cron: ${input.cron} | Message: ${input.message.slice(0, 100)}`,
  });

  // 6. Reply with confirmation embed.
  const embed = announceCreatedEmbed({
    id: announcementId,
    channelId: input.channel,
    message: input.message,
    cronExpression: input.cron,
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleList(interaction) {
  if (!requireStaff(interaction)) return;

  const announcements = db.getAnnouncements();
  const embed = announceListEmbed(announcements);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCancel(interaction) {
  if (!requireStaff(interaction)) return;

  // 1. Validate input.
  const rawInput = {
    id: interaction.options.getInteger('id'),
  };

  let input;
  try {
    input = validateInput(AnnounceCancelInput, rawInput);
  } catch (err) {
    return interaction.reply({
      content: `\\u274C ${err.userMessage}`,
      ephemeral: true,
    });
  }

  // 2. Check it exists.
  const announcements = db.getAnnouncements();
  const exists = announcements.find((a) => a.id === input.id);
  if (!exists) {
    return interaction.reply({
      content: `\\u274C Announcement with ID **${input.id}** not found.`,
      ephemeral: true,
    });
  }

  // 3. Cancel (set enabled = 0).
  db.cancelAnnouncement(input.id);

  // 4. Audit log.
  await logAction({
    client: interaction.client,
    type: 'announce_cancel',
    staff: interaction.user,
    target: `#${input.id}`,
    details: `Channel: ${exists.channel_id} | Cron: ${exists.cron_expression} | Message: ${exists.message.slice(0, 100)}`,
  });

  await interaction.reply({
    content: `\\u2705 Announcement **#${input.id}** has been cancelled.`,
    ephemeral: true,
  });
}
