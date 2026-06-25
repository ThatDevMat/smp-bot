/**
 * SQLite database layer.
 *
 * Provides a lazy-initialised better-sqlite3 connection (WAL mode,
 * foreign keys enforced) and a set of typed helpers for every table:
 * events, player_registry, warnings, pois, seasons, rsvps.
 *
 * All queries use parameterised statements — no string interpolation.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'smp-bot.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      cancelled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS player_registry (
      discord_id TEXT PRIMARY KEY,
      minecraft_username TEXT NOT NULL,
      minecraft_uuid TEXT NOT NULL,
      registered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_uuid TEXT NOT NULL,
      discord_id TEXT,
      reason TEXT NOT NULL,
      issued_by TEXT NOT NULL,
      issued_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pois (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      dimension TEXT NOT NULL DEFAULT 'overworld',
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_number INTEGER NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      seed TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rsvps (
      event_id INTEGER NOT NULL,
      discord_id TEXT NOT NULL,
      responded_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (event_id, discord_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);
}

// ---- Events ------------------------------------------------------------

function createEvent({
  name,
  description,
  event_date,
  event_time,
  timezone,
  created_by,
}) {
  const stmt = getDb().prepare(`
    INSERT INTO events (name, description, event_date, event_time, timezone, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    name,
    description,
    event_date,
    event_time,
    timezone,
    created_by,
  );
  return result.lastInsertRowid;
}

function getUpcomingEvents() {
  return getDb()
    .prepare(
      "SELECT * FROM events WHERE cancelled = 0 AND event_date >= date('now') ORDER BY event_date ASC, event_time ASC",
    )
    .all();
}

function getEventById(id) {
  return getDb().prepare('SELECT * FROM events WHERE id = ?').get(id);
}

function cancelEvent(id) {
  return getDb()
    .prepare('UPDATE events SET cancelled = 1 WHERE id = ?')
    .run(id);
}

function addRsvp(eventId, discordId) {
  return getDb()
    .prepare('INSERT OR IGNORE INTO rsvps (event_id, discord_id) VALUES (?, ?)')
    .run(eventId, discordId);
}

function getRsvpCount(eventId) {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count FROM rsvps WHERE event_id = ?')
    .get(eventId);
  return row.count;
}

// ---- Player registry ---------------------------------------------------

function registerPlayer(discordId, minecraftUsername, minecraftUuid) {
  return getDb()
    .prepare(
      'INSERT OR REPLACE INTO player_registry (discord_id, minecraft_username, minecraft_uuid) VALUES (?, ?, ?)',
    )
    .run(discordId, minecraftUsername, minecraftUuid);
}

function getPlayerByDiscord(discordId) {
  return getDb()
    .prepare('SELECT * FROM player_registry WHERE discord_id = ?')
    .get(discordId);
}

function getPlayerByUsername(username) {
  return getDb()
    .prepare('SELECT * FROM player_registry WHERE minecraft_username = ?')
    .get(username);
}

function getPlayerByUuid(uuid) {
  return getDb()
    .prepare('SELECT * FROM player_registry WHERE minecraft_uuid = ?')
    .get(uuid);
}

// ---- Warnings (local) --------------------------------------------------

function addWarning({ playerUuid, discordId, reason, issuedBy }) {
  return getDb()
    .prepare(
      'INSERT INTO warnings (player_uuid, discord_id, reason, issued_by) VALUES (?, ?, ?, ?)',
    )
    .run(playerUuid, discordId, reason, issuedBy);
}

function getWarningsByUuid(playerUuid) {
  return getDb()
    .prepare(
      'SELECT * FROM warnings WHERE player_uuid = ? ORDER BY issued_at DESC',
    )
    .all(playerUuid);
}

// ---- POIs --------------------------------------------------------------

function addPoi({ name, x, y, z, dimension, description, createdBy }) {
  return getDb()
    .prepare(
      'INSERT INTO pois (name, x, y, z, dimension, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(name, x, y, z, dimension, description, createdBy);
}

function getAllPois() {
  return getDb().prepare('SELECT * FROM pois ORDER BY name ASC').all();
}

function getPoiByName(name) {
  return getDb().prepare('SELECT * FROM pois WHERE name = ?').get(name);
}

function removePoi(name) {
  return getDb().prepare('DELETE FROM pois WHERE name = ?').run(name);
}

// ---- Seasons -----------------------------------------------------------

function getCurrentSeason() {
  return getDb()
    .prepare('SELECT * FROM seasons ORDER BY season_number DESC LIMIT 1')
    .get();
}

function setSeason({ seasonNumber, startDate, seed }) {
  getDb()
    .prepare('DELETE FROM seasons WHERE season_number = ?')
    .run(seasonNumber);
  return getDb()
    .prepare(
      'INSERT INTO seasons (season_number, start_date, seed) VALUES (?, ?, ?)',
    )
    .run(seasonNumber, startDate, seed);
}

/**
 * Close the SQLite database connection.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  createEvent,
  getUpcomingEvents,
  getEventById,
  cancelEvent,
  addRsvp,
  getRsvpCount,
  registerPlayer,
  getPlayerByDiscord,
  getPlayerByUsername,
  getPlayerByUuid,
  addWarning,
  getWarningsByUuid,
  addPoi,
  getAllPois,
  getPoiByName,
  removePoi,
  getCurrentSeason,
  setSeason,
  closeDb,
};
