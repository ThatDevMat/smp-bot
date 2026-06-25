# Architecture

This document explains how the codebase is organised and how data flows
through the system. Read this before you start making changes.

---

## High-Level Overview

The application sits between the Discord API and the Minecraft server,
translating interactions between the two. It has four layers:

```
                          Discord API
                              ↕
                    discord.js runtime
                   (Gateway + REST intents)
                              ↕
    ┌─────────────────────────────────────────────────┐
    │              Event / Interaction Router          │
    │  (interactionCreate.js — dispatches commands     │
    │   and button clicks)                             │
    └──────┬─────────────────────────────────┬─────────┘
           ↓                                 ↓
    ┌────────────┐                  ┌─────────────────┐
    │  Command    │                  │  DiscordSRV      │
    │  Handlers   │                  │  Webhook Server  │
    │  (12 files) │                  │  (Express)       │
    └──────┬─────┘                  └────────┬─────────┘
           ↓                                 ↓
    ┌──────────────────────────────────────────────┐
    │           Services / Business Logic           │
    │  (embeds.js, permissions.js, playerResolver)  │
    └──────┬───────────────────────────┬────────────┘
           ↓                           ↓
    ┌──────────┐     ┌──────────────────────────────────┐
    │ SQLite   │     │        Integrations               │
    │ (6 tables│     │  ┌────────┐ ┌──────────┐ ┌─────┐ │
    │  20+ fns)│     │  │ RCON   │ │ MySQL    │ │Mojang│ │
    └──────────┘     │  │ client │ │(Advanced │ │ API │ │
                     │  │        │ │ Bans)    │ │     │ │
                     │  └────────┘ └──────────┘ └─────┘ │
                     └──────────────────────────────────┘

  Minecraft Server (DiscordSRV plugin)
         ↓ (HTTP POST /srvchat)
  Express Webhook Handler
         ↓
  Discord Channel Relay (via discord.js client)
```

The bot is **not** a single monolithic handler. Each slash command is an
independent module; the interaction router in `interactionCreate.js` loads
them from a Collection and dispatches by command name. Business logic lives
in utility modules, not in command files.

---

## Directory Reference

| Path                | Purpose                                                                                                                                                       | Keep Out                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/commands/`     | Input parsing, permission checks, calling services, replying to interactions. One file per command.                                                           | Business logic, SQL queries, RCON calls, embed construction (use `embeds.js` for that).                               |
| `src/events/`       | discord.js lifecycle event handlers (`ClientReady`, `InteractionCreate`).                                                                                     | No application logic. These are thin wiring.                                                                          |
| `src/webhooks/`     | Express router for the DiscordSRV webhook receiver. Parses payloads, builds embeds, relays to Discord channels.                                               | No RCON or MySQL calls. This path only touches the Discord client and the embed builders.                             |
| `src/db/`           | All SQLite query helpers. Twenty exported functions covering events, player registry, warnings, POIs, seasons, and RSVPs.                                     | Discord.js imports (never import `discord.js` here), embed formatting, anything integration-related.                  |
| `src/integrations/` | Wrappers for external services: RCON client, AdvancedBans MySQL pool, Mojang API HTTP client, mcsrvstat.us API. Each file is self-contained.                  | Discord.js types, command logic, embed builders.                                                                      |
| `src/utils/`        | Shared utilities used by every other layer: embed builders (`embeds.js`), permission checks (`permissions.js`), player UUID resolution (`playerResolver.js`). | Side effects, database calls, network requests. Pure functions only (except `permissions.js` which reads role cache). |
| `src/config.js`     | Reads `.env` via dotenv, exports a typed config object and a `validateConfig()` function.                                                                     | Anything else. This is a single-purpose module.                                                                       |
| `src/index.js`      | Entry point. Boot sequence: validate env → create client → load commands → load events → connect RCON → start Express → login.                                | Any logic extracted to its own module (commands, events, integrations).                                               |
| `tests/`            | Jest test files. Mirrors the `src/` structure.                                                                                                                | Production code, actual credentials.                                                                                  |

---

## Data Flow Walkthroughs

### 1. A staff member runs `/event create`

```
1. Discord sends a ChatInputCommandInteraction to the bot.
2. interactionCreate.js receives it, looks up the "event" command
   from the client.commands Collection, and calls execute().
3. event.js's execute() checks permissions via requireStaff().
   If the caller is not staff, it replies with "⛔ You do not have
   permission" (ephemeral) and stops.
4. Subcommand is "create". execute() calls handleCreate(interaction).
5. handleCreate() reads the user-provided options (name, date, time,
   timezone, description) from the interaction.
6. It calls db.createEvent(...) which INSERTs a row into the SQLite
   events table and returns the new row ID.
7. It builds an embed using eventAnnouncementEmbed(...) from embeds.js.
8. It fetches the configured events channel and posts the embed,
   then adds an RSVP button (customId: "rsvp_<id>").
9. It replies to the interaction confirming the event was created.
10. (Later) node-cron checks every minute for events that are 24h or
    1h away and sends reminder DMs to users who RSVP'd.
```

### 2. A player joins the Minecraft server (DiscordSRV webhook)

```
1. The DiscordSRV plugin on the Minecraft server detects a player join.
2. It sends an HTTP POST to http://<bot-host>:3000/srvchat with a
   JSON body: { "channel": "global", "username": "Steve", type: "join" }.
3. Express middleware validates the x-webhook-secret header (if
   WEBHOOK_SECRET is set). Returns 401 if it doesn't match.
4. The /srvchat route handler reads the payload. type = "join".
5. It calls playerEventEmbed("Steve", "join") which returns an embed
   with a green colour and "🟢 Player Joined" title.
6. It calls relayMessage("serverLog", embed). This looks up the
   CHANNEL_SERVER_LOG channel ID from config.
7. If the channel is configured, it fetches the channel via
   client.channels.fetch() and sends the embed.
8. If the channel is not configured, it logs an info message and
   silently skips (no crash).
9. Express responds with { status: "ok" }.
```

### 3. A staff member runs `/checkbans Steve`

```
1. Discord sends a ChatInputCommandInteraction.
2. interactionCreate.js dispatches to commands/checkbans.js.
3. checkbans.js calls requireStaff(interaction). Returns false if the
   caller is not staff, stopping execution.
4. It reads the "player" option string ("Steve").
5. It calls resolvePlayer("Steve") from utils/playerResolver.js.
   a. "Steve" does not match the UUID pattern, so it calls the Mojang
      API to fetch the UUID.
   b. Mojang API returns { uuid: "1234...", username: "Steve" }.
   c. resolvePlayer returns { uuid: "1234...", username: "Steve" }.
6. If resolvePlayer returns null (player not found on Mojang), the
   command replies with "❌ Player not found" and returns.
7. It calls advancedbans.getActiveBans("1234..."). This runs a
   parameterised MySQL query against the AdvancedBans database:
   SELECT * FROM punishments WHERE uuid = ? AND type = 'ban' AND active = 1
8. If the MySQL pool is not configured or unreachable, it catches the
   error and replies with a graceful error message — the command never
   exposes raw database errors to the user.
9. It builds an embed via activePunishmentsEmbed("Steve", rows) from
   embeds.js. Each row becomes a field showing type, reason, expiry,
   and who issued it.
10. It replies to the interaction with the embed.
```

---

## Database Schema

### SQLite (bot's local database — file: `smp-bot.db`)

#### `events`

| Column        | Type    | Constraints                      | Description                  |
| ------------- | ------- | -------------------------------- | ---------------------------- |
| `id`          | INTEGER | PRIMARY KEY AUTOINCREMENT        | Unique event ID              |
| `name`        | TEXT    | NOT NULL                         | Event name                   |
| `description` | TEXT    | —                                | Event description (nullable) |
| `event_date`  | TEXT    | NOT NULL                         | Date string (ISO 8601)       |
| `event_time`  | TEXT    | NOT NULL                         | Time string (HH:MM)          |
| `timezone`    | TEXT    | NOT NULL DEFAULT 'UTC'           | IANA timezone name           |
| `created_by`  | TEXT    | NOT NULL                         | Discord user ID of creator   |
| `created_at`  | TEXT    | NOT NULL DEFAULT datetime('now') | Row creation timestamp       |
| `cancelled`   | INTEGER | NOT NULL DEFAULT 0               | 1 if cancelled, 0 otherwise  |

#### `player_registry`

| Column               | Type | Constraints                      | Description                 |
| -------------------- | ---- | -------------------------------- | --------------------------- |
| `discord_id`         | TEXT | PRIMARY KEY                      | Discord user ID             |
| `minecraft_username` | TEXT | NOT NULL                         | Current Minecraft username  |
| `minecraft_uuid`     | TEXT | NOT NULL                         | Minecraft UUID (no hyphens) |
| `registered_at`      | TEXT | NOT NULL DEFAULT datetime('now') | Registration timestamp      |

#### `warnings`

| Column        | Type    | Constraints                      | Description                       |
| ------------- | ------- | -------------------------------- | --------------------------------- |
| `id`          | INTEGER | PRIMARY KEY AUTOINCREMENT        | Warning ID                        |
| `player_uuid` | TEXT    | NOT NULL                         | Minecraft UUID of warned player   |
| `discord_id`  | TEXT    | —                                | Linked Discord ID (if registered) |
| `reason`      | TEXT    | NOT NULL                         | Warning reason                    |
| `issued_by`   | TEXT    | NOT NULL                         | Discord user ID of issuer         |
| `issued_at`   | TEXT    | NOT NULL DEFAULT datetime('now') | Warning timestamp                 |

#### `pois`

| Column        | Type    | Constraints                      | Description                         |
| ------------- | ------- | -------------------------------- | ----------------------------------- |
| `id`          | INTEGER | PRIMARY KEY AUTOINCREMENT        | POI ID                              |
| `name`        | TEXT    | NOT NULL UNIQUE                  | POI display name                    |
| `x`           | REAL    | NOT NULL                         | X coordinate                        |
| `y`           | REAL    | NOT NULL                         | Y coordinate                        |
| `z`           | REAL    | NOT NULL                         | Z coordinate                        |
| `dimension`   | TEXT    | NOT NULL DEFAULT 'overworld'     | `overworld`, `nether`, or `the_end` |
| `description` | TEXT    | —                                | POI description                     |
| `created_by`  | TEXT    | NOT NULL                         | Discord user ID of creator          |
| `created_at`  | TEXT    | NOT NULL DEFAULT datetime('now') | Creation timestamp                  |

#### `seasons`

| Column          | Type    | Constraints                      | Description                  |
| --------------- | ------- | -------------------------------- | ---------------------------- |
| `id`            | INTEGER | PRIMARY KEY AUTOINCREMENT        | Season ID                    |
| `season_number` | INTEGER | NOT NULL UNIQUE                  | Season number (1, 2, 3, ...) |
| `start_date`    | TEXT    | NOT NULL                         | Season start date (ISO 8601) |
| `seed`          | TEXT    | —                                | World seed (nullable)        |
| `created_at`    | TEXT    | NOT NULL DEFAULT datetime('now') | Row creation timestamp       |

#### `rsvps`

| Column                         | Type    | Constraints                                 | Description                 |
| ------------------------------ | ------- | ------------------------------------------- | --------------------------- |
| `event_id`                     | INTEGER | NOT NULL, FK → events.id, ON DELETE CASCADE | Event ID                    |
| `discord_id`                   | TEXT    | NOT NULL                                    | Discord user ID             |
| `responded_at`                 | TEXT    | NOT NULL DEFAULT datetime('now')            | RSVP timestamp              |
| **PK:** (event_id, discord_id) |         |                                             | One RSVP per user per event |

### AdvancedBans MySQL (read-only — schema owned by the plugin)

The bot queries two AdvancedBans tables. **It never writes to them.**

#### `punishments`

| Column     | Type        | Notes                           |
| ---------- | ----------- | ------------------------------- |
| `uuid`     | VARCHAR(36) | Player UUID                     |
| `type`     | VARCHAR(16) | `ban`, `mute`, `warn`           |
| `reason`   | TEXT        | Punishment reason               |
| `executor` | VARCHAR(36) | UUID of staff who issued it     |
| `start`    | BIGINT      | Unix timestamp (milliseconds)   |
| `end`      | BIGINT      | Expiry timestamp, 0 = permanent |
| `active`   | TINYINT(1)  | 1 = currently active            |

#### `player_aliases`

| Column     | Type        | Notes                         |
| ---------- | ----------- | ----------------------------- |
| `uuid`     | VARCHAR(36) | Player UUID                   |
| `name`     | VARCHAR(16) | Known username                |
| `lastSeen` | BIGINT      | When this alias was last seen |

> **If AdvancedBans updates its schema**, check `src/integrations/advancedbans.js`
> and update the column names in the query strings. The table names and column
> names are hardcoded in SQL — there is no ORM layer.

---

## Caching

The bot maintains an in-memory cache using `node-cache` to reduce
external API calls and avoid hitting rate limits. The cache is a singleton
created in `src/utils/cache.js` — all cache access must go through the
typed helper functions exported by that module.

### What is cached and for how long

| Data                      | TTL      | Why this TTL                          |
| ------------------------- | -------- | ------------------------------------- |
| Mojang UUID lookups       | 1 hour   | UUIDs rarely change; 1 hour prevents  |
|                           |          | repeated lookups from exhausting the  |
|                           |          | 600 req/10 min rate limit             |
| mcsrvstat.us server status| 30 sec   | Status data changes at most every few |
|                           |          | seconds; 30 s balances freshness with |
|                           |          | cache hit rate during bursts          |

### Stale fallback

When the mcsrvstat.us API is unreachable but a (stale) cached result
exists, the cache returns it with a `stale: true` flag. The `/status`
command appends a ⚠️ footer to the embed when it sees this flag, so
users know the data may be outdated rather than seeing an error.

### Cache loss on restart

The cache is in-memory only — it is lost when the bot process restarts.
This is intentional and acceptable because:
- TTLs are short (30 s – 1 h), so the cost of a cold cache is limited to
  a handful of extra API calls after restart
- Persisting cache to disk would add complexity with negligible benefit
  given the short TTLs

### Observability

Staff can inspect current cache state via `/cache stats` (hits, misses,
keys, server-status TTL) or flush the cache with `/cache flush`. This is
useful before testing or after a Mojang API rate-limit incident.

---

## Validation

All user input and incoming webhook payloads are validated against Zod
schemas before any business logic runs. The validation layer is centralized
in `src/schemas/` (schema definitions) and `src/utils/validate.js` (the
`validateInput()` helper and `ValidationError` class).

### Where schemas live

| File                       | Validates                          |
| -------------------------- | ---------------------------------- |
| `src/schemas/common.js`    | Reusable primitives (MinecraftUsername, UUID, Dimension, Coordinate, FutureDate, TimeString, Timezone, DiscordSnowflake) |
| `src/schemas/events.js`    | `/event create` and `/event cancel` |
| `src/schemas/players.js`   | `/register`, `/whois`, `/whitelist` |
| `src/schemas/moderation.js`| `/warn`, `/checkbans`, `/history`, `/warnings` |
| `src/schemas/pois.js`      | `/poi add` and `/poi remove`       |
| `src/schemas/season.js`    | `/season set`                      |
| `src/schemas/webhooks.js`  | DiscordSRV webhook payloads (discriminated union on `type`) |

### The validateInput() pattern

Every command follows this exact flow:

```
raw input object → validateInput(schema, raw) → typed output
                       ↓ on failure
                ValidationError thrown
                       ↓ caught in execute()
                ephemeral reply with userMessage
```

Key rules:
- `validateInput()` never throws a raw `ZodError` — it always wraps it in
  a `ValidationError` that carries both a user-friendly message (`userMessage`)
  and the full Zod error object (`zodError` for logging).
- Slash commands catch `ValidationError` and reply ephemerally with
  `err.userMessage`. They never propagate Zod errors to the user.
- Webhook handlers catch `ValidationError` and return HTTP 400 with
  `err.zodError.flatten()` in the response body, logging the raw payload at
  debug level.
- Raw `ZodError` instances must never be thrown uncaught or passed directly
  to the user — this is enforced by the helper architecture.

### Adding a new command with validation

1. Define a Zod schema in the appropriate `src/schemas/` file before writing
   the `execute()` function.
2. At the top of `execute()`, extract raw `interaction.options` into a plain
   object and call `validateInput()`.
3. Use the returned typed data for the rest of the function.
4. Add test cases for both valid and invalid input.

---

## Key Design Decisions

### Why SQLite for local data (not a second MySQL database)

The bot stores its own data (events, warnings, player registrations, POIs,
seasons) in a local SQLite file. This avoids requiring a second MySQL
instance just for the bot's internal bookkeeping. SQLite is zero-config,
portable (the entire database is one file), and more than sufficient for
the low-write-volume workloads in this project. If the project outgrows
SQLite (unlikely for an SMP server), the schema is simple enough that
migrating to MySQL would be straightforward.

### Why DiscordSRV is webhook-based rather than plugin-API-based

DiscordSRV communicates via HTTP POST webhooks — the Minecraft plugin fires
a JSON payload at the bot's Express endpoint. This is simpler than a
plugin API because it does not require the Minecraft server to maintain
a persistent connection or authenticate beyond a shared secret. The tradeoff
is that the connection is one-directional: the bot cannot send requests back
to the Minecraft server via this channel (that is what RCON is for).

### Why AdvancedBans data is read-only from the bot's perspective

The bot queries the AdvancedBans MySQL database but never writes to it.
This is intentional: AdvancedBans is the system of record for punishments,
and the bot should not be able to bypass the plugin's internal logic,
logging, or permission checks. If a staff member needs to issue a ban or
mute, they should use AdvancedBans' own commands on the server console.
The bot provides visibility (lookups and history), not authority.

### Why RCON is used for whitelist management rather than a plugin API

RCON is a standard Minecraft protocol that requires no additional plugins
beyond what the vanilla server provides. Every Minecraft server can enable
RCON in `server.properties`. Dedicated plugin APIs would introduce another
dependency and another surface area for version incompatibilities. The
downside is that RCON is unencrypted and relatively slow, which is why
whitelist operations should be kept to individual player adds/removes.

### Proposing a change to a design decision

If you disagree with any of these decisions and want to propose a different
approach, open a [GitHub Discussion](https://github.com/ThatDevMat/smp-bot/discussions)
before writing code. Architecture discussions belong outside of PRs so the
whole team can weigh in before implementation starts.
