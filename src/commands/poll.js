const { SlashCommandBuilder } = require('discord.js');
const { pollEmbed } = require('../utils/embeds');
const { config } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll with reaction voting')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('option1').setDescription('Option 1').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('option2').setDescription('Option 2').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('option3').setDescription('Option 3').setRequired(false))
    .addStringOption((opt) =>
      opt.setName('option4').setDescription('Option 4').setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [
      interaction.options.getString('option1'),
      interaction.options.getString('option2'),
      interaction.options.getString('option3'),
      interaction.options.getString('option4'),
    ].filter(Boolean);

    if (options.length < 2) {
      return interaction.reply({ content: '❌ A poll needs at least 2 options.', ephemeral: true });
    }

    const embed = pollEmbed(question, options);

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

    // Send to the polls channel if configured, otherwise reply directly
    if (config.channels.polls) {
      const pollsChannel = interaction.guild.channels.cache.get(config.channels.polls);
      if (pollsChannel) {
        const pollMsg = await pollsChannel.send({
          content: `📊 **Poll by ${interaction.user.tag}**`,
          embeds: [embed],
        });

        // Add reaction options
        for (let i = 0; i < options.length; i++) {
          await pollMsg.react(numberEmojis[i]);
        }

        await interaction.reply({ content: `✅ Poll posted in <#${config.channels.polls}>.`, ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Polls channel not found. Check CHANNEL_POLLS config.', ephemeral: true });
      }
    } else {
      // Reply in the current channel
      const pollMsg = await interaction.reply({
        content: `📊 **Poll by ${interaction.user.tag}**`,
        embeds: [embed],
        fetchReply: true,
      });

      for (let i = 0; i < options.length; i++) {
        await pollMsg.react(numberEmojis[i]);
      }
    }
  },
};
