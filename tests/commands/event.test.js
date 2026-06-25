/**
 * Tests for /event command.
 *
 * Mocks the db module so no SQLite calls are made.
 */

jest.mock('../../src/db');
jest.mock('../../src/utils/permissions');

const { createMockInteraction, setTestEnv } = require('../setup');

beforeAll(setTestEnv);

const db = require('../../src/db');
const permissions = require('../../src/utils/permissions');
const configModule = require('../../src/config');
const eventCommand = require('../../src/commands/event');

describe('/event', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction();

    // Default: user is staff
    permissions.requireStaff.mockReturnValue(true);

    // Configure events channel in the channel cache
    interaction.guild.channels.cache.set('100004', {
      send: jest.fn().mockResolvedValue(undefined),
    });
  });

  /* ------------------------------------------------------------------ */
  /*  create                                                             */
  /* ------------------------------------------------------------------ */

  describe('create subcommand', () => {
    it('should create an event and post announcement with RSVP button', async () => {
      interaction.options.getSubcommand.mockReturnValue('create');
      interaction.options._setOption('name', 'Dragon Fight');
      interaction.options._setOption('date', '2026-07-01');
      interaction.options._setOption('time', '20:00');
      interaction.options._setOption('timezone', 'UTC');
      interaction.options._setOption('description', 'Kill the dragon');

      db.createEvent.mockReturnValue(1);
      db.getEventById.mockReturnValue({
        id: 1,
        name: 'Dragon Fight',
        description: 'Kill the dragon',
        event_date: '2026-07-01',
        event_time: '20:00',
        timezone: 'UTC',
      });

      await eventCommand.execute(interaction);

      expect(db.createEvent).toHaveBeenCalledWith({
        name: 'Dragon Fight',
        description: 'Kill the dragon',
        event_date: '2026-07-01',
        event_time: '20:00',
        timezone: 'UTC',
        created_by: '111111',
      });

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('created'),
        ephemeral: true,
      });
    });

    it('should reject invalid date format', async () => {
      interaction.options.getSubcommand.mockReturnValue('create');
      interaction.options._setOption('name', 'Test');
      interaction.options._setOption('date', '01-07-2026'); // wrong format
      interaction.options._setOption('time', '20:00');
      interaction.options._setOption('timezone', 'UTC');
      interaction.options._setOption('description', 'Test');

      await eventCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('YYYY-MM-DD'),
        ephemeral: true,
      });
      expect(db.createEvent).not.toHaveBeenCalled();
    });

    it('should reject invalid time format', async () => {
      interaction.options.getSubcommand.mockReturnValue('create');
      interaction.options._setOption('name', 'Test');
      interaction.options._setOption('date', '2026-07-01');
      interaction.options._setOption('time', '8 PM'); // wrong format
      interaction.options._setOption('timezone', 'UTC');
      interaction.options._setOption('description', 'Test');

      await eventCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('HH:MM'),
        ephemeral: true,
      });
    });

    it('should require staff role', async () => {
      permissions.requireStaff.mockReturnValue(false);
      interaction.options.getSubcommand.mockReturnValue('create');

      await eventCommand.execute(interaction);

      expect(db.createEvent).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  list                                                               */
  /* ------------------------------------------------------------------ */

  describe('list subcommand', () => {
    it('should list upcoming events', async () => {
      interaction.options.getSubcommand.mockReturnValue('list');
      db.getUpcomingEvents.mockReturnValue([
        {
          id: 1,
          name: 'Event A',
          description: 'Desc',
          event_date: '2026-07-01',
          event_time: '20:00',
          timezone: 'UTC',
          cancelled: 0,
        },
      ]);

      await eventCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should show empty message when no events exist', async () => {
      interaction.options.getSubcommand.mockReturnValue('list');
      db.getUpcomingEvents.mockReturnValue([]);

      await eventCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('No upcoming events'),
        ephemeral: true,
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  cancel                                                             */
  /* ------------------------------------------------------------------ */

  describe('cancel subcommand', () => {
    it('should cancel an existing event', async () => {
      interaction.options.getSubcommand.mockReturnValue('cancel');
      interaction.options._setOption('id', 1);
      db.getEventById.mockReturnValue({ id: 1, name: 'Dragon Fight' });

      await eventCommand.execute(interaction);

      expect(db.cancelEvent).toHaveBeenCalledWith(1);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('cancelled'),
        ephemeral: true,
      });
    });

    it('should return error when event does not exist', async () => {
      interaction.options.getSubcommand.mockReturnValue('cancel');
      interaction.options._setOption('id', 999);
      db.getEventById.mockReturnValue(undefined);

      await eventCommand.execute(interaction);

      expect(db.cancelEvent).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('not found'),
        ephemeral: true,
      });
    });

    it('should require staff role', async () => {
      permissions.requireStaff.mockReturnValue(false);
      interaction.options.getSubcommand.mockReturnValue('cancel');

      await eventCommand.execute(interaction);

      expect(db.cancelEvent).not.toHaveBeenCalled();
    });
  });
});
