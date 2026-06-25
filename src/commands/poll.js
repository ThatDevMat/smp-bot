/**
 * /poll — Create a reaction-based poll.
 *
 * Posts an embed with numbered options and adds reaction emojis for
 * voting.  Sends to the configured polls channel when available,
 * otherwise replies in the current channel.
 */

const { SlashCommandBuilder } = require('discord.js');
const { pollEmbed } = require('../utils/embeds');
const { config } = require('../config');
const logger = require('../utils/logger');

const NUMBER_EMOJIS = [
  '1\uFE0F\u20E3',
  '2\uFE0F\u20E3',
  '3\uFE0F\u20E3',
  '4\uFE0F\u20E3',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll with reaction voting')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('Poll question').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('option1').setDescription('Option 1').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('option2').setDescription('Option 2').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('option3').setDescription('Option 3').setRequired(false),
    )
    .addStringOption((opt) =>
      opt.setName('option4').setDescription('Option 4').setRequired(false),
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [
      interaction.options.getString('option1'),
      interaction.options.getString('option2'),
      interaction.options.getString('option3'),
      interaction.options.getString('option4'),
    ].filter(Boolean);

    if (options.length < 2) {
      return interaction.reply({
        content: '\u274C A poll needs at least 2 options.',
        ephemeral: true,
      });
    }

    const embed = pollEmbed(question, options);

    try {
      let pollMsg;

      if (config.channels.polls) {
        const pollsChannel = interaction.guild.channels.cache.get(
          config.channels.polls,
        );
        if (!pollsChannel) {
          return interaction.reply({
            content:
              '\u274C Polls channel not found. Check CHANNEL_POLLS config.',
            ephemeral: true,
          });
        }

        pollMsg = await pollsChannel.send({
          content: `\u{1F4CA} **Poll by ${interaction.user.tag}**`,
          embeds: [embed],
        });

        await interaction.reply({
          content: `\u2705 Poll posted in <#${config.channels.polls}>.`,
          ephemeral: true,
        });
      } else {
        // Reply in the current channel.
        pollMsg = await interaction.reply({
          content: `\u{1F4CA} **Poll by ${interaction.user.tag}**`,
          embeds: [embed],
          fetchReply: true,
        });
      }

      // Add reaction options (one by one to preserve order).
      for (let i = 0; i < options.length; i++) {
        await pollMsg.react(NUMBER_EMOJIS[i]);
      }
    } catch (err) {
      logger.error('Poll command error', {
        userId: interaction.user.id,
        error: err.message,
        stack: err.stack,
      });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '\u274C Could not create the poll. Check bot permissions.',
          ephemeral: true,
        });
      }
    }
  },
};
