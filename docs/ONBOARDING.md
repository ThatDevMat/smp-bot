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
| Docker Desktop                  | —               | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| Node.js                         | 20.x            | [nodejs.org](https://nodejs.org/) (only needed for Track B)             |
| npm                             | 10.x            | (ships with Node.js)                                                    |
| Git                             | Any recent      | [git-scm.com](https://git-scm.com/)                                     |
| Discord Application + Bot Token | —               | [Discord Developer Portal](https://discord.com/developers/applications) |
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

Choose one of two tracks. **Track A (Docker)** is recommended for new
developers — it sets up everything automatically. **Track B (Manual)** is
for developers who prefer to run dependencies directly on their machine or
need fine-grained control.

---

### Track A: Docker (Recommended)

#### 1. Install Docker Desktop

Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
for your operating system. On Windows, make sure WSL 2 backend is enabled.

#### 2. Clone and configure

```bash
git clone https://github.com/ThatDevMat/smp-bot.git
cd smp-bot
cp .env.example .env
```

Open `.env` in your editor. **You only need to fill in**:

- `BOT_TOKEN` — Your Discord bot's secret token
- `CLIENT_ID` — Your Discord application's client ID
- `GUILD_ID` — Your Discord server's ID
- `CHANNEL_MINECRAFT_CHAT`, `CHANNEL_SERVER_LOG`, `CHANNEL_SERVER_STATUS`,
  `CHANNEL_EVENTS`, `CHANNEL_POLLS` — Channel IDs after you create the
  channels in your server
- `STAFF_ROLE_IDS` — Comma-separated Discord role IDs with staff access
- `WEBHOOK_SECRET` — A shared secret for DiscordSRV webhook auth
- `MYSQL_ROOT_PASSWORD` — Set a password for the Docker MySQL root user
  (e.g. `rootpassword123`)
- `MYSQL_PASSWORD` — Set a password for the `advancedbans` MySQL user
  (e.g. `banana123`)
- `MYSQL_HOST` — Leave as `mysql` (the Docker Compose service name)

Everything else has sensible defaults for local development.

#### 3. Start the environment

```bash
docker compose up --build
```

This starts three containers:

| Container       | What it does                                                     | Access                   |
| --------------- | ---------------------------------------------------------------- | ------------------------ |
| **bot**         | The Discord bot itself (hot-reload enabled — restarts on changes) | —                        |
| **mysql**       | MySQL 8.0 pre-loaded with AdvancedBans tables and seed data       | `localhost:3306`         |
| **mock-srvchat**| Web UI for firing simulated DiscordSRV events at the bot          | `http://localhost:4000`  |

Wait for the logs to show `Bot logged in` before proceeding.

#### 4. Register slash commands (in a separate terminal)

```bash
node deploy-commands.js
```

This registers all slash commands with Discord. You only need to do this once.

#### 5. Verify it's working

In your Discord server, type `/status`. You should see a server status embed
(it will show "offline" since there is no real Minecraft server — that's normal).

Open [http://localhost:4000](http://localhost:4000) to access the mock
DiscordSRV control panel. Click **💬 Chat** to simulate a chat message.
The bot should relay it to your configured `CHANNEL_MINECRAFT_CHAT`.

Run `/checkbans Steve` (as a staff member) — the bot will query the Docker
MySQL container's seed data and return active punishments without needing
a real AdvancedBans installation.

#### Container network

All three containers communicate over a Docker bridge network called `botnet`.
The bot reaches MySQL at hostname `mysql` (port 3306) and the mock-srvchat
service contacts the bot at `http://bot:3000/srvchat`. These hostnames are
resolved by Docker's internal DNS — no port mapping to the host is required
for inter-container communication.

---

### Track B: Manual Setup

#### 1. Clone and install dependencies

```bash
git clone https://github.com/ThatDevMat/smp-bot.git
cd smp-bot
npm install
```

#### 2. Configure environment variables

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
- **`LOG_LEVEL`** — Log verbosity. Set to `debug` during development
  (colorized, human-readable output) or `info` in production (JSON
  output for log aggregators). Defaults to `debug` in development and
  `info` in production.

Log files are written to `logs/combined-%DATE%.log` (all levels) and
`logs/error-%DATE%.log` (errors only), rotated daily with 14-day retention.
The `logs/` directory is gitignored.

### Backups

The SQLite database is backed up automatically every day at **03:00** server
local time. A backup also runs immediately when the bot starts, so there is
always a fresh backup after a deployment.

Backup files are written to the `backups/` directory at the project root:
```
backups/
  backup-2026-01-15T03-00-00.db.gz
  backup-2026-01-14T03-00-00.db.gz
```

**Retention:**
- The 30 most recent daily backups are always kept
- Sunday (weekly) backups beyond the daily window are kept, up to 4

**Manual backup:** Staff members can trigger an immediate backup using the
`/backup` slash command. This is useful before a season reset or major
server event.

**Restore:** See `docs/RESTORE.md` for the full restore procedure.

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
`/history`, `/warn`, `/warnings`, `/poi`, `/season`, `/poll`, `/cache`

### Branch Protection and Dependabot

This repository uses Dependabot to automate dependency updates.
Dependabot PRs appear on Monday mornings. They can be merged if all CI
checks pass. Never merge a Dependabot major version bump without
reviewing the package changelog and testing the change locally first
(major bumps often contain breaking API changes — see `.github/dependabot.yml`
for details on which updates are blocked).

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
