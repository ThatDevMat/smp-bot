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
      // Try RCON first for live data
      const rconData = await rcon.getOnlinePlayers();
      const embed = new EmbedBuilder()
        .setTitle('✅ Server Online')
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

      // Try mcsrvstat.us as a supplement for MOTD/version/uptime
      try {
        const mcsrvData = await fetchStatus(config.rcon.host);
        if (mcsrvData && mcsrvData.online) {
          if (mcsrvData.version) embed.addFields({ name: 'Version', value: mcsrvData.version, inline: true });
          if (mcsrvData.software) embed.addFields({ name: 'Software', value: mcsrvData.software, inline: true });
          if (mcsrvData.motd) embed.setDescription(`*${mcsrvData.motd.slice(0, 200)}*`);
        }
      } catch {
        // mcsrvstat.us is just a supplement — ignore failures
      }

      embed.setTimestamp();
      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      // RCON failed — fall back to mcsrvstat.us entirely
      try {
        const mcsrvData = await fetchStatus(config.rcon.host);
        const embed = statusEmbed(mcsrvData);
        await interaction.editReply({ embeds: [embed] });
      } catch (mcsrvErr) {
        await interaction.editReply({
          content: '❌ Could not fetch server status. Both RCON and the status API are unreachable.',
        });
      }
    }
  },
};
