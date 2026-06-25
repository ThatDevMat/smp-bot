/**
 * Tests for /cache command.
 *
 * Mocks the cache module and permissions so no real cache operations run.
 */

const { createMockInteraction, setTestEnv } = require('../setup');

beforeAll(setTestEnv);

jest.mock('../../src/utils/cache');
jest.mock('../../src/utils/permissions');

const cache = require('../../src/utils/cache');
const permissions = require('../../src/utils/permissions');
const cacheCommand = require('../../src/commands/cache');

describe('/cache', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction();

    // Default: cache.stats returns sensible numbers.
    cache.getStats.mockReturnValue({
      hits: 42,
      misses: 7,
      keys: 3,
    });
    cache.getStatusTtl.mockReturnValue(12);
  });

  /* ------------------------------------------------------------------ */
  /*  /cache stats                                                      */
  /* ------------------------------------------------------------------ */

  it('should show cache stats embed when /cache stats is run', async () => {
    interaction.options.getSubcommand.mockReturnValue('stats');

    await cacheCommand.execute(interaction);

    expect(cache.getStats).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalled();

    const replyArgs = interaction.reply.mock.calls[0][0];
    expect(replyArgs.embeds).toBeDefined();
    expect(replyArgs.embeds.length).toBe(1);
    expect(replyArgs.embeds[0].data.title).toContain('Cache Statistics');
  });

  /* ------------------------------------------------------------------ */
  /*  /cache flush                                                      */
  /* ------------------------------------------------------------------ */

  it('should flush cache and reply with confirmation when staff runs flush', async () => {
    interaction.options.getSubcommand.mockReturnValue('flush');
    permissions.requireStaff.mockReturnValue(true);

    await cacheCommand.execute(interaction);

    expect(cache.flushAll).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('cleared'),
      ephemeral: true,
    });
  });

  it('should not flush cache when non-staff user runs flush', async () => {
    interaction.options.getSubcommand.mockReturnValue('flush');
    permissions.requireStaff.mockImplementation(() => false);

    await cacheCommand.execute(interaction);

    expect(cache.flushAll).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('permission'),
      ephemeral: true,
    });
  });
});
