/**
 * Tests for /status command.
 *
 * Mocks RCON (primary path) and mcsrvstat (supplement/fallback).
 */

jest.mock('../../src/integrations/rcon');
jest.mock('../../src/integrations/mcsrvstat');

const { createMockInteraction, setTestEnv } = require('../setup');

beforeAll(setTestEnv);

const rcon = require('../../src/integrations/rcon');
const mcsrvstat = require('../../src/integrations/mcsrvstat');
const statusCommand = require('../../src/commands/status');

describe('/status', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction();
  });

  it('should show online status with player counts and version when RCON succeeds', async () => {
    rcon.getOnlinePlayers.mockResolvedValue({
      count: 3,
      max: 20,
      players: ['Steve', 'Alex'],
    });
    mcsrvstat.fetchStatus.mockResolvedValue({
      online: true,
      version: '1.21',
      software: 'Paper',
      motd: 'Welcome',
    });

    await statusCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    const embed = interaction._lastEmbeds[0];
    expect(embed.data.title).toContain('Server Online');
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Players', value: '3/20' }),
        expect.objectContaining({ name: 'Version', value: '1.21' }),
      ]),
    );
  });

  it('should fall back to mcsrvstat.us when RCON fails', async () => {
    rcon.getOnlinePlayers.mockRejectedValue(new Error('Connection refused'));
    mcsrvstat.fetchStatus.mockResolvedValue({
      online: true,
      players: { online: 5, max: 20, list: [] },
      version: '1.20',
    });

    await statusCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalled();
    const embed = interaction._lastEmbeds[0];
    expect(embed.data.title).toContain('Server Online');
  });

  it('should show offline message when both RCON and mcsrvstat fail', async () => {
    rcon.getOnlinePlayers.mockRejectedValue(new Error('RCON down'));
    mcsrvstat.fetchStatus.mockRejectedValue(new Error('API down'));

    await statusCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('unreachable'),
    });
  });

  it('should show player list when players are online', async () => {
    rcon.getOnlinePlayers.mockResolvedValue({
      count: 2,
      max: 20,
      players: ['Steve', 'Alex'],
    });
    mcsrvstat.fetchStatus.mockResolvedValue({ online: true });

    await statusCommand.execute(interaction);

    const embed = interaction._lastEmbeds[0];
    const playersField = embed.data.fields.find(
      (f) => f.name === 'Online Players',
    );
    expect(playersField).toBeDefined();
    expect(playersField.value).toContain('Steve');
  });

  it('should add stale warning footer when supplement returns stale data', async () => {
    rcon.getOnlinePlayers.mockResolvedValue({
      count: 3,
      max: 20,
      players: ['Steve'],
    });
    mcsrvstat.fetchStatus.mockResolvedValue({
      online: true,
      version: '1.21',
      stale: true,
    });

    await statusCommand.execute(interaction);

    const embed = interaction._lastEmbeds[0];
    expect(embed.data.footer.text).toContain('outdated');
    expect(embed.data.footer.text).toContain('API unreachable');
  });

  it('should add stale warning footer in fallback path when stale data returned', async () => {
    rcon.getOnlinePlayers.mockRejectedValue(new Error('RCON down'));
    mcsrvstat.fetchStatus.mockResolvedValue({
      online: true,
      players: { online: 5, max: 20, list: [] },
      version: '1.20',
      stale: true,
    });

    await statusCommand.execute(interaction);

    const embed = interaction._lastEmbeds[0];
    expect(embed.data.footer.text).toContain('outdated');
    expect(embed.data.footer.text).toContain('API unreachable');
  });
});
