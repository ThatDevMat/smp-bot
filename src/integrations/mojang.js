/**
 * Mojang API wrappers.
 *
 * Resolves Minecraft usernames to UUIDs, fetches name-change history,
 * and verifies premium (paid) account status.  All HTTP calls use
 * Node.js built-in `https` — no extra dependencies required.
 *
 * Results from `getUuidByUsername` are cached for 1 hour to avoid
 * exhausting the Mojang rate limit (600 requests per 10 minutes per IP).
 *
 * Rate-limit notes: the Mojang API allows about 600 requests per 10
 * minutes per IP.  `/register` and staff lookup commands are unlikely
 * to hit this in normal use, but the cache layer protects against bursts.
 */

const https = require('https');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

const MOJANG_API = 'https://api.mojang.com';
const MOJANG_SESSION = 'https://sessionserver.mojang.com';

/**
 * Fetch a player's UUID from their current Minecraft username.
 *
 * Results are cached for 1 hour.  On a 429 (rate-limited) response a
 * descriptive error is thrown so callers can surface a user-friendly
 * message.  The caller is responsible for catching the error.
 *
 * @param {string} username
 * @returns {Promise<{uuid: string, username: string}|null>}
 */
function getUuidByUsername(username) {
  const cached = cache.getCachedUUID(username);
  if (cached !== null) {
    logger.debug('UUID cache hit', { username, uuid: cached });
    return Promise.resolve({ uuid: cached, username });
  }

  return new Promise((resolve, reject) => {
    const url = `${MOJANG_API}/users/profiles/minecraft/${encodeURIComponent(username)}`;

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 429) {
            const retryAfter = res.headers['retry-after'];
            logger.warn('Mojang API rate limited', {
              statusCode: 429,
              retryAfter,
            });
            reject(
              new Error(
                'The Mojang API is currently rate limited. Please try again in a few minutes.',
              ),
            );
            return;
          }
          if (res.statusCode === 204 || res.statusCode === 404) {
            resolve(null);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Mojang API returned status ${res.statusCode}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            cache.setCachedUUID(username, parsed.id);
            resolve({ uuid: parsed.id, username: parsed.name });
          } catch (err) {
            reject(
              new Error(`Failed to parse Mojang response: ${err.message}`),
            );
          }
        });
      })
      .on('error', (err) => {
        reject(new Error(`Mojang API request failed: ${err.message}`));
      });
  });
}

/**
 * Fetch full name-change history for a UUID.
 *
 * @param {string} uuid  UUID with or without hyphens.
 * @returns {Promise<Array<{name: string, changedToAt: number|null}>>}
 */
function getNameHistory(uuid) {
  return new Promise((resolve, reject) => {
    const cleanUuid = uuid.replace(/-/g, '');
    const url = `${MOJANG_API}/user/profiles/${cleanUuid}/names`;

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(
              new Error(
                `Mojang name-history API returned status ${res.statusCode}`,
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Failed to parse name history: ${err.message}`));
          }
        });
      })
      .on('error', (err) => {
        reject(new Error(`Name history request failed: ${err.message}`));
      });
  });
}

/**
 * Check whether a UUID corresponds to a premium (paid) Minecraft account.
 *
 * @param {string} uuid
 * @returns {Promise<boolean>}
 */
function hasPaidGame(uuid) {
  return new Promise((resolve, reject) => {
    const cleanUuid = uuid.replace(/-/g, '');
    const url = `${MOJANG_SESSION}/session/minecraft/hasJoined?username=${cleanUuid}`;

    https
      .get(url, (res) => {
        // Consume response data to free memory, even though we only
        // care about the status code.
        res.resume();
        res.on('end', () => {
          resolve(res.statusCode === 200);
        });
      })
      .on('error', (err) => {
        reject(new Error(`Session server request failed: ${err.message}`));
      });
  });
}

module.exports = { getUuidByUsername, getNameHistory, hasPaidGame };
