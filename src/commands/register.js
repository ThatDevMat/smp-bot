const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const mojang = require('../integrations/mojang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Link your Discord account to your Minecraft username')
    .addStringOption((opt) =>
      opt.setName('minecraft_username')
        .setDescription('Your Minecraft username')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('minecraft_username');

    // Fetch UUID from Mojang API
    const profile = await mojang.getUuidByUsername(username);
    if (!profile) {
      return interaction.editReply({
        content: `❌ Could not find a Minecraft account with the username "${username}". Make sure you typed it correctly and the account exists.`,
      });
    }

    // Store the registration
    db.registerPlayer(interaction.user.id, profile.username, profile.uuid);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Registration Successful')
      .addFields(
        { name: 'Discord User', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Minecraft Username', value: `\`${profile.username}\``, inline: true },
        { name: 'Minecraft UUID', value: `\`${profile.uuid}\``, inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
