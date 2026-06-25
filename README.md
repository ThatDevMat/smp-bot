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

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Discord bot token |
| `CLIENT_ID` | Discord application client ID |
| `GUILD_ID` | Discord server (guild) ID |
| `RCON_HOST` | Minecraft server RCON hostname/IP |
| `RCON_PORT` | RCON port (default: 25575) |
| `RCON_PASSWORD` | RCON password |
| `MYSQL_HOST` | AdvancedBans MySQL host |
| `MYSQL_PORT` | MySQL port (default: 3306) |
| `MYSQL_USER` | MySQL username |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_DB` | AdvancedBans database name |
| `WEBHOOK_PORT` | Port for Express webhook server (default: 3000) |
| `WEBHOOK_SECRET` | Shared secret for webhook authentication |
| `CHANNEL_MINECRAFT_CHAT` | Discord channel ID for in-game chat relay |
| `CHANNEL_SERVER_LOG` | Discord channel ID for join/leave/death/advancement logs |
| `CHANNEL_SERVER_STATUS` | Discord channel ID for server start/stop events |
| `CHANNEL_EVENTS` | Discord channel ID for event announcements |
| `CHANNEL_POLLS` | Discord channel ID for polls |
| `STAFF_ROLE_IDS` | Comma-separated Discord role IDs with staff permissions |

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

| Command | Description | Staff Only |
|---|---|---|
| `/status` | Server status, player count, online players | No |
| `/event create` | Schedule a new event | Yes |
| `/event list` | Show upcoming events | No |
| `/event cancel` | Cancel an event | Yes |
| `/register <username>` | Link Discord to Minecraft account | No |
| `/whois <user>` | Look up registered Minecraft account | No |
| `/whitelist add <username>` | Add player to whitelist | Yes |
| `/whitelist remove <username>` | Remove player from whitelist | Yes |
| `/checkbans <player>` | Check active AdvancedBans punishments | Yes |
| `/history <player>` | Full punishment history from AdvancedBans | Yes |
| `/warn <player> <reason>` | Issue a local warning | Yes |
| `/warnings <player>` | View local warning history | Yes |
| `/poi add <name> <x> <y> <z> <dimension> <description>` | Register a POI | No |
| `/poi list` | List all POIs | No |
| `/poi remove <name>` | Remove a POI | Yes |
| `/season info` | Show current season info | No |
| `/season set <number> <start_date> [seed]` | Set season info | Yes |
| `/poll <question> <option1> <option2> [option3] [option4]` | Create a poll | No |

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
