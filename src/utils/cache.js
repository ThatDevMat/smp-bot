/**
 * In-memory cache layer for external API responses.
 *
 * Provides typed helper functions so that raw node-cache calls are never
 * used outside this module.  TTLs are set per-key — there is no global
 * default.  Cache is in-memory only and is lost on bot restart, which is
 * intentional and acceptable given the short TTLs used here (30 s – 1 h).
 *
 * @module cache
 */

const NodeCache = require('node-cache');

const instance = new NodeCache({
  stdTTL: 0,
  checkperiod: 60,
  useClones: false,
});

/* ------------------------------------------------------------------ */
/*  UUID cache  (TTL: 1 hour / 3600 s)                                */
/* ------------------------------------------------------------------ */

const UUID_TTL = 3600;
const UUID_PREFIX = 'uuid:';

/**
 * Retrieve a cached UUID for a Minecraft username.
 *
 * @param {string} username
 * @returns {string|null}  Cached UUID string, or null if not found / expired.
 */
function getCachedUUID(username) {
  return instance.get(`${UUID_PREFIX}${username.toLowerCase()}`) || null;
}

/**
 * Store a UUID for a Minecraft username in the cache.
 *
 * @param {string} username
 * @param {string} uuid
 */
function setCachedUUID(username, uuid) {
  instance.set(`${UUID_PREFIX}${username.toLowerCase()}`, uuid, UUID_TTL);
}

/**
 * Remove a cached UUID entry (e.g. when a player re-registers).
 *
 * @param {string} username
 */
function invalidateUUIDCache(username) {
  instance.del(`${UUID_PREFIX}${username.toLowerCase()}`);
}

/* ------------------------------------------------------------------ */
/*  Server status cache  (TTL: 30 s)                                  */
/* ------------------------------------------------------------------ */

const STATUS_TTL = 30;
const STATUS_KEY = 'server_status';

/**
 * Retrieve the cached server status object.
 *
 * @returns {object|null}
 */
function getCachedServerStatus() {
  return instance.get(STATUS_KEY) || null;
}

/**
 * Store server status in the cache.
 *
 * @param {object} status
 */
function setCachedServerStatus(status) {
  instance.set(STATUS_KEY, status, STATUS_TTL);
}

/* ------------------------------------------------------------------ */
/*  Cache statistics                                                   */
/* ------------------------------------------------------------------ */

/**
 * Return node-cache stats (hits, misses, keys) for observability.
 *
 * @returns {{ hits: number, misses: number, keys: number }}
 */
function getStats() {
  const stats = instance.getStats();
  return {
    hits: stats.hits,
    misses: stats.misses,
    keys: instance.keys().length,
  };
}

/**
 * Return the number of seconds until the server status cache entry expires,
 * or null if the key does not exist.
 *
 * @returns {number|null}
 */
function getStatusTtl() {
  const ttl = instance.getTtl(STATUS_KEY);
  if (ttl === undefined || ttl === 0) return null;
  return Math.max(0, Math.round((ttl - Date.now()) / 1000));
}

/**
 * Clear every cached value (UUID lookups, server status, etc.).
 */
function flushAll() {
  instance.flushAll();
}

module.exports = {
  getCachedUUID,
  setCachedUUID,
  invalidateUUIDCache,
  getCachedServerStatus,
  setCachedServerStatus,
  getStatusTtl,
  getStats,
  flushAll,
};
