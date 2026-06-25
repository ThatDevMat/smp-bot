const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const advancedbans = require('../integrations/advancedbans');
const mojang = require('../integrations/mojang');
const { requireStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show full punishment history for a player (staff only)')
    .addStringOption((opt) =>
      opt.setName('player')
        .setDescription('Minecraft username or UUID')
        .setRequired(true)),

  async execute(interaction) {
    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const input = interaction.options.getString('player');

    try {
      const isUuid = /^[a-fA-F0-9-]{32,36}$/.test(input);
      let uuid = isUuid ? input.replace(/-/g, '') : null;

      if (!uuid) {
        const profile = await mojang.getUuidByUsername(input);
        if (!profile) {
          return interaction.editReply({ content: `❌ Could not find Minecraft account "${input}".` });
        }
        uuid = profile.uuid;
      }

      const history = await advancedbans.getPunishmentHistory(uuid);

      if (history.length === 0) {
        return interaction.editReply({ content: `📝 \`${input}\` has no punishment history.` });
      }

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle(`📜 Punishment History — ${input}`)
        .setFooter({ text: `Total entries: ${history.length}` })
        .setTimestamp();

      // Show most recent 10 entries
      const entries = history.slice(0, 10);
      entries.forEach((p) => {
        const status = p.active ? '🟢 Active' : '🔴 Expired';
        const duration = p.end ? `Expires: ${new Date(p.end).toLocaleString()}` : 'Permanent';
        embed.addFields({
          name: `${status} — ${p.type.toUpperCase()} — ${new Date(p.start).toLocaleString()}`,
          value: `Reason: ${p.reason || 'No reason'}\n${duration}\nBy: ${p.executor || 'Unknown'}`,
          inline: false,
        });
      });

      if (history.length > 10) {
        embed.setDescription(`*Showing 10 of ${history.length} entries*`);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ content: `❌ Database error: ${err.message}` });
    }
  },
};
