/**
 * Tests for src/db/index.js
 *
 * Mocks better-sqlite3 so no real database files are created.
 * Uses jest.isolateModules to reload the module fresh for each test.
 */

jest.mock('better-sqlite3');

const Database = require('better-sqlite3');

// We'll assign this in beforeEach via isolateModules
let db;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createMockDb() {
  const mockStmt = {
    run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
    get: jest.fn(),
    all: jest.fn(),
  };

  const mockDb = {
    pragma: jest.fn(),
    exec: jest.fn(),
    prepare: jest.fn(() => mockStmt),
  };

  Database.mockReturnValue(mockDb);
  return { mockDb, mockStmt };
}

describe('db/index.js', () => {
  let mockStmt;

  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = createMockDb();
    mockStmt = mocks.mockStmt;

    // Re-import the db module in an isolated scope so the singleton
    // state is reset for each test.
    jest.isolateModules(() => {
      db = require('../../src/db');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Events                                                             */
  /* ------------------------------------------------------------------ */

  describe('createEvent', () => {
    it('should insert an event and return its ID', () => {
      const id = db.createEvent({
        name: 'Dragon Fight',
        description: 'Kill the dragon',
        event_date: '2026-07-01',
        event_time: '20:00',
        timezone: 'UTC',
        created_by: 'user123',
      });

      expect(mockStmt.run).toHaveBeenCalledWith(
        'Dragon Fight', 'Kill the dragon', '2026-07-01', '20:00', 'UTC', 'user123',
      );
      expect(id).toBe(1);
    });
  });

  describe('getUpcomingEvents', () => {
    it('should return events that are not cancelled and in the future', () => {
      const events = [{ id: 1, name: 'Test', cancelled: 0 }];
      mockStmt.all.mockReturnValue(events);

      const result = db.getUpcomingEvents();

      expect(mockStmt.all).toHaveBeenCalled();
      expect(result).toEqual(events);
    });

    it('should return empty array when no upcoming events', () => {
      mockStmt.all.mockReturnValue([]);

      const result = db.getUpcomingEvents();

      expect(result).toEqual([]);
    });
  });

  describe('getEventById', () => {
    it('should return the event for a valid ID', () => {
      mockStmt.get.mockReturnValue({ id: 1, name: 'Test' });

      const result = db.getEventById(1);

      expect(mockStmt.get).toHaveBeenCalledWith(1);
      expect(result.name).toBe('Test');
    });

    it('should return undefined for a non-existent ID', () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = db.getEventById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('cancelEvent', () => {
    it('should set cancelled = 1 on the event', () => {
      db.cancelEvent(1);

      expect(mockStmt.run).toHaveBeenCalledWith(1);
    });
  });

  describe('addRsvp / getRsvpCount', () => {
    it('addRsvp should insert or ignore', () => {
      db.addRsvp(1, 'discord123');

      expect(mockStmt.run).toHaveBeenCalledWith(1, 'discord123');
    });

    it('getRsvpCount should return the count of attendees', () => {
      mockStmt.get.mockReturnValue({ count: 5 });

      const count = db.getRsvpCount(1);

      expect(mockStmt.get).toHaveBeenCalledWith(1);
      expect(count).toBe(5);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Player Registry                                                    */
  /* ------------------------------------------------------------------ */

  describe('registerPlayer', () => {
    it('should insert or replace a player registration', () => {
      db.registerPlayer('discord123', 'Steve', 'abc123');

      expect(mockStmt.run).toHaveBeenCalledWith('discord123', 'Steve', 'abc123');
    });
  });

  describe('getPlayerByDiscord', () => {
    it('should return player for a linked Discord ID', () => {
      mockStmt.get.mockReturnValue({
        discord_id: 'discord123',
        minecraft_username: 'Steve',
      });

      const result = db.getPlayerByDiscord('discord123');

      expect(result.minecraft_username).toBe('Steve');
    });

    it('should return undefined when Discord ID is not registered', () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = db.getPlayerByDiscord('unknown');

      expect(result).toBeUndefined();
    });
  });

  describe('getPlayerByUsername', () => {
    it('should return player by Minecraft username', () => {
      mockStmt.get.mockReturnValue({ minecraft_username: 'Steve' });

      const result = db.getPlayerByUsername('Steve');

      expect(result.minecraft_username).toBe('Steve');
    });
  });

  describe('getPlayerByUuid', () => {
    it('should return player by Minecraft UUID', () => {
      mockStmt.get.mockReturnValue({ minecraft_uuid: 'abc123' });

      const result = db.getPlayerByUuid('abc123');

      expect(result.minecraft_uuid).toBe('abc123');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Warnings                                                           */
  /* ------------------------------------------------------------------ */

  describe('addWarning', () => {
    it('should insert a warning record', () => {
      db.addWarning({
        playerUuid: 'abc123',
        discordId: 'discord123',
        reason: 'Griefing',
        issuedBy: 'admin1',
      });

      expect(mockStmt.run).toHaveBeenCalledWith('abc123', 'discord123', 'Griefing', 'admin1');
    });
  });

  describe('getWarningsByUuid', () => {
    it('should return warnings ordered by issued_at DESC', () => {
      mockStmt.all.mockReturnValue([
        { id: 2, reason: 'Second', issued_at: '2026-06-02' },
        { id: 1, reason: 'First', issued_at: '2026-06-01' },
      ]);

      const result = db.getWarningsByUuid('abc123');

      expect(result).toHaveLength(2);
      expect(mockStmt.all).toHaveBeenCalledWith('abc123');
    });

    it('should return empty array when player has no warnings', () => {
      mockStmt.all.mockReturnValue([]);

      const result = db.getWarningsByUuid('abc123');

      expect(result).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  POIs                                                               */
  /* ------------------------------------------------------------------ */

  describe('addPoi', () => {
    it('should insert a POI with all fields', () => {
      db.addPoi({
        name: 'Spawn', x: 0, y: 64, z: 0,
        dimension: 'overworld', description: 'Town center', createdBy: 'user1',
      });

      expect(mockStmt.run).toHaveBeenCalledWith(
        'Spawn', 0, 64, 0, 'overworld', 'Town center', 'user1',
      );
    });
  });

  describe('getAllPois', () => {
    it('should return all POIs ordered by name', () => {
      mockStmt.all.mockReturnValue([
        { name: 'Base', x: 100 }, { name: 'Spawn', x: 0 },
      ]);

      const result = db.getAllPois();

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no POIs exist', () => {
      mockStmt.all.mockReturnValue([]);

      const result = db.getAllPois();

      expect(result).toEqual([]);
    });
  });

  describe('getPoiByName', () => {
    it('should return the POI for a matching name', () => {
      mockStmt.get.mockReturnValue({ name: 'Spawn', x: 0 });

      const result = db.getPoiByName('Spawn');

      expect(result.name).toBe('Spawn');
    });

    it('should return undefined when name does not exist', () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = db.getPoiByName('Unknown');

      expect(result).toBeUndefined();
    });
  });

  describe('removePoi', () => {
    it('should delete the POI by name', () => {
      db.removePoi('Spawn');

      expect(mockStmt.run).toHaveBeenCalledWith('Spawn');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Seasons                                                            */
  /* ------------------------------------------------------------------ */

  describe('getCurrentSeason', () => {
    it('should return the most recent season', () => {
      mockStmt.get.mockReturnValue({
        season_number: 3, start_date: '2026-06-01', seed: 'abc',
      });

      const result = db.getCurrentSeason();

      expect(result.season_number).toBe(3);
    });

    it('should return undefined when no seasons exist', () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = db.getCurrentSeason();

      expect(result).toBeUndefined();
    });
  });

  describe('setSeason', () => {
    it('should delete existing season and insert new one', () => {
      db.setSeason({ seasonNumber: 3, startDate: '2026-06-01', seed: 'abc' });

      expect(mockStmt.run).toHaveBeenNthCalledWith(1, 3);
      expect(mockStmt.run).toHaveBeenNthCalledWith(2, 3, '2026-06-01', 'abc');
    });

    it('should handle missing seed gracefully', () => {
      db.setSeason({ seasonNumber: 1, startDate: '2026-01-01', seed: null });

      expect(mockStmt.run).toHaveBeenNthCalledWith(2, 1, '2026-01-01', null);
    });
  });
});
