const https = require('https');

const MOJANG_API = 'https://api.mojang.com';
const MOJANG_SESSION = 'https://sessionserver.mojang.com';

/**
 * Fetch a player's UUID from their Minecraft username via Mojang API.
 * @param {string} username - Minecraft username
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
          reject(new Error(`Mojang API returned status ${res.statusCode}: ${data}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          resolve({
            uuid: parsed.id,
            username: parsed.name,
          });
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
 * Fetch username history for a UUID (for display purposes).
 * @param {string} uuid - Minecraft UUID (with or without hyphens)
 * @returns {Promise<Array<{name: string, changedToAt: number|null}>>}
 */
function getNameHistory(uuid) {
  return new Promise((resolve, reject) => {
    // Remove hyphens if present
    const cleanUuid = uuid.replace(/-/g, '');
    const url = `${MOJANG_API}/user/profiles/${cleanUuid}/names`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Mojang API returned status ${res.statusCode} for name history`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
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
 * Check if a Minecraft account exists (has paid for the game).
 * @param {string} uuid - Minecraft UUID
 * @returns {Promise<boolean>}
 */
function hasPaidGame(uuid) {
  return new Promise((resolve, reject) => {
    const cleanUuid = uuid.replace(/-/g, '');
    const url = `${MOJANG_SESSION}/session/minecraft/hasJoined?username=${cleanUuid}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(res.statusCode === 200);
      });
    }).on('error', (err) => {
      reject(new Error(`Session server request failed: ${err.message}`));
    });
  });
}

module.exports = { getUuidByUsername, getNameHistory, hasPaidGame };
