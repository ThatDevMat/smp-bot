const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Look up a player\'s registered Minecraft account')
    .addUserOption((opt) =>
      opt.setName('user')
        .setDescription('The Discord user to look up')
        .setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const registration = db.getPlayerByDiscord(target.id);

    if (!registration) {
      return interaction.reply({
        content: `❌ <@${target.id}> has not registered a Minecraft account yet. Use \`/register\` to link one.`,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Player Lookup')
      .addFields(
        { name: 'Discord User', value: `<@${target.id}>`, inline: true },
        { name: 'Minecraft Username', value: `\`${registration.minecraft_username}\``, inline: true },
        { name: 'Minecraft UUID', value: `\`${registration.minecraft_uuid}\``, inline: false },
        { name: 'Registered', value: registration.registered_at, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
