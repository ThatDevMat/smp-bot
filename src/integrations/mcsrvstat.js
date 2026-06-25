const https = require('https');

const API_BASE = 'https://api.mcsrvstat.us/3';

/**
 * Fetch server status from mcsrvstat.us API as a fallback when RCON is unavailable.
 * @param {string} serverIp - The server IP or hostname (e.g. 'play.example.com' or '192.168.1.10')
 * @param {number} [port=25565] - The server port
 * @returns {Promise<object>} Server status info
 */
function fetchStatus(serverIp, port = 25565) {
  return new Promise((resolve, reject) => {
    const url = port === 25565 ? `${API_BASE}/${serverIp}` : `${API_BASE}/${serverIp}:${port}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed || !parsed.ip) {
            resolve({ online: false, error: 'Server not found' });
            return;
          }
          resolve({
            online: parsed.online || false,
            ip: parsed.ip,
            port: parsed.port,
            hostname: parsed.hostname,
            players: parsed.players ? {
              online: parsed.players.online || 0,
              max: parsed.players.max || 0,
              list: parsed.players.list || [],
            } : { online: 0, max: 0, list: [] },
            version: parsed.version,
            protocol: parsed.protocol,
            motd: parsed.motd ? (parsed.motd.clean || []).join('\n') : '',
            icon: parsed.icon,
            software: parsed.software,
            uptime: parsed.uptime,
          });
        } catch (err) {
          reject(new Error(`Failed to parse mcsrvstat.us response: ${err.message}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`mcsrvstat.us request failed: ${err.message}`));
    });
  });
}

module.exports = { fetchStatus };
