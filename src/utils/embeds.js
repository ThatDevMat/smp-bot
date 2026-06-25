/**
 * Embed builders and formatters.
 *
 * Centralises every Discord embed shape so that command handlers never
 * construct embeds directly.  Colours are named constants so the palette
 * is consistent and easy to adjust in one place.
 */

const { EmbedBuilder } = require('discord.js');

/* ------------------------------------------------------------------ */
/*  Colour palette (named constants — no magic numbers)               */
/* ------------------------------------------------------------------ */

const COLOR = {
  GREEN: 0x2ecc71,
  RED: 0xe74c3c,
  BLUE: 0x3498db,
  GRAY: 0x95a5a6,
  YELLOW: 0xf1c40f,
  TEAL: 0x1abc9c,
  PURPLE: 0x9b59b6,
  ORANGE: 0xf39c12,
};

/* ------------------------------------------------------------------ */
/*  Dimension → emoji map  (shared by POI commands)                   */
/* ------------------------------------------------------------------ */

const DIMENSION_EMOJI = {
  overworld: '\u{1F30D}',
  nether: '\u{1F525}',
  the_end: '\u{1F49C}',
};

/* ------------------------------------------------------------------ */
/*  Status                                                             */
/* ------------------------------------------------------------------ */

/**
 * Embed for the `/status` command.
 * When `online` is false only the title/colour change.
 */
function statusEmbed({ online, players, version, motd, uptime, software }) {
  const embed = new EmbedBuilder()
    .setTitle(online ? '\u2705 Server Online' : '\u274C Server Offline')
    .setColor(online ? COLOR.GREEN : COLOR.RED)
    .setTimestamp();

  if (!online) return embed;

  embed.addFields(
    {
      name: 'Players',
      value: players ? `${players.online}/${players.max}` : '?/?',
      inline: true,
    },
    { name: 'Version', value: version || 'Unknown', inline: true },
  );

  if (players && players.list && players.list.length > 0) {
    embed.addFields({
      name: 'Online Players',
      value: players.list.map((p) => `\`${p}\``).join(', '),
      inline: false,
    });
  }

  if (software)
    embed.addFields({ name: 'Software', value: software, inline: true });

  if (uptime) {
    embed.addFields({
      name: 'Uptime',
      value: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      inline: true,
    });
  }

  if (motd) embed.setDescription(`*${motd.slice(0, 200)}*`);

  return embed;
}

/* ------------------------------------------------------------------ */
/*  DiscordSRV webhook embeds                                          */
/* ------------------------------------------------------------------ */

function chatMessageEmbed(username, message) {
  return new EmbedBuilder()
    .setColor(COLOR.BLUE)
    .setAuthor({ name: username || 'Unknown' })
    .setDescription(message || '\u200B')
    .setTimestamp();
}

function playerEventEmbed(username, eventType) {
  const colors = { join: COLOR.GREEN, leave: COLOR.RED, death: COLOR.GRAY };
  const titles = {
    join: '\u{1F7E2} Player Joined',
    leave: '\u{1F534} Player Left',
    death: '\u{1F480} Player Died',
  };

  return new EmbedBuilder()
    .setColor(colors[eventType] || COLOR.GRAY)
    .setTitle(titles[eventType] || eventType)
    .setDescription(`\`${username || '???'}\``)
    .setTimestamp();
}

function advancementEmbed(username, advancement, description) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.YELLOW)
    .setTitle('\u{1F3C6} Advancement Unlocked')
    .setDescription(
      `**${username}** has made the advancement **[${advancement}]**`,
    )
    .setTimestamp();

  if (description) {
    embed.setFooter({ text: description });
  }

  return embed;
}

function serverEventEmbed(eventType) {
  const mapping = {
    start: { title: '\u{1F7E2} Server Started', color: COLOR.GREEN },
    stop: { title: '\u{1F534} Server Stopped', color: COLOR.RED },
  };
  const cfg = mapping[eventType] || { title: eventType, color: COLOR.GRAY };

  return new EmbedBuilder()
    .setTitle(cfg.title)
    .setColor(cfg.color)
    .setTimestamp();
}

/* ------------------------------------------------------------------ */
/*  Polls                                                              */
/* ------------------------------------------------------------------ */

function pollEmbed(question, options) {
  const numberEmojis = [
    '1\uFE0F\u20E3',
    '2\uFE0F\u20E3',
    '3\uFE0F\u20E3',
    '4\uFE0F\u20E3',
  ];
  const desc = options
    .map((opt, i) => `${numberEmojis[i]} \u2014 ${opt}`)
    .join('\n');

  return new EmbedBuilder()
    .setColor(COLOR.PURPLE)
    .setTitle('\u{1F4CA} ' + question)
    .setDescription(desc)
    .setFooter({ text: 'Vote using the reactions below' })
    .setTimestamp();
}

/* ------------------------------------------------------------------ */
/*  Events                                                             */
/* ------------------------------------------------------------------ */

function eventAnnouncementEmbed(event) {
  return new EmbedBuilder()
    .setColor(COLOR.TEAL)
    .setTitle('\u{1F4C5} ' + event.name)
    .setDescription(event.description || 'No description provided.')
    .addFields(
      { name: 'Date', value: event.event_date, inline: true },
      {
        name: 'Time',
        value: `${event.event_time} ${event.timezone}`,
        inline: true,
      },
    )
    .setTimestamp();
}

function eventListEmbed(events) {
  return events.map((ev) =>
    new EmbedBuilder()
      .setColor(COLOR.TEAL)
      .setTitle(`#${ev.id} \u2014 ${ev.name}`)
      .setDescription(ev.description || 'No description')
      .addFields(
        { name: 'Date', value: ev.event_date, inline: true },
        {
          name: 'Time',
          value: `${ev.event_time} ${ev.timezone}`,
          inline: true,
        },
      )
      .setFooter({ text: ev.cancelled ? 'CANCELLED' : 'Upcoming' }),
  );
}

/* ------------------------------------------------------------------ */
/*  POIs                                                               */
/* ------------------------------------------------------------------ */

function poiRegisteredEmbed({ name, x, y, z, dimension, description }) {
  return new EmbedBuilder()
    .setColor(COLOR.GREEN)
    .setTitle('\u{1F4CD} POI Registered')
    .addFields(
      { name: 'Name', value: name, inline: true },
      { name: 'Location', value: `\`${x}, ${y}, ${z}\``, inline: true },
      {
        name: 'Dimension',
        value: `${DIMENSION_EMOJI[dimension] || ''} ${dimension}`,
        inline: true,
      },
      { name: 'Description', value: description, inline: false },
    )
    .setTimestamp();
}

function poiListEmbed(pois, page, totalPages) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.TEAL)
    .setTitle('\u{1F4CD} Points of Interest')
    .setFooter({ text: `Page ${page}/${totalPages}` })
    .setTimestamp();

  pois.forEach((poi) => {
    embed.addFields({
      name: poi.name,
      value: `**Location:** \`${poi.x}, ${poi.y}, ${poi.z}\` ${DIMENSION_EMOJI[poi.dimension] || ''}\n**Description:** ${poi.description || 'None'}`,
      inline: false,
    });
  });

  return embed;
}

/* ------------------------------------------------------------------ */
/*  Seasons                                                            */
/* ------------------------------------------------------------------ */

function seasonInfoEmbed(season, daysElapsed) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.PURPLE)
    .setTitle(`\u{1F4C5} Season ${season.season_number}`)
    .addFields(
      { name: 'Season', value: `#${season.season_number}`, inline: true },
      { name: 'Start Date', value: season.start_date, inline: true },
      { name: 'Days Elapsed', value: `${daysElapsed} days`, inline: true },
    )
    .setTimestamp();

  if (season.seed) {
    embed.addFields({
      name: 'World Seed',
      value: `\`${season.seed}\``,
      inline: false,
    });
  }

  return embed;
}

/* ------------------------------------------------------------------ */
/*  Moderation                                                         */
/* ------------------------------------------------------------------ */

function activePunishmentsEmbed(input, punishments) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.RED)
    .setTitle(`\u26D4 Active Punishments for ${input}`)
    .setTimestamp();

  punishments.forEach((p) => {
    const duration = p.end
      ? `Expires: ${new Date(p.end).toLocaleString()}`
      : 'Permanent';
    embed.addFields({
      name: `${p.type.toUpperCase()} \u2014 ${new Date(p.start).toLocaleString()}`,
      value: `Reason: ${p.reason || 'No reason provided'}\n${duration}\nBy: ${p.executor || 'Unknown'}`,
      inline: false,
    });
  });

  return embed;
}

function punishmentHistoryEmbed(input, history) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.ORANGE)
    .setTitle(`\u{1F4DC} Punishment History \u2014 ${input}`)
    .setFooter({ text: `Total entries: ${history.length}` })
    .setTimestamp();

  const entries = history.slice(0, 10);
  entries.forEach((p) => {
    const status = p.active ? '\u{1F7E2} Active' : '\u{1F534} Expired';
    const duration = p.end
      ? `Expires: ${new Date(p.end).toLocaleString()}`
      : 'Permanent';
    embed.addFields({
      name: `${status} \u2014 ${p.type.toUpperCase()} \u2014 ${new Date(p.start).toLocaleString()}`,
      value: `Reason: ${p.reason || 'No reason'}\n${duration}\nBy: ${p.executor || 'Unknown'}`,
      inline: false,
    });
  });

  if (history.length > 10) {
    embed.setDescription(`*Showing 10 of ${history.length} entries*`);
  }

  return embed;
}

function warningIssuedEmbed(username, uuid, reason, issuerId) {
  return new EmbedBuilder()
    .setColor(COLOR.YELLOW)
    .setTitle('\u26A0\uFE0F Warning Issued')
    .addFields(
      {
        name: 'Player',
        value: `\`${username}\` (UUID: \`${uuid}\`)`,
        inline: false,
      },
      { name: 'Reason', value: reason, inline: false },
      { name: 'Issued By', value: `<@${issuerId}>`, inline: true },
    )
    .setTimestamp();
}

function warningDmEmbed(username, reason) {
  return new EmbedBuilder()
    .setColor(COLOR.YELLOW)
    .setTitle('\u26A0\uFE0F You Have Been Warned')
    .setDescription('You have received a warning on the SMP server.')
    .addFields(
      { name: 'Minecraft Account', value: `\`${username}\``, inline: true },
      { name: 'Reason', value: reason, inline: false },
    )
    .setTimestamp();
}

function localWarningsEmbed(username, warnings) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.YELLOW)
    .setTitle(`\u26A0\uFE0F Local Warnings \u2014 ${username}`)
    .setFooter({ text: `Total: ${warnings.length}` })
    .setTimestamp();

  warnings.slice(0, 10).forEach((w) => {
    embed.addFields({
      name: `#${w.id} \u2014 ${w.issued_at}`,
      value: `Reason: ${w.reason}\nIssued by: <@${w.issued_by}>`,
      inline: false,
    });
  });

  if (warnings.length > 10) {
    embed.setDescription(`*Showing 10 of ${warnings.length} entries*`);
  }

  return embed;
}

/* ------------------------------------------------------------------ */
/*  Player Registry                                                    */
/* ------------------------------------------------------------------ */

function registrationEmbed(profile, discordId) {
  return new EmbedBuilder()
    .setColor(COLOR.GREEN)
    .setTitle('\u2705 Registration Successful')
    .addFields(
      { name: 'Discord User', value: `<@${discordId}>`, inline: true },
      {
        name: 'Minecraft Username',
        value: `\`${profile.username}\``,
        inline: true,
      },
      { name: 'Minecraft UUID', value: `\`${profile.uuid}\``, inline: false },
    )
    .setTimestamp();
}

function whoisEmbed(registration) {
  return new EmbedBuilder()
    .setColor(COLOR.BLUE)
    .setTitle('Player Lookup')
    .addFields(
      {
        name: 'Discord User',
        value: `<@${registration.discord_id}>`,
        inline: true,
      },
      {
        name: 'Minecraft Username',
        value: `\`${registration.minecraft_username}\``,
        inline: true,
      },
      {
        name: 'Minecraft UUID',
        value: `\`${registration.minecraft_uuid}\``,
        inline: false,
      },
      { name: 'Registered', value: registration.registered_at, inline: false },
    )
    .setTimestamp();
}

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

/**
 * Embed for the /cache command showing in-memory cache statistics.
 *
 * @param {{ hits: number, misses: number, keys: number, statusTtlRemaining: number|null }} stats
 * @returns {EmbedBuilder}
 */
function cacheStatsEmbed(stats) {
  const embed = new EmbedBuilder()
    .setColor(COLOR.PURPLE)
    .setTitle('\u{1F5B1}\uFE0F Cache Statistics')
    .addFields(
      { name: 'Hits', value: `${stats.hits}`, inline: true },
      { name: 'Misses', value: `${stats.misses}`, inline: true },
      { name: 'Cached Keys', value: `${stats.keys}`, inline: true },
    )
    .setTimestamp();

  if (stats.statusTtlRemaining !== null) {
    embed.addFields({
      name: 'Server Status Cache',
      value:
        stats.statusTtlRemaining > 0
          ? `Cached (${stats.statusTtlRemaining}s remaining)`
          : 'Expired',
      inline: false,
    });
  } else {
    embed.addFields({
      name: 'Server Status Cache',
      value: 'Not cached',
      inline: false,
    });
  }

  return embed;
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

/**
 * Format a duration from milliseconds to a human-friendly string.
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 && parts.length === 0) parts.push(`${seconds % 60}s`);

  return parts.join(' ') || 'now';
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

/** Human-friendly byte size formatting. */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

/* ------------------------------------------------------------------ */
/*  Backup                                                             */
/* ------------------------------------------------------------------ */

/**
 * Embed for the /backup command result.
 */
function backupResultEmbed({ fileName, sizeBytes, durationMs }) {
  return new EmbedBuilder()
    .setColor(COLOR.GREEN)
    .setTitle('\u{1F4BE} Backup Complete')
    .addFields(
      { name: 'File', value: `\`${fileName}\``, inline: false },
      { name: 'Size', value: formatBytes(sizeBytes), inline: true },
      {
        name: 'Duration',
        value: durationMs >= 1000
          ? `${(durationMs / 1000).toFixed(1)}s`
          : `${durationMs}ms`,
        inline: true,
      },
    )
    .setTimestamp();
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  statusEmbed,
  chatMessageEmbed,
  playerEventEmbed,
  advancementEmbed,
  serverEventEmbed,
  pollEmbed,
  eventAnnouncementEmbed,
  eventListEmbed,
  poiRegisteredEmbed,
  poiListEmbed,
  seasonInfoEmbed,
  activePunishmentsEmbed,
  punishmentHistoryEmbed,
  warningIssuedEmbed,
  warningDmEmbed,
  localWarningsEmbed,
  registrationEmbed,
  whoisEmbed,
  cacheStatsEmbed,
  backupResultEmbed,
  formatDuration,
  formatBytes,
};
