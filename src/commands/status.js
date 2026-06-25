/**
 * /status — Server status.
 *
 * Tries RCON first for live player data, then supplements with
 * mcsrvstat.us for MOTD/version/uptime.  If RCON is unreachable,
 * falls back entirely to the public API.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const rcon = require('../integrations/rcon');
const { fetchStatus } = require('../integrations/mcsrvstat');
const { statusEmbed } = require('../utils/embeds');
const { config } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show the Minecraft server status, player count, and online players'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Primary path: live data via RCON.
      const rconData = await rcon.getOnlinePlayers();
      const embed = new EmbedBuilder()
        .setTitle('\u2705 Server Online')
        .setColor(0x2ecc71)
        .addFields(
          { name: 'Players', value: `${rconData.count}/${rconData.max}`, inline: true },
        );

      if (rconData.players && rconData.players.length > 0) {
        embed.addFields({
          name: 'Online Players',
          value: rconData.players.map((p) => `\`${p}\``).join(', '),
          inline: false,
        });
      }

      // Supplement with public API metadata (non-critical — swallow failures).
      try {
        const meta = await fetchStatus(config.rcon.host);
        if (meta && meta.online) {
          if (meta.version) {
            embed.addFields({ name: 'Version', value: meta.version, inline: true });
          }
          if (meta.software) {
            embed.addFields({ name: 'Software', value: meta.software, inline: true });
          }
          if (meta.motd) {
            embed.setDescription(`*${meta.motd.slice(0, 200)}*`);
          }
        }
      } catch {
        console.warn('[Status] mcsrvstat.us supplement failed (non-fatal).');
      }

      embed.setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      // RCON failed — full fallback to public API.
      console.warn(`[Status] RCON failed, falling back to mcsrvstat.us: ${err.message}`);
      try {
        const mcsrvData = await fetchStatus(config.rcon.host);
        const embed = statusEmbed(mcsrvData);
        await interaction.editReply({ embeds: [embed] });
      } catch (fallbackErr) {
        console.error('[Status] Both RCON and mcsrvstat.us failed:', fallbackErr.message);
        await interaction.editReply({
          content: '\u274C Could not fetch server status. Both RCON and the status API are unreachable.',
        });
      }
    }
  },
};
