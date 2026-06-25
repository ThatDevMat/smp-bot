/**
 * AdvancedBans MySQL query helpers.
 *
 * Provides read-only access to the AdvancedBans MySQL database for
 * checking active punishments (bans, mutes, warnings) and retrieving
 * punishment history.  Uses mysql2 connection pooling so the bot can
 * recover gracefully from transient database failures.
 *
 * Every query uses parameterised statements — no user-supplied data
 * is ever interpolated into SQL strings.
 */

const mysql = require('mysql2/promise');
const { config } = require('../config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

/**
 * Fetch all active punishments for a UUID.
 */
async function getActivePunishments(uuid) {
  const conn = getPool();
  const [rows] = await conn.query(
    'SELECT * FROM punishments WHERE uuid = ? AND active = 1 ORDER BY start DESC',
    [uuid],
  );
  return rows;
}

/**
 * Fetch full punishment history for a player (last 100 entries).
 */
async function getPunishmentHistory(uuid) {
  const conn = getPool();
  const [rows] = await conn.query(
    'SELECT * FROM punishments WHERE uuid = ? ORDER BY start DESC LIMIT 100',
    [uuid],
  );
  return rows;
}

/**
 * Fetch active bans only.
 */
async function getActiveBans(uuid) {
  const conn = getPool();
  const [rows] = await conn.query(
    "SELECT * FROM punishments WHERE uuid = ? AND type = 'ban' AND active = 1 ORDER BY start DESC",
    [uuid],
  );
  return rows;
}

/**
 * Fetch active mutes only.
 */
async function getActiveMutes(uuid) {
  const conn = getPool();
  const [rows] = await conn.query(
    "SELECT * FROM punishments WHERE uuid = ? AND type = 'mute' AND active = 1 ORDER BY start DESC",
    [uuid],
  );
  return rows;
}

/**
 * Fetch all active punishments across all players (for listing).
 */
async function getAllActivePunishments() {
  const conn = getPool();
  const [rows] = await conn.query(
    'SELECT * FROM punishments WHERE active = 1 ORDER BY start DESC',
  );
  return rows;
}

/**
 * Look up a UUID by the most recent known username.
 */
async function getUuidByUsername(username) {
  const conn = getPool();
  const [rows] = await conn.query(
    'SELECT uuid FROM player_aliases WHERE name = ? ORDER BY lastSeen DESC LIMIT 1',
    [username],
  );
  return rows.length > 0 ? rows[0].uuid : null;
}

/**
 * Look up the most recent name for a UUID.
 */
async function getUsernameByUuid(uuid) {
  const conn = getPool();
  const [rows] = await conn.query(
    'SELECT name FROM player_aliases WHERE uuid = ? ORDER BY lastSeen DESC LIMIT 1',
    [uuid],
  );
  return rows.length > 0 ? rows[0].name : null;
}

module.exports = {
  getActivePunishments,
  getPunishmentHistory,
  getActiveBans,
  getActiveMutes,
  getAllActivePunishments,
  getUuidByUsername,
  getUsernameByUuid,
};
