/**
 * Tests for src/integrations/mojang.js
 *
 * Mocks the https module to simulate Mojang API responses.
 */

jest.mock('https');

const https = require('https');
const mojang = require('../../src/integrations/mojang');

function mockHttpsResponse(statusCode, body) {
  const req = { on: jest.fn() };
  const res = {
    statusCode,
    resume: jest.fn(),
    on: jest.fn((event, handler) => {
      if (event === 'data') {
        handler(
          Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
        );
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
      if (event === 'error') handler(new Error(message));
    }),
  };

  https.get.mockImplementation(() => req);
  return req;
}

describe('mojang.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ------------------------------------------------------------------ */
  /*  getUuidByUsername                                                  */
  /* ------------------------------------------------------------------ */

  describe('getUuidByUsername', () => {
    it('should return uuid and username on a successful lookup', async () => {
      mockHttpsResponse(200, {
        id: 'abc123def456abc123def456abc12345',
        name: 'Steve',
      });

      const result = await mojang.getUuidByUsername('Steve');

      expect(result).toEqual({
        uuid: 'abc123def456abc123def456abc12345',
        username: 'Steve',
      });
    });

    it('should return null when username does not exist (204)', async () => {
      mockHttpsResponse(204, '');

      const result = await mojang.getUuidByUsername('Nobody');

      expect(result).toBeNull();
    });

    it('should return null when username does not exist (404)', async () => {
      mockHttpsResponse(404, '');

      const result = await mojang.getUuidByUsername('Nobody');

      expect(result).toBeNull();
    });

    it('should reject on API error (500)', async () => {
      mockHttpsResponse(500, 'Internal Server Error');

      await expect(mojang.getUuidByUsername('Steve')).rejects.toThrow(
        'Mojang API returned status 500',
      );
    });

    it('should reject on network error', async () => {
      mockHttpsError('ENOTFOUND api.mojang.com');

      await expect(mojang.getUuidByUsername('Steve')).rejects.toThrow(
        'Mojang API request failed: ENOTFOUND api.mojang.com',
      );
    });

    it('should reject on malformed JSON response', async () => {
      mockHttpsResponse(200, 'not-json');

      await expect(mojang.getUuidByUsername('Steve')).rejects.toThrow(
        'Failed to parse Mojang response',
      );
    });

    it('should encode the username in the URL', async () => {
      mockHttpsResponse(200, { id: 'abc', name: 'Test' });

      await mojang.getUuidByUsername('Test_Player');

      const calledUrl = https.get.mock.calls[0][0];
      expect(calledUrl).toContain('Test_Player');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getNameHistory                                                     */
  /* ------------------------------------------------------------------ */

  describe('getNameHistory', () => {
    it('should return name history array on success', async () => {
      const history = [
        { name: 'Steve', changedToAt: null },
        { name: 'Steve_1', changedToAt: 1622505600000 },
      ];
      mockHttpsResponse(200, history);

      const result = await mojang.getNameHistory(
        'abc123def456abc123def456abc12345',
      );

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Steve');
    });

    it('should reject on non-200 status', async () => {
      mockHttpsResponse(429, 'Too Many Requests');

      await expect(mojang.getNameHistory('abc')).rejects.toThrow(
        'Mojang name-history API returned status 429',
      );
    });

    it('should strip hyphens from the UUID', async () => {
      mockHttpsResponse(200, []);

      await mojang.getNameHistory('abc123de-f456-abc1-23de-f456abc12345');

      const calledUrl = https.get.mock.calls[0][0];
      expect(calledUrl).not.toContain('-');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  hasPaidGame                                                        */
  /* ------------------------------------------------------------------ */

  describe('hasPaidGame', () => {
    it('should return true for a premium account (200 status)', async () => {
      mockHttpsResponse(200, {});

      const result = await mojang.hasPaidGame(
        'abc123def456abc123def456abc12345',
      );

      expect(result).toBe(true);
    });

    it('should return false for a non-premium account (non-200 status)', async () => {
      mockHttpsResponse(204, '');

      const result = await mojang.hasPaidGame(
        'abc123def456abc123def456abc12345',
      );

      expect(result).toBe(false);
    });

    it('should reject on network error', async () => {
      mockHttpsError('Connection timeout');

      await expect(mojang.hasPaidGame('abc')).rejects.toThrow(
        'Session server request failed: Connection timeout',
      );
    });
  });
});
