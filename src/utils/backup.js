/**
 * Automated SQLite backup utility.
 *
 * Creates a hot backup of the live SQLite database using better-sqlite3's
 * built-in backup API, compresses it with gzip, and prunes old backups
 * according to the configured retention policy.
 *
 * Usage:
 *   const { runBackup } = require('./backup');
 *   const result = await runBackup();
 *   // { fileName, sizeBytes, durationMs }
 *
 * All operations are logged through the shared Winston logger.
 * Errors are logged with full stack traces and rethrown so callers
 * can handle them without crashing the process.
 */

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { config } = require('../config');
const logger = require('./logger');

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Run a full backup cycle: hot backup → compress → prune.
 *
 * @returns {Promise<{fileName: string, sizeBytes: number, durationMs: number}>}
 * @throws {Error} Any step failure — caller must catch.
 */
async function runBackup() {
  const startTime = Date.now();
  logger.info('Backup started');

  const backupDir = path.resolve(config.backup.dir);
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tempFile = path.join(backupDir, `temp-${timestamp}.db`);
  const archiveFile = path.join(backupDir, `backup-${timestamp}.db.gz`);

  try {
    // 1. Hot backup via better-sqlite3's backup API (synchronous).
    const db = require('../db').getDb();
    db.backup(tempFile);
    const tempSize = fs.statSync(tempFile).size;
    logger.info('Hot backup complete', { tempFile, sizeBytes: tempSize });

    // 2. Compress with gzip.
    await pipeline(
      fs.createReadStream(tempFile),
      zlib.createGzip(),
      fs.createWriteStream(archiveFile),
    );
    const archiveSize = fs.statSync(archiveFile).size;
    const ratio =
      tempSize > 0 ? ((archiveSize / tempSize) * 100).toFixed(1) + '%' : 'N/A';
    logger.info('Compression complete', {
      archiveFile,
      sizeBytes: archiveSize,
      ratio,
    });

    // 3. Delete uncompressed temp file.
    fs.unlinkSync(tempFile);

    // 4. Prune old backups.
    const pruned = pruneBackups(backupDir);
    logger.info('Pruning complete', {
      retained: pruned.retained,
      deleted: pruned.deleted,
    });

    const durationMs = Date.now() - startTime;
    logger.info('Backup finished successfully', { durationMs });

    return {
      fileName: path.basename(archiveFile),
      sizeBytes: archiveSize,
      durationMs,
    };
  } catch (err) {
    // Clean up temp file if it still exists after an error.
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors.
    }
    logger.error('Backup failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Pruning                                                            */
/* ------------------------------------------------------------------ */

const BACKUP_FILE_RE = /^backup-(\d{4}-\d{2}-\d{2})T\d{2}-\d{2}-\d{2}\.db\.gz$/;

/**
 * Prune old backup files according to retention policy.
 *
 * Retention:
 *   - Keep the 30 most recent daily backups
 *   - Keep any Sunday (weekly) backup beyond the daily window, up to 4
 *
 * @param {string} dir  Backup directory path.
 * @returns {{retained: number, deleted: number}}
 */
function pruneBackups(dir) {
  const retainDaily = config.backup.retainDaily || 30;
  const retainWeekly = config.backup.retainWeekly || 4;

  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => BACKUP_FILE_RE.test(f));
  } catch {
    return { retained: 0, deleted: 0 };
  }

  // Sort newest first.
  files.sort((a, b) => {
    const dateA = a.match(BACKUP_FILE_RE)[1];
    const dateB = b.match(BACKUP_FILE_RE)[1];
    return dateB.localeCompare(dateA);
  });

  const toKeep = new Set();
  const weeklyKept = [];

  // Phase 1: keep the N most recent daily backups.
  for (let i = 0; i < Math.min(files.length, retainDaily); i++) {
    toKeep.add(files[i]);
  }

  // Phase 2: for remaining files, keep up to retainWeekly Sunday backups.
  for (let i = retainDaily; i < files.length; i++) {
    if (weeklyKept.length >= retainWeekly) break;
    const dateStr = files[i].match(BACKUP_FILE_RE)[1];
    // Use UTC to avoid timezone offset pushing the date to the previous day.
    const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay();
    if (dayOfWeek === 0) {
      // Sunday
      toKeep.add(files[i]);
      weeklyKept.push(files[i]);
    }
  }

  // Delete files not in the keep set.
  let deleted = 0;
  for (const file of files) {
    if (!toKeep.has(file)) {
      try {
        fs.unlinkSync(path.join(dir, file));
        deleted++;
      } catch {
        // Log but don't crash on individual file deletion errors.
        logger.warn('Failed to delete old backup file', { file });
      }
    }
  }

  return { retained: toKeep.size, deleted };
}

module.exports = { runBackup };
