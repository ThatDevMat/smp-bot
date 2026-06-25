/**
 * Discord.js event: InteractionCreate.
 *
 * Routes all interactions:
 *   - Button clicks → RSVP handler
 *   - Slash commands → dispatch to the registered command handler
 *
 * This is the central error boundary for all command execution —
 * every uncaught error in a command is caught here and reported as
 * a generic "something went wrong" message to the user.
 */

const { Events } = require('discord.js');
const db = require('../db');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ---- Button interactions (RSVP) ----
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('rsvp_')) {
        await handleRsvp(interaction);
      }
      return;
    }

    // ---- Slash commands ----
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching "${interaction.commandName}" was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(
        `Error executing /${interaction.commandName} (user ${interaction.user.tag}):`,
        error,
      );

      const message = '\u274C An error occurred while executing this command.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  },
};

/* ------------------------------------------------------------------ */

async function handleRsvp(interaction) {
  const eventId = parseInt(interaction.customId.split('_')[1], 10);
  const event = db.getEventById(eventId);

  if (!event || event.cancelled) {
    return interaction.reply({
      content: '\u274C This event has been cancelled or no longer exists.',
      ephemeral: true,
    });
  }

  db.addRsvp(eventId, interaction.user.id);
  const count = db.getRsvpCount(eventId);

  await interaction.reply({
    content: `\u2705 You have RSVP'd for **${event.name}**! (${count} attending)`,
    ephemeral: true,
  });
}
