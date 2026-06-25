/**
 * Tests for src/integrations/rcon.js
 *
 * Mocks rcon-client so no real socket connections are made.
 * Uses jest.isolateModules to reset the singleton RCON client state
 * between tests.
 */

jest.mock('rcon-client');

const { Rcon } = require('rcon-client');

// Will be assigned in beforeEach via isolateModules
let rcon;

function createMockRconClient(overrides = {}) {
  return {
    authenticated: true,
    send: jest.fn().mockResolvedValue(''),
    end: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('rcon.js', () => {
  let mockClient;

  beforeEach(() => {
    jest.resetAllMocks();
    mockClient = createMockRconClient();
    Rcon.connect.mockResolvedValue(mockClient);

    // Re-import in isolated scope to reset the module singleton.
    jest.isolateModules(() => {
      rcon = require('../../src/integrations/rcon');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  connect / disconnect                                               */
  /* ------------------------------------------------------------------ */

  describe('connect', () => {
    it('should connect successfully when password is configured', async () => {
      const result = await rcon.connect();

      expect(Rcon.connect).toHaveBeenCalledWith(
        expect.objectContaining({ host: '127.0.0.1', port: 25575 }),
      );
      expect(result).toBe(mockClient);
    });

    it('should return null when connection fails', async () => {
      Rcon.connect.mockRejectedValue(new Error('Connection refused'));

      const result = await rcon.connect();

      expect(result).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should call end() on the connected client', async () => {
      await rcon.connect();
      await rcon.disconnect();

      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should not throw when called without a connection', async () => {
      await expect(rcon.disconnect()).resolves.toBeUndefined();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  send                                                               */
  /* ------------------------------------------------------------------ */

  describe('send', () => {
    it('should send a raw command via RCON', async () => {
      await rcon.connect();
      mockClient.send.mockResolvedValue('Expected response');

      const result = await rcon.send('list');

      expect(mockClient.send).toHaveBeenCalledWith('list');
      expect(result).toBe('Expected response');
    });

    it('should re-connect on demand when not connected', async () => {
      mockClient.send.mockResolvedValue('OK');

      const result = await rcon.send('list');

      expect(Rcon.connect).toHaveBeenCalled();
      expect(result).toBe('OK');
    });

    it('should throw when reconnection also fails', async () => {
      Rcon.connect.mockRejectedValue(new Error('Still down'));

      await expect(rcon.send('list')).rejects.toThrow('RCON is not connected');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getOnlinePlayers                                                   */
  /* ------------------------------------------------------------------ */

  describe('getOnlinePlayers', () => {
    it('should parse the standard /list output', async () => {
      await rcon.connect();
      mockClient.send.mockResolvedValue(
        'There are 3 of a max of 20 players online: Steve, Alex, Notch',
      );

      const result = await rcon.getOnlinePlayers();

      expect(result).toEqual({ count: 3, max: 20, players: ['Steve', 'Alex', 'Notch'] });
    });

    it('should parse the alternative /list format', async () => {
      await rcon.connect();
      mockClient.send.mockResolvedValue('There are 2 of 20 players online: Alice, Bob');

      const result = await rcon.getOnlinePlayers();

      expect(result).toEqual({ count: 2, max: 20, players: ['Alice', 'Bob'] });
    });

    it('should return empty player list when /list has no players', async () => {
      await rcon.connect();
      mockClient.send.mockResolvedValue('There are 0 of a max of 20 players online:');

      const result = await rcon.getOnlinePlayers();

      expect(result.players).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should return zeros when parsing fails completely', async () => {
      await rcon.connect();
      mockClient.send.mockResolvedValue('Unexpected response format');

      const result = await rcon.getOnlinePlayers();

      expect(result).toEqual({ count: 0, max: 0, players: [] });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  whitelistAdd / whitelistRemove                                      */
  /* ------------------------------------------------------------------ */

  describe('whitelistAdd', () => {
    it('should send whitelist add with a valid username', async () => {
      await rcon.connect();
      mockClient.send.mockResolvedValue('Added Steve to whitelist');

      const result = await rcon.whitelistAdd('Steve');

      expect(mockClient.send).toHaveBeenCalledWith('whitelist add Steve');
      expect(result).toBe('Added Steve to whitelist');
    });

    it('should throw for invalid usernames', async () => {
      await expect(rcon.whitelistAdd('Steve; op Notch')).rejects.toThrow(
        'Invalid Minecraft username',
      );
    });

    it('should throw for usernames with spaces', async () => {
      await expect(rcon.whitelistAdd('Steve Alex')).rejects.toThrow();
    });

    it('should throw for overly long usernames', async () => {
      await expect(rcon.whitelistAdd('a'.repeat(17))).rejects.toThrow();
    });
  });

  describe('whitelistRemove', () => {
    it('should send whitelist remove with a valid username', async () => {
      await rcon.connect();
      mockClient.send.mockResolvedValue('Removed Alex from whitelist');

      const result = await rcon.whitelistRemove('Alex');

      expect(mockClient.send).toHaveBeenCalledWith('whitelist remove Alex');
      expect(result).toBe('Removed Alex from whitelist');
    });

    it('should throw for invalid usernames', async () => {
      await expect(rcon.whitelistRemove('')).rejects.toThrow();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  broadcast                                                          */
  /* ------------------------------------------------------------------ */

  describe('broadcast', () => {
    it('should send a say command with the message', async () => {
      await rcon.connect();
      mockClient.send.mockResolvedValue('');

      await rcon.broadcast('Server restart in 10 minutes');

      expect(mockClient.send).toHaveBeenCalledWith('say Server restart in 10 minutes');
    });

    it('should truncate messages longer than 256 characters', async () => {
      await rcon.connect();
      const longMsg = 'x'.repeat(300);

      await rcon.broadcast(longMsg);

      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.length).toBeLessThan(300);
    });
  });
});
