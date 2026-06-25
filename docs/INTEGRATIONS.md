# Integrations

This guide covers every external service the bot connects to: what each
integration does, how to set it up, and how to test it works.

---

## DiscordSRV (Webhook Receiver)

**What it does:** DiscordSRV is a Minecraft plugin that bridges in-game chat
with Discord. It fires HTTP POST requests to the bot's Express server whenever
a player chats, joins, leaves, dies, unlocks an advancement, or when the
server starts or stops. The bot parses these payloads and posts formatted
embeds to the configured Discord channels.

### Installing DiscordSRV on the Minecraft Server

1. Download DiscordSRV from [SpigotMC](https://www.spigotmc.org/resources/discordsrv.18494/)
   or [Modrinth](https://modrinth.com/plugin/discordsrv).
2. Place the `.jar` file in your server's `plugins/` directory.
3. Restart the server (or run `/plugman reload discordsrv` if you use PlugMan).
4. Edit `plugins/DiscordSRV/config.yml` (see below).

### Configuring DiscordSRV to Point at the Bot

In `plugins/DiscordSRV/config.yml`, set the following:

```yaml
# Enable webhook relay for each event type
WebChatChannelWebhookChatMessages: true
WebChatChannelWebhookJoinMessages: true
WebChatChannelWebhookLeaveMessages: true
WebChatChannelWebhookDeathMessages: true
WebChatChannelWebhookAdvancementMessages: true

# Point at the bot's Express endpoint
WebChatChannelWebhookUrl: 'http://your-bot-host:3000/srvchat'

# If WEBHOOK_SECRET is set in the bot's .env, set it here too
WebChatChannelWebhookSecret: 'your_webhook_secret_here'
```

The bot's webhook endpoint accepts these payload event types:

| Type              | What Triggers It              | Discord Channel          |
| ----------------- | ----------------------------- | ------------------------ |
| `chat` / `global` | In-game chat message          | `CHANNEL_MINECRAFT_CHAT` |
| `join`            | Player joins the server       | `CHANNEL_SERVER_LOG`     |
| `leave`           | Player leaves the server      | `CHANNEL_SERVER_LOG`     |
| `death`           | Player dies                   | `CHANNEL_SERVER_LOG`     |
| `advancement`     | Player unlocks an advancement | `CHANNEL_SERVER_LOG`     |
| `start`           | Server starts                 | `CHANNEL_SERVER_STATUS`  |
| `stop`            | Server stops                  | `CHANNEL_SERVER_STATUS`  |

### Testing with curl (no Minecraft server needed)

You can simulate any DiscordSRV event from your terminal. Replace the URL
with your bot's address and adjust the webhook secret if set.

**Chat message:**

```bash
curl -X POST http://localhost:3000/srvchat \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_webhook_secret_here" \
  -d '{"channel":"global","username":"Steve","message":"Hello everyone!","type":"chat"}'
```

**Player join:**

```bash
curl -X POST http://localhost:3000/srvchat \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_webhook_secret_here" \
  -d '{"channel":"global","username":"Alex","type":"join"}'
```

**Advancement unlock:**

```bash
curl -X POST http://localhost:3000/srvchat \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_webhook_secret_here" \
  -d '{"channel":"global","username":"Steve","advancement":"A Strange Deal","description":"Repair a merchant villager","type":"advancement"}'
```

**Player death:**

```bash
curl -X POST http://localhost:3000/srvchat \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_webhook_secret_here" \
  -d '{"channel":"global","username":"Steve","message":"Steve was slain by a Creeper","type":"death"}'
```

**Server start:**

```bash
curl -X POST http://localhost:3000/srvchat \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_webhook_secret_here" \
  -d '{"type":"start"}'
```

If the webhook secret is not set (you left `WEBHOOK_SECRET` blank in `.env`),
you can omit the `x-webhook-secret` header. The bot logs a warning at startup
if the secret is missing.

### Common Misconfiguration Mistakes

| Symptom                     | Likely Cause                                                                                     | Fix                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| No embeds appear in Discord | `CHANNEL_MINECRAFT_CHAT` / `CHANNEL_SERVER_LOG` / `CHANNEL_SERVER_STATUS` is not set or is wrong | Check channel IDs in `.env`. Right-click the channel in Discord → Copy ID.                  |
| Webhook returns 401         | `WEBHOOK_SECRET` is set on the bot but not sent by DiscordSRV (or vice versa)                    | Match the secret in both `discordsrv/config.yml` and `.env`.                                |
| Bot receives nothing        | DiscordSRV cannot reach the bot's IP/port                                                        | The bot's port (default 3000) must be reachable from the Minecraft server. Check firewalls. |

---

## AdvancedBans (MySQL Read)

**What it does:** Reads punishment data from the AdvancedBans MySQL database.
The bot only executes `SELECT` queries — it never issues bans, mutes, or
warnings through the database. Punishments must be created via AdvancedBans'
in-game commands.

### Configuration

AdvancedBans must be configured to use MySQL. If you are already running it
with SQLite, you will need to switch — see the
[AdvancedBans documentation](https://www.spigotmc.org/resources/advancedbans.7337/)
for the migration guide.

The bot needs the following environment variables:

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=advancedbans
MYSQL_PASSWORD=your_mysql_password_here
MYSQL_DB=advancedbans
```

### MySQL Permissions

The MySQL user specified in `.env` needs only these permissions:

```sql
GRANT SELECT ON advancedbans.* TO 'advancedbans'@'bot-host';
FLUSH PRIVILEGES;
```

No INSERT, UPDATE, DELETE, or DDL grants are needed. If the bot cannot
connect, check that:

- The MySQL host is reachable from the bot's network (not firewalled).
- The MySQL user is allowed to connect from the bot's IP (check the `host`
  portion of the MySQL user definition).
- The AdvancedBans plugin has created its tables on first run.

### Verifying the Connection

1. Start the bot. If it cannot connect to MySQL, it logs a warning but does
   not crash — the commands that query AdvancedBans will return a graceful
   error message.
2. Run `/checkbans <your-uuid>` in Discord. If the connection works and you
   have no active bans, you will see an embed saying "No active punishments."
3. From a MySQL client:
   ```sql
   SELECT * FROM punishments WHERE active = 1;
   ```

### Schema Changes

AdvancedBans is an actively developed plugin and may change its schema in
future updates. If the bot's queries stop returning data after an AdvancedBans
update:

1. Check `src/integrations/advancedbans.js` for the hardcoded column names.
2. Compare them against the actual table structure:
   ```sql
   DESCRIBE punishments;
   DESCRIBE player_aliases;
   ```
3. Update the column names in the query strings — no code structure changes
   are needed unless the table layout fundamentally changes.

---

## RCON (Server Commands)

**What it does:** The bot connects to the Minecraft server's RCON interface
to run commands: whitelist add/remove, listing online players, and
broadcasting messages.

### Enabling RCON on the Minecraft Server

Edit your server's `server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=your_rcon_password_here
broadcast-rcon-to-ops=false
```

Then restart the server.

### Environment Variable Mapping

| `.env` Variable | `server.properties` Key | Default     |
| --------------- | ----------------------- | ----------- |
| `RCON_HOST`     | — (network address)     | `127.0.0.1` |
| `RCON_PORT`     | `rcon.port`             | `25575`     |
| `RCON_PASSWORD` | `rcon.password`         | —           |

### Security Warning

**RCON is an unencrypted protocol.** Anyone who can reach the RCON port and
knows the password has full administrative control over the server. Follow
these rules:

- **Never expose RCON to the public internet.** Bind the Minecraft server to
  a private IP or use a firewall rule that only allows the bot's IP to
  connect on port 25575.
- **Use a strong, random password.** Do not reuse your server console password.
- **Run the bot on the same machine or the same private network** as the
  Minecraft server. If they must be on different networks, use a VPN
  (WireGuard, Tailscale) rather than opening the port.

### Testing RCON Without the Bot

```bash
# Install mcrcon (https://github.com/Tiiffi/mcrcon)
mcrcon -H 127.0.0.1 -P 25575 -p your_rcon_password_here "list"

# Expected output: "There are 0 of a max of 20 players online:"
```

### Commands the Bot Sends via RCON

| Bot Command                    | RCON Command                  | Notes                                           |
| ------------------------------ | ----------------------------- | ----------------------------------------------- |
| `/whitelist add <username>`    | `whitelist add <username>`    | Username validated: `/^[a-zA-Z0-9_]{1,16}$/`    |
| `/whitelist remove <username>` | `whitelist remove <username>` | Same validation                                 |
| `/status` (RCON path)          | `list`                        | Parses player count and online list from output |
| `/broadcast` (internal)        | `say <message>`               | Message truncated to 256 characters             |

---

## Mojang API (UUID Lookup)

**What it does:** Resolves Minecraft usernames to UUIDs for the `/register`
command and for player resolution in moderation commands. Also provides
the current player name (useful when a player has changed their name).

### How It Works

```
/register CoolBuilder123
    ↓
Mojang API: GET https://api.mojang.com/users/profiles/minecraft/CoolBuilder123
    ↓
Response: { "id": "abc123def456...", "name": "CoolBuilder123" }
    ↓
Stored in SQLite player_registry table
```

### Rate Limits

Mojang's API has a rate limit of approximately **600 requests per 10 minutes**
per IP address. The bot makes one request per `/register` or player-resolve
call, so this is rarely a problem for SMP-scale usage. If you hit the limit,
the bot logs a warning and returns an error to the user.

### What Happens When a Player Changes Their Username

If a player registered as `CoolBuilder123` and later changes their Minecraft
name to `ProMiner456`, the `/whois` command will return the old name stored
in the SQLite `player_registry` table (because the Mojang lookup is only
done at registration time). The UUID stored is still valid — UUIDs are
permanent — so all moderation lookups continue to work correctly.

To update the display name:

1. The player runs `/register` again with their new name. The `INSERT OR
REPLACE` query in `db/index.js` updates the row with the new username
   (and re-fetches the UUID, which will be the same).
2. Or a staff member runs `/register <discord_id> <new_name>` through the
   Discord UI and the player confirms the change.
