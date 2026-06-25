/**
 * Tests for src/utils/backup.js
 *
 * Covers:
 * - Happy path: backup → compress → prune sequence
 * - Pruning logic: retention of daily and weekly backups
 * - Failure handling: db.backup() errors
 * - Missing backup directory
 *
 * We use jest.spyOn to mock specific fs functions rather than mocking
 * the entire 'fs' module, because winston-daily-rotate-file (imported
 * by the logger) depends on it.
 */

const path = require('path');
const fs = require('fs');

jest.mock('../../src/db');

const db = require('../../src/db');

const { setTestEnv } = require('../setup');
beforeAll(setTestEnv);

const backup = require('../../src/utils/backup');
const { config } = require('../../src/config');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const BACKUP_DIR = path.resolve(config.backup.dir);

function mockFilesForDates(dates) {
  return dates.map((d) => `backup-${d}T03-00-00.db.gz`);
}

/**
 * Create a minimal valid .db file for the compression pipeline to read.
 */
function touchTempFile(tempPath) {
  fs.mkdirSync(path.dirname(tempPath), { recursive: true });
  fs.writeFileSync(tempPath, Buffer.alloc(256));
  return tempPath;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('runBackup', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockDb = { backup: jest.fn() };
    db.getDb.mockReturnValue(mockDb);

    // Clean up any leftover test directories from previous runs.
    try {
      fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
    } catch {}
  });

  afterEach(() => {
    try {
      fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
    } catch {}
  });

  /* ------------------------------------------------------------------ */
  /*  Happy path                                                         */
  /* ------------------------------------------------------------------ */

  it('performs hot backup, compresses, deletes temp file, prunes, and returns result', async () => {
    // Stub db.backup to actually write a temp file so the real compression
    // pipeline has something to read.
    let capturedTempPath;
    const mockDb = {
      backup: jest.fn((tempPath) => {
        capturedTempPath = tempPath;
        touchTempFile(tempPath);
      }),
    };
    db.getDb.mockReturnValue(mockDb);

    const result = await backup.runBackup();

    expect(mockDb.backup).toHaveBeenCalled();
    // Temp file should be gone after compression.
    expect(fs.existsSync(capturedTempPath)).toBe(false);
    // Archive file should exist.
    const files = fs.readdirSync(BACKUP_DIR);
    expect(files.some((f) => f.endsWith('.db.gz'))).toBe(true);

    expect(result).toMatchObject({
      fileName: expect.stringMatching(/^backup-.+\.db\.gz$/),
      sizeBytes: expect.any(Number),
      durationMs: expect.any(Number),
    });
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------ */
  /*  Failure handling                                                   */
  /* ------------------------------------------------------------------ */

  it('rethrows if db.backup throws', async () => {
    const mockDb = {
      backup: jest.fn(() => {
        throw new Error('Disk full');
      }),
    };
    db.getDb.mockReturnValue(mockDb);

    await expect(backup.runBackup()).rejects.toThrow('Disk full');
  });

  it('creates the backup directory if it does not exist', async () => {
    // Temp file must exist for the compression step.
    const mockDb = {
      backup: jest.fn((tempPath) => touchTempFile(tempPath)),
    };
    db.getDb.mockReturnValue(mockDb);

    await backup.runBackup();

    expect(fs.existsSync(BACKUP_DIR)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Pruning logic                                                      */
/* ------------------------------------------------------------------ */

describe('pruneBackups (internal)', () => {
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = { backup: jest.fn() };
    db.getDb.mockReturnValue(mockDb);

    try {
      fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
    } catch {}
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('keeps the 30 most recent daily backups', async () => {
    const dates = [];
    for (let i = 0; i < 40; i++) {
      const d = new Date('2026-01-01');
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    // Create the backup files on disk so pruneBackups can read them.
    for (const d of dates) {
      fs.writeFileSync(
        path.join(BACKUP_DIR, `backup-${d}T03-00-00.db.gz`),
        Buffer.alloc(100),
      );
    }

    // The backup run needs a temp file.
    mockDb.backup = jest.fn((tempPath) => touchTempFile(tempPath));
    await backup.runBackup();

    // 40 old files + 1 new backup file = 41.
    // 30 most recent are kept. 1 Sunday in the tail also kept.
    const remaining = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db.gz'));
    expect(remaining.length).toBe(32);
  });

  it('keeps up to 4 Sunday backups beyond the daily window', async () => {
    const dates = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date('2026-01-01');
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    for (const d of dates) {
      fs.writeFileSync(
        path.join(BACKUP_DIR, `backup-${d}T03-00-00.db.gz`),
        Buffer.alloc(100),
      );
    }

    mockDb.backup = jest.fn((tempPath) => touchTempFile(tempPath));
    await backup.runBackup();

    const remaining = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db.gz'));

    // 30 daily + Sunday backups beyond that window.
    expect(remaining.length).toBeGreaterThanOrEqual(30);
    expect(remaining.length).toBeLessThanOrEqual(34);
  });

  it('does not prune if fewer files than retention limit', async () => {
    for (const d of [
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
    ]) {
      fs.writeFileSync(
        path.join(BACKUP_DIR, `backup-${d}T03-00-00.db.gz`),
        Buffer.alloc(100),
      );
    }

    mockDb.backup = jest.fn((tempPath) => touchTempFile(tempPath));
    await backup.runBackup();

    // 10 old files + 1 new backup file = 11 total. All kept.
    const remaining = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db.gz'));
    expect(remaining.length).toBe(11);
  });
});
