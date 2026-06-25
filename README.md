# SMP Bot — Discord Bot for Minecraft Server Management

A fully-featured Discord bot for managing a Minecraft SMP server, integrating with **DiscordSRV**, **AdvancedBans**, and **RCON**.

## Features

- **Server Status** — View live player counts and online players via RCON or mcsrvstat.us API
- **Event Management** — Create, list, and cancel events with RSVP buttons and automated reminders
- **Player Registry** — Link Discord accounts to Minecraft usernames (via Mojang API)
- **Whitelist Management** — Add/remove players from the server whitelist via RCON
- **Moderation** — Query AdvancedBans for active punishments and punishment history
- **Local Warnings** — Discord-side warning tracking with DM notifications
- **POI Registry** — Register and browse points of interest on the server map
- **Season Tracking** — Track SMP seasons, start dates, and world seeds
- **Polls** — Create reaction-based polls with numbered voting
- **DiscordSRV Integration** — Relay in-game chat, join/leave, deaths, advancements, and server events to designated channels

## Prerequisites

- **Node.js v20+** (tested with v20 and v22)
- **npm**
- A **Discord Application** with a bot token (see [Discord Developer Portal](https://discord.com/developers/applications))
- A **Minecraft server** (for RCON integration) — optional but recommended
- **AdvancedBans** MySQL database (for punishment queries) — optional
- **DiscordSRV** plugin on your Minecraft server (for webhook integration) — optional

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url> smp-bot
cd smp-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

| Variable                 | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `BOT_TOKEN`              | Discord bot token                                        |
| `CLIENT_ID`              | Discord application client ID                            |
| `GUILD_ID`               | Discord server (guild) ID                                |
| `RCON_HOST`              | Minecraft server RCON hostname/IP                        |
| `RCON_PORT`              | RCON port (default: 25575)                               |
| `RCON_PASSWORD`          | RCON password                                            |
| `MYSQL_HOST`             | AdvancedBans MySQL host                                  |
| `MYSQL_PORT`             | MySQL port (default: 3306)                               |
| `MYSQL_USER`             | MySQL username                                           |
| `MYSQL_PASSWORD`         | MySQL password                                           |
| `MYSQL_DB`               | AdvancedBans database name                               |
| `WEBHOOK_PORT`           | Port for Express webhook server (default: 3000)          |
| `WEBHOOK_SECRET`         | Shared secret for webhook authentication                 |
| `CHANNEL_MINECRAFT_CHAT` | Discord channel ID for in-game chat relay                |
| `CHANNEL_SERVER_LOG`     | Discord channel ID for join/leave/death/advancement logs |
| `CHANNEL_SERVER_STATUS`  | Discord channel ID for server start/stop events          |
| `CHANNEL_EVENTS`         | Discord channel ID for event announcements               |
| `CHANNEL_POLLS`          | Discord channel ID for polls                             |
| `STAFF_ROLE_IDS`         | Comma-separated Discord role IDs with staff permissions  |

### 3. Register Slash Commands

```bash
node deploy-commands.js
```

This registers all slash commands with Discord. Run this once (or whenever you add/change commands).

### 4. Start the Bot

```bash
npm start
# or with auto-restart on file changes:
npm run dev
```

## DiscordSRV Webhook Configuration

Install [DiscordSRV](https://www.spigotmc.org/resources/discordsrv.18494/) on your Minecraft server and configure it to send webhooks:

1. In `config.yml`, set:

   ```yaml
   WebChatChannelWebhookChatMessages: true
   WebChatChannelWebhookJoinMessages: true
   WebChatChannelWebhookLeaveMessages: true
   WebChatChannelWebhookDeathMessages: true
   WebChatChannelWebhookAdvancementMessages: true
   ```

2. Configure the webhook URL in your DiscordSRV config to point to your bot:

   ```
   WebChatChannelWebhookUrl: "http://your-bot-host:3000/srvchat"
   ```

3. Set the webhook secret if configured:
   ```
   WebChatChannelWebhookSecret: "your_webhook_secret_here"
   ```

### DiscordSRV Payload Format

The bot expects JSON payloads in this format:

```json
{
  "channel": "global",
  "username": "Steve",
  "message": "Hello everyone!",
  "type": "chat"
}
```

Event types: `chat`, `join`, `leave`, `death`, `advancement`, `start`, `stop`

## Slash Commands

| Command                                                    | Description                                 | Staff Only |
| ---------------------------------------------------------- | ------------------------------------------- | ---------- |
| `/status`                                                  | Server status, player count, online players | No         |
| `/event create`                                            | Schedule a new event                        | Yes        |
| `/event list`                                              | Show upcoming events                        | No         |
| `/event cancel`                                            | Cancel an event                             | Yes        |
| `/register <username>`                                     | Link Discord to Minecraft account           | No         |
| `/whois <user>`                                            | Look up registered Minecraft account        | No         |
| `/whitelist add <username>`                                | Add player to whitelist                     | Yes        |
| `/whitelist remove <username>`                             | Remove player from whitelist                | Yes        |
| `/checkbans <player>`                                      | Check active AdvancedBans punishments       | Yes        |
| `/history <player>`                                        | Full punishment history from AdvancedBans   | Yes        |
| `/warn <player> <reason>`                                  | Issue a local warning                       | Yes        |
| `/warnings <player>`                                       | View local warning history                  | Yes        |
| `/poi add <name> <x> <y> <z> <dimension> <description>`    | Register a POI                              | No         |
| `/poi list`                                                | List all POIs                               | No         |
| `/poi remove <name>`                                       | Remove a POI                                | Yes        |
| `/season info`                                             | Show current season info                    | No         |
| `/season set <number> <start_date> [seed]`                 | Set season info                             | Yes        |
| `/poll <question> <option1> <option2> [option3] [option4]` | Create a poll                               | No         |

## Project Structure

```
smp-bot/
├── .env.example          # Environment variable template
├── .gitignore
├── package.json
├── README.md
├── deploy-commands.js    # Slash command registration script
└── src/
    ├── index.js          # Entry point — starts bot + Express server
    ├── config.js         # Configuration helper (reads .env)
    ├── commands/         # One file per slash command
    │   ├── status.js
    │   ├── event.js
    │   ├── register.js
    │   ├── whois.js
    │   ├── whitelist.js
    │   ├── checkbans.js
    │   ├── history.js
    │   ├── warn.js
    │   ├── warnings.js
    │   ├── poi.js
    │   ├── season.js
    │   └── poll.js
    ├── events/           # Discord.js event handlers
    │   ├── ready.js
    │   └── interactionCreate.js
    ├── webhooks/         # Express webhook routes
    │   └── discordsrv.js
    ├── db/               # SQLite database layer
    │   └── index.js
    ├── integrations/     # External service integrations
    │   ├── rcon.js
    │   ├── mcsrvstat.js
    │   ├── advancedbans.js
    │   └── mojang.js
    └── utils/            # Shared utilities
        ├── embeds.js
        └── permissions.js
```

---

## Deployment

### Pipeline Overview

The project uses **GitHub Actions** for continuous integration and deployment. Two workflows handle the full lifecycle:

```
                      ┌─────────────────┐
                      │  Push / PR       │
                      │  (any branch)    │
                      └────────┬────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │     CI Workflow    │
                    │  .github/workflows │
                    │   /ci.yml          │
                    └────────┬───────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌────────────┐ ┌────────────┐ ┌────────────────┐
      │    Lint    │ │    Test    │ │ Security Audit │
      │  ESLint +  │ │ Jest +     │ │ npm audit      │
      │  Prettier  │ │ coverage   │ │ (prod deps)    │
      └─────┬──────┘ └─────┬──────┘ └───────┬────────┘
            │              │                │
            └──────────────┴────────────────┘
                           │
              all pass on main branch?
                           │
                           ▼
              ┌────────────────────────┐
              │   Deploy Workflow      │
              │  .github/workflows/    │
              │   deploy.yml           │
              │  (triggered by CI      │
              │   completion on main)  │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   SSH into production  │
              │   • git pull           │
              │   • npm ci --omit=dev  │
              │   • pm2 restart        │
              │   • health check (15s) │
              └───────────┬────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
      ┌──────────────┐     ┌──────────────────┐
      │   ✅ Done    │     │ ❌ Discord alert │
      └──────────────┘     └──────────────────┘
```

### Workflow Design Decision

Deploy uses the **`workflow_run` pattern** — the deploy workflow is triggered by CI completion on `main` rather than by a push event directly. This guarantees that **deploy only runs if CI passed on the exact same commit**, without relying on GitHub branch protection rules. The alternative (push trigger + branch protection) would also work but leaves a gap: branch protection only blocks direct pushes when properly configured, and the `workflow_run` approach is self-validating regardless of branch settings.

### GitHub Secrets

The following secrets must be configured in your GitHub repository at **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                   | Description                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| `BOT_TOKEN`              | Discord bot token                                                              |
| `DEPLOY_SSH_HOST`        | IP or hostname of the production server                                        |
| `DEPLOY_SSH_USER`        | SSH username for the production server                                         |
| `DEPLOY_SSH_KEY`         | Full PEM content of the private SSH key (e.g. contents of `~/.ssh/id_ed25519`) |
| `DEPLOY_SSH_PORT`        | SSH port (default `22`)                                                        |
| `DISCORD_DEPLOY_WEBHOOK` | Discord webhook URL for deployment failure notifications                       |

**Note:** `DEPLOY_SSH_PORT` defaults to `22` in the workflow. Set it explicitly if your server uses a non-standard port.

### Production Server Setup

Bootstrap the production server once before the first deploy:

```bash
# 1. Install Node.js v20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PM2 globally
sudo npm install -g pm2

# 3. Clone the repository
git clone https://github.com/ThatDevMat/smp-bot.git ~/smp-bot
cd ~/smp-bot

# 4. Create and populate .env with your production values
cp .env.example .env
nano .env
# Fill in every variable — see the Setup section above for the full list

# 5. Install production dependencies
npm ci --omit=dev

# 6. Start the bot via PM2
pm2 start ecosystem.config.js
pm2 save

# 7. (Optional) Set PM2 to start on boot
pm2 startup
# Follow the printed instructions to enable the systemd service
```

### Manual Redeploy

If you need to redeploy without pushing a new commit (e.g. after editing `.env` on the server):

```bash
ssh your-server
cd ~/smp-bot
pm2 restart minecraft-bot
pm2 save
```

### Health Check Failure

If the deploy pipeline's health check fails (the `pm2 status` is not `online` within 15 seconds):

1. **SSH into the server** and check the logs:
   ```bash
   pm2 logs minecraft-bot --lines 50
   ```
2. **Check the process status:**
   ```bash
   pm2 show minecraft-bot
   ```
3. **Common causes:**
   - `.env` file is missing or has invalid values on the server
   - A required environment variable is not set
   - A dependency failed to install (run `npm ci` manually)
   - The Node.js version on the server is below v20
4. After fixing the issue, restart manually:
   ```bash
   pm2 restart minecraft-bot && pm2 save
   ```

### Recommended Branch Protection Rules

Configure these manually in GitHub at **Settings → Branches → Add rule** (for the `main` branch):

| Setting                                          | Value                                     |
| ------------------------------------------------ | ----------------------------------------- |
| Require status checks to pass before merging     | ✅ Enabled                                |
| Required status checks                           | `Lint & Format`, `Test`, `Security Audit` |
| Require branches to be up to date before merging | ✅ Enabled                                |
| Do not allow force pushes                        | ✅ Enabled                                |
| Do not allow deletions                           | ✅ Enabled                                |

These rules ensure that no code reaches `main` without passing the full CI pipeline.

### Note on Default Branch

The workflows reference `main` as the production branch. If your repository still uses the old default name (`master`), rename it:

```bash
git branch -m master main
git push origin main
# Update the default branch in GitHub: Settings → Branches → Default branch
# Then delete the old remote branch:
git push origin --delete master
```
