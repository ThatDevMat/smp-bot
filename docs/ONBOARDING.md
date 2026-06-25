# Onboarding Guide

Welcome to the **SMP Bot** — a Discord bot that manages a Minecraft SMP server.
It bridges Discord and Minecraft by relaying in-game chat, managing whitelists,
tracking events, recording points of interest, and querying the server's
punishment database. You'll be productive on day one if you read this guide
and follow the setup steps in order.

A few things to know before you dive in:

- **Clean code matters.** We lint with ESLint and format with Prettier.
  Coverage stays above 80%. If your PR drops either, CI will tell you.
- **Test your changes.** Run the test suite before you push. Add tests for
  new features.
- **Ask questions.** If something is unclear, open a Discussion or ping the
  team. The docs are here to help you, not to replace conversation.

---

## Prerequisites

| Tool                            | Minimum Version | Install Link                                                            |
| ------------------------------- | --------------- | ----------------------------------------------------------------------- |
| Node.js                         | 20.x            | [nodejs.org](https://nodejs.org/)                                       |
| npm                             | 10.x            | (ships with Node.js)                                                    |
| Git                             | Any recent      | [git-scm.com](https://git-scm.com/)                                     |
| Discord Application + Bot Token | —               | [Discord Developer Portal](https://discord.com/developers/applications) |
| MySQL client (optional)         | 8.x             | [dev.mysql.com/downloads/](https://dev.mysql.com/downloads/)            |
| PM2 (production only)           | 5.x             | `npm install -g pm2`                                                    |

You also need **access to a Minecraft server** if you want to test the
DiscordSRV webhook receiver, RCON commands, or AdvancedBans lookups. For local
development you can leave those credentials at their default placeholder
values — the bot will start and most commands will work. See the table below
for which features need what.

| Feature                  | Requires Live Minecraft Server?                                         |
| ------------------------ | ----------------------------------------------------------------------- |
| `/status`                | Works without (falls back to mcsrvstat.us API). RCON gives richer data. |
| `/event` commands        | No. Fully local (SQLite).                                               |
| `/register`, `/whois`    | No. Uses Mojang API (internet required).                                |
| `/whitelist`             | Yes (RCON). Will fail gracefully if RCON is unreachable.                |
| `/checkbans`, `/history` | Yes (AdvancedBans MySQL). Will fail gracefully if DB is unreachable.    |
| `/warn`, `/warnings`     | No. Fully local (SQLite).                                               |
| `/poi` commands          | No. Fully local (SQLite).                                               |
| `/season` commands       | No. Fully local (SQLite).                                               |
| `/poll`                  | No. Pure Discord interaction.                                           |
| DiscordSRV webhooks      | Yes. Needs the Minecraft plugin to send HTTP requests.                  |
| RSVP button on events    | No. Pure Discord interaction.                                           |

---

## Local Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/ThatDevMat/smp-bot.git
cd smp-bot
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` in your editor. Here is what every variable does:

- **`BOT_TOKEN`** — Your Discord bot's secret token. Get this from the
  [Discord Developer Portal](https://discord.com/developers/applications)
  under your application → Bot → Reset Token. Treat this like a password.
- **`CLIENT_ID`** — Your Discord application's public ID. Found on the
  same page under OAuth2 → General → Client ID.
- **`GUILD_ID`** — The Discord server (guild) where the bot will operate.
  Right-click your server icon in Discord → Copy ID. You need Developer
  Mode enabled in Discord settings (Advanced → Developer Mode).
- **`RCON_HOST`**, **`RCON_PORT`**, **`RCON_PASSWORD`** — Your Minecraft
  server's RCON credentials. Leave as-is for local dev; the bot will skip
  RCON features gracefully if it cannot connect.
- **`MYSQL_HOST`**, **`MYSQL_PORT`**, **`MYSQL_USER`**, **`MYSQL_PASSWORD`**,
  **`MYSQL_DB`** — Your AdvancedBans MySQL database credentials. Leave as
  defaults for local dev; the bot will handle connection failures gracefully.
- **`WEBHOOK_PORT`** — Port for the Express server that receives DiscordSRV
  webhooks (default 3000).
- **`WEBHOOK_SECRET`** — Shared secret the webhook sends in the
  `x-webhook-secret` header. If left blank, the endpoint is unprotected
  (a warning is logged at startup).
- **`CHANNEL_MINECRAFT_CHAT`**, **`CHANNEL_SERVER_LOG`**,
  **`CHANNEL_SERVER_STATUS`** — Discord channel IDs for DiscordSRV relay.
  Set these after you create the channels in your server.
- **`CHANNEL_EVENTS`** — Channel where event announcements are posted.
- **`CHANNEL_POLLS`** — Channel where polls are posted.
- **`STAFF_ROLE_IDS`** — Comma-separated list of Discord role IDs that
  have permission to use staff-only commands.

### 3. The SQLite database

The bot creates a file called `smp-bot.db` in the project root automatically
the first time it starts. You do not need to run a separate migration.
To reset the database, just delete the file — it will be recreated on the
next start.

If you want to inspect the database:

```bash
# Install sqlite3 if you don't have it
sqlite3 smp-bot.db
.tables
SELECT * FROM events;
```

### 4. Register slash commands

```bash
node deploy-commands.js
```

This registers all slash commands with Discord via the REST API. You only
need to run this once, unless you add or change a command definition. After
running it, you should see the commands in your Discord server within a few
seconds. Registered commands:

`/status`, `/event`, `/register`, `/whois`, `/whitelist`, `/checkbans`,
`/history`, `/warn`, `/warnings`, `/poi`, `/season`, `/poll`

### 5. Start the bot

```bash
# Development mode (auto-restarts on file changes)
npm run dev

# Or production mode
npm start
```

### 6. Verify it's working

Look for these signs in the console output:

```
✅ Bot logged in as your-bot-name#1234
[Webhook] DiscordSRV receiver listening on port 3000
```

Then in Discord, type `/status` and press enter. You should see a server
status embed (it will show "offline" if you're not pointing at a real
server — that is normal). Type `/event list` and you should see an empty
list (or the events you've created). Type `/poll "Best biome?" Plains
Desert Jungle` and you should see a poll embed with numbered reactions.

Everything is working.

---

## Running Tests and Lint

### Run the full test suite

```bash
npm test
```

### Run tests with coverage

```bash
npm run test:coverage
```

The coverage report is written to `coverage/` and is gitignored. Open
`coverage/lcov-report/index.html` in a browser for the interactive view.

### Run a single test file

```bash
npx jest tests/commands/event.test.js
# or with coverage
npx jest tests/commands/event.test.js --coverage
```

### Run ESLint

```bash
npm run lint
```

### Check Prettier formatting

```bash
npx prettier --check .
# Auto-fix:
npx prettier --write .
```

### What to do if coverage drops below 80 %

The CI pipeline enforces a global 80 % threshold across statements,
branches, functions, and lines. If your changes push coverage under the
line:

1. Run `npm run test:coverage` and look at the per-file table at the end.
   The files with low coverage are listed explicitly.
2. Add tests for the uncovered paths. Focus on the branches column —
   uncovered `if/else` branches are usually the quickest win.
3. If a file is genuinely untestable (an index.js entry point, a file that
   calls `process.exit`), add it to the `collectCoverageFrom` exclusion
   list in `jest.config.js` with a comment explaining why.

---

## Key Contacts and Resources

|                           |                                                                 |
| ------------------------- | --------------------------------------------------------------- |
| **Project Lead**          | _Fill in name / Discord handle_                                 |
| **Discord Server**        | _Invite link_                                                   |
| **Issue Tracker**         | [GitHub Issues](https://github.com/ThatDevMat/smp-bot/issues)   |
| **Minecraft Server Docs** | _Link to internal wiki or documentation_                        |
| **CI Status**             | [GitHub Actions](https://github.com/ThatDevMat/smp-bot/actions) |

> These placeholders should be filled in by the project owner. If you are
> setting up this project for the first time, add the real values here and
> remove this note.
