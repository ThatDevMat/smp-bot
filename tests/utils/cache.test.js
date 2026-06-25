/**
 * Tests for src/utils/cache.js
 *
 * Tests the typed cache helper functions against a fresh node-cache
 * instance.  The export from 'src/utils/cache.js' is a singleton, so
 * our tests directly exercise that singleton (which resets per module
 * reload, guaranteed by Jest's clearMocks between files).
 */

const cache = require('../../src/utils/cache');

describe('cache.js', () => {
  beforeEach(() => {
    cache.flushAll();
  });

  /* ------------------------------------------------------------------ */
  /*  UUID cache                                                         */
  /* ------------------------------------------------------------------ */

  describe('UUID cache', () => {
    it('getCachedUUID should return null on a cold cache', () => {
      expect(cache.getCachedUUID('Steve')).toBeNull();
    });

    it('setCachedUUID should store a value retrievable by getCachedUUID', () => {
      cache.setCachedUUID('Steve', 'abc123def456abc123def456abc12345');
      expect(cache.getCachedUUID('Steve')).toBe('abc123def456abc123def456abc12345');
    });

    it('getCachedUUID should be case-insensitive (lowercased key)', () => {
      cache.setCachedUUID('Steve', 'abc123');
      expect(cache.getCachedUUID('steve')).toBe('abc123');
      expect(cache.getCachedUUID('STEVE')).toBe('abc123');
    });

    it('invalidateUUIDCache should remove the entry', () => {
      cache.setCachedUUID('Alex', 'xyz789');
      expect(cache.getCachedUUID('Alex')).toBe('xyz789');
      cache.invalidateUUIDCache('Alex');
      expect(cache.getCachedUUID('Alex')).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Server status cache                                                */
  /* ------------------------------------------------------------------ */

  describe('Server status cache', () => {
    const sampleStatus = {
      online: true,
      players: { online: 5, max: 20, list: [] },
      version: '1.21',
    };

    it('getCachedServerStatus should return null on a cold cache', () => {
      expect(cache.getCachedServerStatus()).toBeNull();
    });

    it('getCachedServerStatus should return value after set', () => {
      cache.setCachedServerStatus(sampleStatus);
      expect(cache.getCachedServerStatus()).toEqual(sampleStatus);
    });

    it('getStatusTtl should return null when no status cached', () => {
      expect(cache.getStatusTtl()).toBeNull();
    });

    it('getStatusTtl should return a positive number after set', () => {
      cache.setCachedServerStatus(sampleStatus);
      const ttl = cache.getStatusTtl();
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Stats and flush                                                    */
  /* ------------------------------------------------------------------ */

  describe('Stats and flush', () => {
    it('getStats should report keys, hits, misses', () => {
      // Cold cache — miss a lookup
      cache.getCachedUUID('Nobody');
      const stats = cache.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('keys');
      expect(stats.misses).toBeGreaterThanOrEqual(1);
    });

    it('flushAll should clear all cached values', () => {
      cache.setCachedUUID('Steve', 'abc');
      cache.setCachedServerStatus({ online: true });
      expect(cache.getStats().keys).toBeGreaterThanOrEqual(2);

      cache.flushAll();
      expect(cache.getCachedUUID('Steve')).toBeNull();
      expect(cache.getCachedServerStatus()).toBeNull();
    });
  });
});
