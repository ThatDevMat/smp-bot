/**
 * Mock DiscordSRV webhook sender.
 *
 * Used for local Docker development to simulate DiscordSRV payloads
 * without requiring a real Minecraft server.
 *
 * Routes:
 *   GET  /              — HTML page with buttons for each event type
 *   POST /fire/:type    — Fire a webhook payload to the bot
 *     type can be: chat, join, leave, death, advancement,
 *                  server_start, server_stop
 *   GET  /health        — Health check
 *
 * Environment variables:
 *   BOT_WEBHOOK_URL     — The bot's webhook endpoint (default: http://bot:3000/srvchat)
 *   WEBHOOK_SECRET      — Shared secret for x-webhook-secret header
 *   PORT                — Port to listen on (default: 4000)
 */

const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const BOT_URL = process.env.BOT_WEBHOOK_URL || 'http://bot:3000/srvchat';
const SECRET = process.env.WEBHOOK_SECRET || '';
const PORT = parseInt(process.env.PORT, 10) || 4000;

/* ------------------------------------------------------------------ */
/*  Payload builders                                                    */
/* ------------------------------------------------------------------ */

const PAYLOAD_BUILDERS = {
  chat(_, query) {
    return {
      type: 'chat',
      username: query.username || 'Steve',
      message: query.message || 'Hello from the mock webhook!',
      world: query.world || 'world',
    };
  },
  join(_, query) {
    return {
      type: 'join',
      username: query.username || 'Alex',
    };
  },
  leave(_, query) {
    return {
      type: 'leave',
      username: query.username || 'Notch',
    };
  },
  death(_, query) {
    return {
      type: 'death',
      username: query.username || 'Steve',
      message: query.message || 'Steve fell from a high place',
    };
  },
  advancement(_, query) {
    return {
      type: 'advancement',
      username: query.username || 'BuildMaster',
      advancementTitle: query.title || 'Getting Wood',
      advancementDescription: query.description || 'Punch a tree until a block of wood pops out',
      message: query.message || 'Getting Wood',
    };
  },
  server_start() {
    return { type: 'start' };
  },
  server_stop() {
    return { type: 'stop' };
  },
};

/* ------------------------------------------------------------------ */
/*  Routes                                                              */
/* ------------------------------------------------------------------ */

/**
 * GET / — HTML control panel with buttons for each event type.
 */
app.get('/', (_req, res) => {
  res.type('text/html').send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mock DiscordSRV — SMP Bot</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #1a1a2e; color: #e0e0e0; display: flex; justify-content: center;
           align-items: center; min-height: 100vh; }
    .card { background: #16213e; border-radius: 12px; padding: 2rem; width: 480px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    h1 { text-align: center; margin-bottom: 0.5rem; font-size: 1.4rem; }
    p.sub { text-align: center; color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    button { padding: 0.75rem; border: none; border-radius: 6px; font-size: 0.9rem;
             cursor: pointer; transition: filter 0.15s; font-weight: 600; }
    button:hover { filter: brightness(1.15); }
    .btn-chat       { background: #3498db; color: #fff; }
    .btn-join       { background: #2ecc71; color: #fff; }
    .btn-leave      { background: #e74c3c; color: #fff; }
    .btn-death      { background: #95a5a6; color: #fff; }
    .btn-advancement{ background: #f1c40f; color: #1a1a2e; }
    .btn-start      { background: #1abc9c; color: #fff; }
    .btn-stop       { background: #e67e22; color: #fff; }
    .btn-fire-all   { background: #9b59b6; color: #fff; grid-column: span 2; }
    input, label { display: block; width: 100%; }
    .field { margin-bottom: 0.75rem; }
    label { font-size: 0.8rem; color: #aaa; margin-bottom: 0.2rem; }
    input { padding: 0.4rem 0.6rem; border-radius: 4px; border: 1px solid #333;
            background: #0f3460; color: #e0e0e0; font-size: 0.85rem; }
    #result { margin-top: 1rem; padding: 0.75rem; border-radius: 6px;
              background: #0f3460; font-family: monospace; font-size: 0.8rem;
              white-space: pre-wrap; display: none; min-height: 2rem; }
    .error { color: #e74c3c; }
    .success { color: #2ecc71; }
    hr { border: none; border-top: 1px solid #333; margin: 1rem 0; }
  </style>
</head>
<body>
<div class="card">
  <h1>Mock DiscordSRV</h1>
  <p class="sub">Click an event type to fire it at the bot</p>

  <div class="field">
    <label for="username">Default username</label>
    <input id="username" value="Steve" placeholder="Steve" />
  </div>
  <div class="field">
    <label for="message">Default message</label>
    <input id="message" value="Hello from the mock webhook!" placeholder="Message text" />
  </div>

  <div class="btn-grid">
    <button class="btn-chat"        onclick="fire('chat')">💬 Chat</button>
    <button class="btn-join"        onclick="fire('join')">🟢 Join</button>
    <button class="btn-leave"       onclick="fire('leave')">🔴 Leave</button>
    <button class="btn-death"       onclick="fire('death')">💀 Death</button>
    <button class="btn-advancement" onclick="fire('advancement')">🏆 Advancement</button>
    <button class="btn-start"       onclick="fire('server_start')">▶ Start</button>
    <button class="btn-stop"        onclick="fire('server_stop')">⏹ Stop</button>
    <button class="btn-fire-all"    onclick="fireAll()">🔥 Fire All Events</button>
  </div>

  <hr />
  <div class="field">
    <label for="advancement-title">Advancement title</label>
    <input id="advancement-title" value="Getting Wood" placeholder="Title" />
  </div>
  <div class="field">
    <label for="advancement-desc">Advancement description</label>
    <input id="advancement-desc" value="Punch a tree" placeholder="Description" />
  </div>

  <div id="result"></div>
</div>

<script>
const TYPES = ['chat', 'join', 'leave', 'death', 'advancement', 'server_start', 'server_stop'];

function qs(id) { return document.getElementById(id).value; }

async function fire(type) {
  const params = new URLSearchParams({
    username: qs('username'),
    message: qs('message'),
    title: qs('advancement-title'),
    description: qs('advancement-desc'),
  });
  const url = '/fire/' + type + '?' + params.toString();
  const res = await fetch(url);
  const text = await res.text();
  showResult(type, res.status, text);
}

async function fireAll() {
  for (const t of TYPES) {
    await fire(t);
  }
}

function showResult(type, status, body) {
  const el = document.getElementById('result');
  const cls = status >= 200 && status < 300 ? 'success' : 'error';
  el.className = cls;
  el.textContent = '[' + type + '] HTTP ' + status + '\\n' + body.slice(0, 500);
  el.style.display = 'block';
}
</script>
</body>
</html>
  `);
});

/**
 * POST /fire/:type — Build and send a webhook payload.
 */
app.post('/fire/:type', async (req, res) => {
  const { type } = req.params;
  const builder = PAYLOAD_BUILDERS[type];

  if (!builder) {
    return res.status(400).json({
      error: 'Unknown event type',
      validTypes: Object.keys(PAYLOAD_BUILDERS),
    });
  }

  const payload = builder(req.body || {}, req.query || {});
  const headers = { 'Content-Type': 'application/json' };
  if (SECRET) {
    headers['x-webhook-secret'] = SECRET;
  }

  try {
    const botRes = await fetch(BOT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const botBody = await botRes.text();
    res.json({
      payload,
      botStatus: botRes.status,
      botResponse: botBody,
    });
  } catch (err) {
    res.status(502).json({
      error: 'Failed to reach bot webhook',
      payload,
      details: err.message,
    });
  }
});

/**
 * GET /health
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', targetBot: BOT_URL, secretConfigured: !!SECRET });
});

app.listen(PORT, () => {
  console.log(`Mock DiscordSRV listening on http://0.0.0.0:${PORT}`);
  console.log(`  Bot webhook target: ${BOT_URL}`);
  console.log(`  Webhook secret:     ${SECRET ? 'configured' : 'NOT SET'}`);
});
