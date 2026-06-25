/**
 * mcsrvstat.us API wrapper.
 *
 * Fetches public Minecraft server status (MOTD, version, player count,
 * uptime, software) from the free mcsrvstat.us API.  Used as a fallback
 * when direct RCON access is unavailable.
 *
 * Results are cached for 30 seconds.  If the API is unreachable and a
 * stale cached result exists, it is returned with a `stale: true` flag
 * so callers can indicate the data may be outdated.
 */

const https = require('https');
const cache = require('../utils/cache');

const API_BASE = 'https://api.mcsrvstat.us/3';

/**
 * Fetch server status from mcsrvstat.us API.
 *
 * Checks the in-memory cache first.  On a cache miss the API is called
 * and the result is stored with a 30-second TTL.  If the API call fails
 * and a stale cached result exists, the stale result is returned with
 * `stale: true`.  If neither the API nor the cache is available the
 * error is thrown.
 *
 * @param {string} serverIp  Server hostname or IP.
 * @param {number} [port=25565]  Server port.
 * @returns {Promise<object>} Normalised status object (may include `stale: true`).
 */
function fetchStatus(serverIp, port = 25565) {
  const cached = cache.getCachedServerStatus();
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const url =
      port === 25565
        ? `${API_BASE}/${serverIp}`
        : `${API_BASE}/${serverIp}:${port}`;

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed || !parsed.ip) {
              resolve({ online: false, error: 'Server not found' });
              return;
            }
            const result = {
              online: parsed.online || false,
              ip: parsed.ip,
              port: parsed.port,
              hostname: parsed.hostname,
              players: parsed.players
                ? {
                    online: parsed.players.online || 0,
                    max: parsed.players.max || 0,
                    list: parsed.players.list || [],
                  }
                : { online: 0, max: 0, list: [] },
              version: parsed.version,
              protocol: parsed.protocol,
              motd: parsed.motd ? (parsed.motd.clean || []).join('\n') : '',
              icon: parsed.icon,
              software: parsed.software,
              uptime: parsed.uptime,
            };
            cache.setCachedServerStatus(result);
            resolve(result);
          } catch (err) {
            reject(
              new Error(
                `Failed to parse mcsrvstat.us response: ${err.message}`,
              ),
            );
          }
        });
      })
      .on('error', (err) => {
        // If the network call fails but a stale cache entry exists,
        // return it with a flag so callers can show a warning.
        const stale = cache.getCachedServerStatus();
        if (stale !== null) {
          resolve({ ...stale, stale: true });
        } else {
          reject(new Error(`mcsrvstat.us request failed: ${err.message}`));
        }
      });
  });
}

module.exports = { fetchStatus };
