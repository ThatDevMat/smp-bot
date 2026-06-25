/**
 * Tests for src/integrations/advancedbans.js
 *
 * Mocks mysql2/promise so no real database connections are made.
 * Uses jest.isolateModules to reset the singleton pool between tests.
 */

jest.mock('mysql2/promise');

const mysql = require('mysql2/promise');

// Will be assigned in beforeEach via isolateModules
let advancedbans;

describe('advancedbans.js', () => {
  let mockPool;

  beforeEach(() => {
    jest.resetAllMocks();

    mockPool = { query: jest.fn() };
    mysql.createPool.mockReturnValue(mockPool);

    // Re-import in isolated scope to reset the singleton pool.
    jest.isolateModules(() => {
      advancedbans = require('../../src/integrations/advancedbans');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getActivePunishments                                               */
  /* ------------------------------------------------------------------ */

  describe('getActivePunishments', () => {
    it('should return active punishments for a UUID', async () => {
      const rows = [
        { type: 'ban', reason: 'Griefing', uuid: 'abc', active: 1, start: '2026-01-01', end: null, executor: 'Admin' },
      ];
      mockPool.query.mockResolvedValue([rows]);

      const result = await advancedbans.getActivePunishments('abc');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE uuid = ? AND active = 1'),
        ['abc'],
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ban');
    });

    it('should return empty array when player has no active punishments', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await advancedbans.getActivePunishments('abc');

      expect(result).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getPunishmentHistory                                               */
  /* ------------------------------------------------------------------ */

  describe('getPunishmentHistory', () => {
    it('should return punishment history ordered by start DESC', async () => {
      const rows = [
        { type: 'ban', reason: 'A', start: '2026-02-01' },
        { type: 'mute', reason: 'B', start: '2026-01-01' },
      ];
      mockPool.query.mockResolvedValue([rows]);

      const result = await advancedbans.getPunishmentHistory('abc');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 100'),
        ['abc'],
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array for a clean player', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await advancedbans.getPunishmentHistory('abc');

      expect(result).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getActiveBans / getActiveMutes                                     */
  /* ------------------------------------------------------------------ */

  describe('getActiveBans', () => {
    it('should filter by type = ban', async () => {
      mockPool.query.mockResolvedValue([[{ type: 'ban', reason: 'Hacking' }]]);

      const result = await advancedbans.getActiveBans('abc');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ban');
    });

    it('should return empty array when no active bans', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await advancedbans.getActiveBans('abc');

      expect(result).toEqual([]);
    });
  });

  describe('getActiveMutes', () => {
    it('should filter by type = mute', async () => {
      mockPool.query.mockResolvedValue([[{ type: 'mute', reason: 'Spam' }]]);

      const result = await advancedbans.getActiveMutes('abc');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('mute');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getAllActivePunishments                                            */
  /* ------------------------------------------------------------------ */

  describe('getAllActivePunishments', () => {
    it('should return all active punishments', async () => {
      mockPool.query.mockResolvedValue([
        [{ type: 'ban', active: 1 }, { type: 'mute', active: 1 }],
      ]);

      const result = await advancedbans.getAllActivePunishments();

      expect(result).toHaveLength(2);
    });

    it('should return empty array when none are active', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await advancedbans.getAllActivePunishments();

      expect(result).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getUuidByUsername / getUsernameByUuid                               */
  /* ------------------------------------------------------------------ */

  describe('getUuidByUsername', () => {
    it('should return UUID from player_aliases', async () => {
      mockPool.query.mockResolvedValue([[{ uuid: 'abc123' }]]);

      const result = await advancedbans.getUuidByUsername('Steve');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name = ?'),
        ['Steve'],
      );
      expect(result).toBe('abc123');
    });

    it('should return null when username not found', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await advancedbans.getUuidByUsername('Unknown');

      expect(result).toBeNull();
    });
  });

  describe('getUsernameByUuid', () => {
    it('should return the most recent name for a UUID', async () => {
      mockPool.query.mockResolvedValue([[{ name: 'Steve' }]]);

      const result = await advancedbans.getUsernameByUuid('abc123');

      expect(result).toBe('Steve');
    });

    it('should return null when UUID not found', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await advancedbans.getUsernameByUuid('unknown');

      expect(result).toBeNull();
    });
  });
});
