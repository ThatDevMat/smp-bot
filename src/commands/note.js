/**
 * /note — Manage player notes (add, list, remove).
 *
 * Subcommands:
 *   add <player> <note>   — Add a note about a player (staff only)
 *   list <player>         — List all notes for a player
 *   remove <id>           — Remove a note by its ID (staff only)
 *
 * All inputs validated through Zod before processing.
 * Audit log entries are created for add and remove actions.
 */

const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { requireStaff } = require('../utils/permissions');
const { resolvePlayer } = require('../utils/playerResolver');
const {
  noteAddEmbed,
  noteListEmbed,
  noteRemoveEmbed,
} = require('../utils/embeds');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validate');
const {
  NoteAddInput,
  NoteListInput,
  NoteRemoveInput,
} = require('../schemas/moderation');
const { logAction } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Manage player notes')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a note about a player (staff only)')
        .addStringOption((opt) =>
          opt
            .setName('player')
            .setDescription('Minecraft username or UUID')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('note').setDescription('Note content').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all notes for a player')
        .addStringOption((opt) =>
          opt
            .setName('player')
            .setDescription('Minecraft username or UUID')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a note by its ID (staff only)')
        .addIntegerOption((opt) =>
          opt
            .setName('id')
            .setDescription('Note ID to remove')
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      await handleAdd(interaction);
    } else if (subcommand === 'list') {
      await handleList(interaction);
    } else if (subcommand === 'remove') {
      await handleRemove(interaction);
    }
  },
};

/* ------------------------------------------------------------------ */
/*  /note add                                                          */
/* ------------------------------------------------------------------ */

async function handleAdd(interaction) {
  // 1. Validate input.
  const rawInput = {
    player: interaction.options.getString('player'),
    note: interaction.options.getString('note'),
  };

  let input;
  try {
    input = validateInput(NoteAddInput, rawInput);
  } catch (err) {
    return interaction.reply({
      content: `\u274C ${err.userMessage}`,
      ephemeral: true,
    });
  }

  if (!requireStaff(interaction)) return;
  await interaction.deferReply({ ephemeral: true });

  try {
    const player = await resolvePlayer(input.player);
    if (!player) {
      return interaction.editReply({
        content: `\u274C Could not find Minecraft account "${input.player}".`,
      });
    }

    const result = db.addNote({
      playerUuid: player.uuid,
      note: input.note,
      addedBy: interaction.user.id,
    });

    const embed = noteAddEmbed({
      noteId: result.lastInsertRowid,
      playerName: player.username,
      playerUuid: player.uuid,
      note: input.note,
      addedBy: interaction.user.id,
    });

    await logAction({
      client: interaction.client,
      type: 'note_add',
      staff: interaction.user,
      target: player.username,
      details: input.note,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('Note add error', {
      player: input.player,
      userId: interaction.user.id,
      error: err.message,
      stack: err.stack,
    });
    await interaction.editReply({
      content: '\u274C An error occurred while adding the note.',
    });
  }
}

/* ------------------------------------------------------------------ */
/*  /note list                                                         */
/* ------------------------------------------------------------------ */

async function handleList(interaction) {
  // 1. Validate input.
  const rawInput = {
    player: interaction.options.getString('player'),
  };

  let input;
  try {
    input = validateInput(NoteListInput, rawInput);
  } catch (err) {
    return interaction.reply({
      content: `\u274C ${err.userMessage}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const player = await resolvePlayer(input.player);
    if (!player) {
      return interaction.editReply({
        content: `\u274C Could not find Minecraft account "${input.player}".`,
      });
    }

    const notes = db.getPlayerNotes(player.uuid);
    const embed = noteListEmbed(player.username, notes);

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('Note list error', {
      player: input.player,
      userId: interaction.user.id,
      error: err.message,
      stack: err.stack,
    });
    await interaction.editReply({
      content: '\u274C An error occurred while looking up notes.',
    });
  }
}

/* ------------------------------------------------------------------ */
/*  /note remove                                                       */
/* ------------------------------------------------------------------ */

async function handleRemove(interaction) {
  // 1. Validate input.
  const rawInput = {
    id: interaction.options.getInteger('id'),
  };

  let input;
  try {
    input = validateInput(NoteRemoveInput, rawInput);
  } catch (err) {
    return interaction.reply({
      content: `\u274C ${err.userMessage}`,
      ephemeral: true,
    });
  }

  if (!requireStaff(interaction)) return;
  await interaction.deferReply({ ephemeral: true });

  try {
    // Fetch the note first so we know which player it was for (for the embed).
    const dbInstance = db.getDb();
    const note = dbInstance
      .prepare('SELECT * FROM player_notes WHERE id = ?')
      .get(input.id);

    if (!note) {
      return interaction.editReply({
        content: `\u274C Note #${input.id} not found.`,
      });
    }

    db.deleteNote(input.id);

    const embed = noteRemoveEmbed(input.id, note.uuid);

    await logAction({
      client: interaction.client,
      type: 'note_remove',
      staff: interaction.user,
      target: `Note #${input.id} (UUID: ${note.uuid})`,
      details: note.note,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('Note remove error', {
      noteId: input.id,
      userId: interaction.user.id,
      error: err.message,
      stack: err.stack,
    });
    await interaction.editReply({
      content: '\u274C An error occurred while removing the note.',
    });
  }
}
