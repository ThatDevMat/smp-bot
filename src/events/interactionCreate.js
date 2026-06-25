const { Events } = require('discord.js');
const db = require('../db');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Handle button interactions (RSVP buttons)
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // RSVP button: customId format = "rsvp_<eventId>"
      if (customId.startsWith('rsvp_')) {
        const eventId = parseInt(customId.split('_')[1], 10);
        const event = db.getEventById(eventId);

        if (!event || event.cancelled) {
          return interaction.reply({ content: '❌ This event has been cancelled or no longer exists.', ephemeral: true });
        }

        db.addRsvp(eventId, interaction.user.id);
        const count = db.getRsvpCount(eventId);

        return interaction.reply({
          content: `✅ You've RSVP'd for **${event.name}**! (${count} attending)`,
          ephemeral: true,
        });
      }
    }

    // Handle slash commands
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);

      const message = '❌ An error occurred while executing this command.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  },
};
