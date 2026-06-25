/**
 * Audit log helper.
 *
 * Provides a single `logAction()` function that posts a structured embed
 * to the configured audit-log channel every time a staff member performs
 * a tracked action.  Every moderation, admin, and configuration command
 * must call this function before replying to the interaction.
 *
 * If no audit-log channel is configured the call is silently skipped.
 */

const { EmbedBuilder } = require('discord.js');
const { config } = require('../config');
const logger = require('./logger');

/* ------------------------------------------------------------------ */
/*  Action-type metadata                                               */
/* ------------------------------------------------------------------ */

const ACTION_LABELS = {
  warn: { title: ':warning: Warning Issued', color: 0xf1c40f },
  whitelist_add: { title: ':white_check_mark: Whitelist Add', color: 0x2ecc71 },
  whitelist_remove: { title: ':x: Whitelist Remove', color: 0xe74c3c },
  backup: { title: ':floppy_disk: Backup Triggered', color: 0x3498db },
  cache_flush: { title: ':broom: Cache Flushed', color: 0x9b59b6 },
  event_cancel: { title: ':no_entry: Event Cancelled', color: 0xe74c3c },
  poi_remove: { title: ':no_entry: POI Removed', color: 0xe74c3c },
  season_set: { title: ':calendar: Season Updated', color: 0x9b59b6 },
  note_add: { title: ':memo: Player Note Added', color: 0x1abc9c },
  note_remove: { title: ':wastebasket: Player Note Removed', color: 0xe74c3c },
  console: { title: ':desktop: Console Command', color: 0x95a5a6 },
  announce_create: {
    title: ':loudspeaker: Announcement Created',
    color: 0x2ecc71,
  },
  announce_cancel: {
    title: ':no_entry: Announcement Cancelled',
    color: 0xe74c3c,
  },
};

const DEFAULT_COLOR = 0x95a5a6;

/* ------------------------------------------------------------------ */
/*  logAction                                                          */
/* ------------------------------------------------------------------ */

/**
 * Post an audit-log entry to the configured audit channel.
 *
 * @param {object} opts
 * @param {import('discord.js').Client} opts.client     - Discord client (used to fetch channel)
 * @param {string}  opts.type                           - Action type key (see ACTION_LABELS)
 * @param {import('discord.js').User} opts.staff        - Staff member who performed the action
 * @param {string}  [opts.target]                       - Who or what was acted upon
 * @param {string}  [opts.details]                      - Additional context (reason, description, etc.)
 * @param {number}  [opts.color]                        - Override embed colour
 * @param {boolean} [opts.silent]                       - If true, don't log (default false)
 */
async function logAction({
  client,
  type,
  staff,
  target,
  details,
  color,
  silent,
}) {
  if (silent) return;

  const channelId = config.channels.auditLog;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    logger.warn('Audit log channel not found in cache', { channelId });
    return;
  }

  const meta = ACTION_LABELS[type];
  const embed = new EmbedBuilder()
    .setColor(color || (meta ? meta.color : DEFAULT_COLOR))
    .setTitle(meta ? meta.title : type)
    .addFields(
      { name: 'Staff', value: `${staff} (\`${staff.id}\`)`, inline: true },
      {
        name: 'Time',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
      },
    )
    .setTimestamp();

  if (target) {
    embed.addFields({ name: 'Target', value: target, inline: false });
  }
  if (details) {
    embed.addFields({ name: 'Details', value: details, inline: false });
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error('Failed to send audit log entry', {
      type,
      error: err.message,
    });
  }
}

module.exports = { logAction };
