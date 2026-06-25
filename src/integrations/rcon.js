const { Rcon } = require('rcon-client');

let rconClient = null;

async function connect() {
  const { config } = require('../config');
  if (!config.rcon.password) {
    console.warn('[RCON] No password configured — RCON commands will be unavailable.');
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

async function send(command) {
  if (!rconClient || !rconClient.authenticated) {
    // Try to connect on demand
    await connect();
    if (!rconClient || !rconClient.authenticated) {
      throw new Error('RCON is not connected. Check your RCON_HOST, RCON_PORT, and RCON_PASSWORD.');
    }
  }
  return rconClient.send(command);
}

async function getOnlinePlayers() {
  const response = await send('list');
  // Parse: "There are 3 of max 20 players online: Steve, Alex, Notch"
  const match = response.match(/There are (\d+) of a max of (\d+) players online:\s*(.*)/);
  if (!match) {
    // Sometimes returns different format in newer versions
    // "There are 3 of 20 players online: ..."
    const altMatch = response.match(/There are (\d+) of (\d+) players online:\s*(.*)/);
    if (!altMatch) return { count: 0, max: 0, players: [] };
    return {
      count: parseInt(altMatch[1], 10),
      max: parseInt(altMatch[2], 10),
      players: altMatch[3] ? altMatch[3].split(',').map((p) => p.trim()).filter(Boolean) : [],
    };
  }
  return {
    count: parseInt(match[1], 10),
    max: parseInt(match[2], 10),
    players: match[3] ? match[3].split(',').map((p) => p.trim()).filter(Boolean) : [],
  };
}

async function whitelistAdd(username) {
  return send(`whitelist add ${username}`);
}

async function whitelistRemove(username) {
  return send(`whitelist remove ${username}`);
}

async function broadcast(message) {
  return send(`say ${message}`);
}

async function disconnect() {
  if (rconClient) {
    rconClient.end();
    rconClient = null;
  }
}

module.exports = {
  connect,
  send,
  getOnlinePlayers,
  whitelistAdd,
  whitelistRemove,
  broadcast,
  disconnect,
};
