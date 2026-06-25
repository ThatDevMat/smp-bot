/**
 * Tests for src/integrations/mcsrvstat.js
 *
 * Mocks the https module to simulate API responses without network calls.
 * Mocks the cache module to control cache hit/miss behavior.
 */

jest.mock('https');
jest.mock('../../src/utils/cache');

const https = require('https');
const cache = require('../../src/utils/cache');
const { fetchStatus } = require('../../src/integrations/mcsrvstat');

function mockHttpsResponse(statusCode, body) {
  const req = { on: jest.fn() };
  const res = {
    statusCode,
    on: jest.fn((event, handler) => {
      if (event === 'data') {
        handler(Buffer.from(JSON.stringify(body)));
      }
      if (event === 'end') {
        handler();
      }
    }),
  };

  https.get.mockImplementation((url, cb) => {
    cb(res);
    return req;
  });

  return req;
}

function mockHttpsError(message) {
  const req = {
    on: jest.fn((event, handler) => {
      if (event === 'error') {
        handler(new Error(message));
      }
    }),
  };

  https.get.mockImplementation(() => req);
  return req;
}

describe('mcsrvstat.js / fetchStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ------------------------------------------------------------------ */
  /*  Cache integration                                                  */
  /* ------------------------------------------------------------------ */

  describe('cache integration', () => {
    const cachedStatus = {
      online: true,
      players: { online: 3, max: 20, list: ['A', 'B'] },
      version: '1.21',
    };

    it('should return cached status without calling https when cache is warm', async () => {
      cache.getCachedServerStatus.mockReturnValue(cachedStatus);

      const result = await fetchStatus('play.example.com');

      expect(cache.getCachedServerStatus).toHaveBeenCalled();
      expect(https.get).not.toHaveBeenCalled();
      expect(result).toEqual(cachedStatus);
    });

    it('should call https and cache result on cache miss', async () => {
      cache.getCachedServerStatus.mockReturnValue(null);
      mockHttpsResponse(200, {
        ip: '1.2.3.4',
        port: 25565,
        online: true,
        version: '1.21',
        software: 'Paper',
        players: { online: 3, max: 20, list: ['A', 'B'] },
        motd: { clean: ['Hello'] },
      });

      await fetchStatus('play.example.com');

      expect(https.get).toHaveBeenCalledTimes(1);
      expect(cache.setCachedServerStatus).toHaveBeenCalled();
    });

    it('should return stale cached result with stale:true on fetch failure when cache is warm', async () => {
      // First call: cache miss → HTTP success → cache set
      cache.getCachedServerStatus
        .mockReturnValueOnce(null);
      cache.setCachedServerStatus.mockImplementation(() => {});
      mockHttpsResponse(200, {
        ip: '1.2.3.4',
        online: true,
        players: { online: 3, max: 20, list: ['A', 'B'] },
        version: '1.21',
      });
      await fetchStatus('play.example.com');

      // Second call: cache miss at the top-level check (triggers HTTP),
      // then in the error handler the cache IS warm (stale data).
      https.get.mockReset();
      https.get.mockImplementation(() => {
        const req = { on: jest.fn() };
        process.nextTick(() => {
          req.on.mock.calls
            .filter((c) => c[0] === 'error')
            .forEach((c) => c[1](new Error('Connection refused')));
        });
        return req;
      });
      cache.getCachedServerStatus
        .mockReset()
        .mockReturnValueOnce(null)       // top-level: cache miss
        .mockReturnValue(cachedStatus);  // error handler: stale fallback

      const result = await fetchStatus('play.example.com');

      expect(result.stale).toBe(true);
      expect(result.online).toBe(cachedStatus.online);
      expect(result.version).toBe('1.21');
    });

    it('should throw original error on fetch failure when cache is cold', async () => {
      cache.getCachedServerStatus.mockReturnValue(null);
      mockHttpsError('Connection refused');

      await expect(fetchStatus('down.example.com')).rejects.toThrow(
        'mcsrvstat.us request failed: Connection refused',
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Core fetch behavior                                                */
  /* ------------------------------------------------------------------ */

  it('should return a structured status object for an online server', async () => {
    cache.getCachedServerStatus.mockReturnValue(null);
    mockHttpsResponse(200, {
      ip: '1.2.3.4',
      port: 25565,
      online: true,
      version: '1.21',
      software: 'Paper',
      players: { online: 3, max: 20, list: ['A', 'B'] },
      motd: { clean: ['Hello World'] },
      uptime: 3600,
    });

    const result = await fetchStatus('play.example.com');

    expect(result.online).toBe(true);
    expect(result.ip).toBe('1.2.3.4');
    expect(result.players.online).toBe(3);
    expect(result.players.list).toEqual(['A', 'B']);
    expect(result.version).toBe('1.21');
    expect(result.software).toBe('Paper');
    expect(result.motd).toBe('Hello World');
  });

  it('should return offline status when the server is not found', async () => {
    cache.getCachedServerStatus.mockReturnValue(null);
    mockHttpsResponse(200, { ip: '', online: false });

    const result = await fetchStatus('unknown.example.com');

    expect(result.online).toBe(false);
    expect(result.error).toBe('Server not found');
  });

  it('should handle missing player list gracefully', async () => {
    cache.getCachedServerStatus.mockReturnValue(null);
    mockHttpsResponse(200, {
      ip: '1.2.3.4',
      online: true,
      players: null,
    });

    const result = await fetchStatus('play.example.com');

    expect(result.players.online).toBe(0);
    expect(result.players.list).toEqual([]);
  });

  it('should handle missing MOTD clean array gracefully', async () => {
    cache.getCachedServerStatus.mockReturnValue(null);
    mockHttpsResponse(200, {
      ip: '1.2.3.4',
      online: true,
      motd: null,
    });

    const result = await fetchStatus('play.example.com');

    expect(result.motd).toBe('');
  });

  it('should reject on network error', async () => {
    cache.getCachedServerStatus.mockReturnValue(null);
    mockHttpsError('Connection refused');

    await expect(fetchStatus('down.example.com')).rejects.toThrow(
      'mcsrvstat.us request failed: Connection refused',
    );
  });

  it('should reject when JSON parsing fails', async () => {
    cache.getCachedServerStatus.mockReturnValue(null);
    const req = { on: jest.fn() };
    const res = {
      statusCode: 200,
      on: jest.fn((event, handler) => {
        if (event === 'data') handler(Buffer.from('not-json'));
        if (event === 'end') handler();
      }),
    };

    https.get.mockImplementation((url, cb) => {
      cb(res);
      return req;
    });

    await expect(fetchStatus('bad.example.com')).rejects.toThrow(
      'Failed to parse mcsrvstat.us response',
    );
  });

  it('should append port to URL when port is not 25565', async () => {
    cache.getCachedServerStatus.mockReturnValue(null);
    mockHttpsResponse(200, { ip: '1.2.3.4', online: false });

    await fetchStatus('play.example.com', 25566);

    const calledUrl = https.get.mock.calls[0][0];
    expect(calledUrl).toContain(':25566');
  });
});
