/**
 * Mojang API wrappers.
 *
 * Resolves Minecraft usernames to UUIDs, fetches name-change history,
 * and verifies premium (paid) account status.  All HTTP calls use
 * Node.js built-in `https` — no extra dependencies required.
 *
 * Rate-limit notes: the Mojang API allows about 600 requests per 10
 * minutes per IP.  `/register` and staff lookup commands are unlikely
 * to hit this in normal use.
 */

const https = require('https');

const MOJANG_API = 'https://api.mojang.com';
const MOJANG_SESSION = 'https://sessionserver.mojang.com';

/**
 * Fetch a player's UUID from their current Minecraft username.
 *
 * @param {string} username
 * @returns {Promise<{uuid: string, username: string}|null>}
 */
function getUuidByUsername(username) {
  return new Promise((resolve, reject) => {
    const url = `${MOJANG_API}/users/profiles/minecraft/${encodeURIComponent(username)}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 404) {
          resolve(null);
          return;
        }
        if (res.statusCode !== 200) {
          reject(
            new Error(`Mojang API returned status ${res.statusCode}`),
          );
          return;
        }
        try {
          const parsed = JSON.parse(data);
          resolve({ uuid: parsed.id, username: parsed.name });
        } catch (err) {
          reject(new Error(`Failed to parse Mojang response: ${err.message}`));
        }
      });
    }).on('error', (err) => {
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

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(
            new Error(`Mojang name-history API returned status ${res.statusCode}`),
          );
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Failed to parse name history: ${err.message}`));
        }
      });
    }).on('error', (err) => {
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

    https.get(url, (res) => {
      // Consume response data to free memory, even though we only
      // care about the status code.
      res.resume();
      res.on('end', () => {
        resolve(res.statusCode === 200);
      });
    }).on('error', (err) => {
      reject(new Error(`Session server request failed: ${err.message}`));
    });
  });
}

module.exports = { getUuidByUsername, getNameHistory, hasPaidGame };
