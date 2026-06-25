const { EmbedBuilder } = require('discord.js');

/**
 * Create an embed for a server status response.
 */
function statusEmbed({ online, players, version, motd, uptime, software }) {
  const embed = new EmbedBuilder()
    .setTitle(online ? '✅ Server Online' : '❌ Server Offline')
    .setColor(online ? 0x2ecc71 : 0xe74c3c)
    .setTimestamp();

  if (online) {
    embed.addFields(
      { name: 'Players', value: `${players.online}/${players.max}`, inline: true },
      { name: 'Version', value: version || 'Unknown', inline: true },
    );
    if (players.list && players.list.length > 0) {
      embed.addFields(
        { name: 'Online Players', value: players.list.map((p) => `\`${p}\``).join(', '), inline: false },
      );
    }
    if (software) embed.addFields({ name: 'Software', value: software, inline: true });
    if (uptime) embed.addFields({ name: 'Uptime', value: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`, inline: true });
    if (motd) embed.setDescription(`*${motd.slice(0, 200)}*`);
  }

  return embed;
}

/**
 * Create an embed for a webhook chat message.
 */
function chatMessageEmbed(username, message) {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setAuthor({ name: username })
    .setDescription(message)
    .setTimestamp();
}

/**
 * Create an embed for player join/leave events.
 */
function playerEventEmbed(username, eventType) {
  const colors = { join: 0x2ecc71, leave: 0xe74c3c, death: 0x95a5a6 };
  const titles = { join: '🟢 Player Joined', leave: '🔴 Player Left', death: '💀 Player Died' };

  return new EmbedBuilder()
    .setColor(colors[eventType] || 0x95a5a6)
    .setTitle(titles[eventType] || eventType)
    .setDescription(`\`${username}\``)
    .setTimestamp();
}

/**
 * Create an embed for advancement unlocks.
 */
function advancementEmbed(username, advancement, description) {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🏆 Advancement Unlocked')
    .setDescription(`**${username}** has made the advancement **[${advancement}]**`)
    .setFooter({ text: description })
    .setTimestamp();
}

/**
 * Create an embed for server start/stop events.
 */
function serverEventEmbed(eventType) {
  const config = {
    start: { title: '🟢 Server Started', color: 0x2ecc71 },
    stop: { title: '🔴 Server Stopped', color: 0xe74c3c },
  };
  const cfg = config[eventType] || { title: eventType, color: 0x95a5a6 };

  return new EmbedBuilder()
    .setTitle(cfg.title)
    .setColor(cfg.color)
    .setTimestamp();
}

/**
 * Create a poll embed.
 */
function pollEmbed(question, options) {
  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
  const desc = options.map((opt, i) => `${numberEmojis[i]} — ${opt}`).join('\n');

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('📊 ' + question)
    .setDescription(desc)
    .setFooter({ text: `Vote using the reactions below` })
    .setTimestamp();
}

/**
 * Create an event announcement embed.
 */
function eventAnnouncementEmbed(event) {
  const embed = new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle('📅 ' + event.name)
    .setDescription(event.description || 'No description provided.')
    .addFields(
      { name: 'Date', value: event.event_date, inline: true },
      { name: 'Time', value: `${event.event_time} ${event.timezone}`, inline: true },
    )
    .setTimestamp();

  return embed;
}

/**
 * Format a duration string from a Date difference.
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

module.exports = {
  statusEmbed,
  chatMessageEmbed,
  playerEventEmbed,
  advancementEmbed,
  serverEventEmbed,
  pollEmbed,
  eventAnnouncementEmbed,
  formatDuration,
};
