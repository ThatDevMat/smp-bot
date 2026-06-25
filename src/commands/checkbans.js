const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const advancedbans = require('../integrations/advancedbans');
const mojang = require('../integrations/mojang');
const { requireStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkbans')
    .setDescription('Check active punishments for a player (staff only)')
    .addStringOption((opt) =>
      opt.setName('player')
        .setDescription('Minecraft username or UUID')
        .setRequired(true)),

  async execute(interaction) {
    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const input = interaction.options.getString('player');

    try {
      // Determine if input is UUID or username
      const isUuid = /^[a-fA-F0-9-]{32,36}$/.test(input);
      let uuid = isUuid ? input.replace(/-/g, '') : null;

      if (!uuid) {
        const profile = await mojang.getUuidByUsername(input);
        if (!profile) {
          return interaction.editReply({ content: `❌ Could not find Minecraft account "${input}".` });
        }
        uuid = profile.uuid;
      }

      const punishments = await advancedbans.getActivePunishments(uuid);

      if (punishments.length === 0) {
        return interaction.editReply({ content: `✅ \`${input}\` has no active punishments.` });
      }

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`⛔ Active Punishments for ${input}`)
        .setTimestamp();

      punishments.forEach((p) => {
        const duration = p.end ? `Expires: ${new Date(p.end).toLocaleString()}` : 'Permanent';
        embed.addFields({
          name: `${p.type.toUpperCase()} — ${new Date(p.start).toLocaleString()}`,
          value: `Reason: ${p.reason || 'No reason provided'}\n${duration}\nBy: ${p.executor || 'Unknown'}`,
          inline: false,
        });
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ content: `❌ Database error: ${err.message}` });
    }
  },
};
