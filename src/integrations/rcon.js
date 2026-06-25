/**
 * RCON client wrapper.
 *
 * Connects to the Minecraft server's RCON interface and exposes
 * high-level methods for whitelist management, player listing, and
 * broadcasting.  Auto-reconnects on demand when the connection drops.
 *
 * Every user-supplied value passed to the server is validated:
 * Minecraft usernames must match `[a-zA-Z0-9_]` to prevent command
 * injection via the RCON protocol.
 */

const { Rcon } = require('rcon-client');
const { config } = require('../config');

let rconClient = null;

/**
 * Only alphanumeric characters and underscores are valid in
 * Minecraft Java Edition player names.
 */
const MC_USERNAME_RE = /^[a-zA-Z0-9_]{1,16}$/;

/* ------------------------------------------------------------------ */
/*  Connection lifecycle                                               */
/* ------------------------------------------------------------------ */

async function connect() {
  if (!config.rcon.password) {
    console.warn('[RCON] No password configured \u2014 RCON commands will be unavailable.');
    return null;
  }
  try {
    rconClient = await Rcon.connect({
      host: config.rcon.host,
      port: config.rcon.port,
      password: config.rcon.password,
    });
    console.log('[RCON] Connected successfully.');
    return rconClient;
  } catch (err) {
    console.warn(`[RCON] Connection failed: ${err.message}. RCON commands will be unavailable.`);
    return null;
  }
}

async function disconnect() {
  if (rconClient) {
    rconClient.end();
    rconClient = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Low-level command                                                   */
/* ------------------------------------------------------------------ */

async function send(command) {
  if (!rconClient || !rconClient.authenticated) {
    // Attempt to re-establish the connection on demand.
    await connect();
    if (!rconClient || !rconClient.authenticated) {
      throw new Error(
        'RCON is not connected. Verify RCON_HOST, RCON_PORT, and RCON_PASSWORD.',
      );
    }
  }
  return rconClient.send(command);
}

/* ------------------------------------------------------------------ */
/*  High-level helpers                                                 */
/* ------------------------------------------------------------------ */

async function getOnlinePlayers() {
  const response = await send('list');
  // Parse "There are 3 of a max of 20 players online: Steve, Alex, Notch"
  const patterns = [
    /There are (\d+) of a max of (\d+) players online:\s*(.*)/,
    /There are (\d+) of (\d+) players online:\s*(.*)/,
  ];

  for (const re of patterns) {
    const match = response.match(re);
    if (match) {
      return {
        count: parseInt(match[1], 10),
        max: parseInt(match[2], 10),
        players: match[3]
          ? match[3].split(',').map((p) => p.trim()).filter(Boolean)
          : [],
      };
    }
  }

  return { count: 0, max: 0, players: [] };
}

/**
 * Reject usernames that don't match the Minecraft format.
 * This prevents command injection through RCON (e.g. `Steve; op Notch`).
 */
function sanitiseUsername(raw) {
  if (!MC_USERNAME_RE.test(raw)) {
    throw new Error(
      `Invalid Minecraft username: "${raw}". Only letters, digits, and underscores (max 16 chars) are allowed.`,
    );
  }
  return raw;
}

async function whitelistAdd(username) {
  const safe = sanitiseUsername(username);
  return send(`whitelist add ${safe}`);
}

async function whitelistRemove(username) {
  const safe = sanitiseUsername(username);
  return send(`whitelist remove ${safe}`);
}

async function broadcast(message) {
  // RCON `say` accepts any text, but limit length to avoid truncation.
  const safe = message.slice(0, 256);
  return send(`say ${safe}`);
}

module.exports = {
  connect,
  disconnect,
  send,
  getOnlinePlayers,
  whitelistAdd,
  whitelistRemove,
  broadcast,
};
