const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const mojang = require('../integrations/mojang');
const { requireStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warning history for a player (staff only)')
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
      let username = input;

      if (!uuid) {
        const profile = await mojang.getUuidByUsername(input);
        if (!profile) {
          return interaction.editReply({ content: `❌ Could not find Minecraft account "${input}".` });
        }
        uuid = profile.uuid;
        username = profile.username;
      }

      const warnings = db.getWarningsByUuid(uuid);

      if (warnings.length === 0) {
        return interaction.editReply({ content: `✅ \`${username}\` has no local warnings.` });
      }

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`⚠️ Local Warnings — ${username}`)
        .setFooter({ text: `Total: ${warnings.length}` })
        .setTimestamp();

      warnings.slice(0, 10).forEach((w) => {
        embed.addFields({
          name: `#${w.id} — ${w.issued_at}`,
          value: `Reason: ${w.reason}\nIssued by: <@${w.issued_by}>`,
          inline: false,
        });
      });

      if (warnings.length > 10) {
        embed.setDescription(`*Showing 10 of ${warnings.length} entries*`);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ content: `❌ Error: ${err.message}` });
    }
  },
};
