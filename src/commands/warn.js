const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const mojang = require('../integrations/mojang');
const { requireStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a player (staff only)')
    .addStringOption((opt) =>
      opt.setName('player')
        .setDescription('Minecraft username or UUID')
        .setRequired(true))
    .addStringOption((opt) =>
      opt.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)),

  async execute(interaction) {
    if (!requireStaff(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const input = interaction.options.getString('player');
    const reason = interaction.options.getString('reason');

    try {
      // Resolve UUID
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

      // Check if the player has a linked Discord account
      const registration = db.getPlayerByUuid(uuid);

      db.addWarning({
        playerUuid: uuid,
        discordId: registration ? registration.discord_id : null,
        reason,
        issuedBy: interaction.user.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('⚠️ Warning Issued')
        .addFields(
          { name: 'Player', value: `\`${username}\` (UUID: \`${uuid}\`)`, inline: false },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // DM the linked Discord user if registered
      if (registration) {
        try {
          const warnedUser = await interaction.client.users.fetch(registration.discord_id);
          if (warnedUser) {
            await warnedUser.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xf1c40f)
                  .setTitle('⚠️ You Have Been Warned')
                  .setDescription(`You have received a warning on the SMP server.`)
                  .addFields(
                    { name: 'Minecraft Account', value: `\`${username}\``, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                  )
                  .setTimestamp(),
              ],
            });
          }
        } catch {
          // DM might fail if user has DMs disabled — ignore silently
        }
      }
    } catch (err) {
      await interaction.editReply({ content: `❌ Error: ${err.message}` });
    }
  },
};
