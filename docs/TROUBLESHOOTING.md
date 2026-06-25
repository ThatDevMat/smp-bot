# Troubleshooting

A collection of problems you are likely to hit, why they happen, and how to
fix them. If your issue is not listed here, see "Still Stuck?" at the bottom.

---

**Problem:** Bot starts but slash commands do not appear in Discord

**Likely cause:** The commands were never registered, or they were registered
for a different guild.

**Fix:**

1. Check that `CLIENT_ID` and `GUILD_ID` are set correctly in `.env`.
2. Run `node deploy-commands.js` and watch for errors. You should see:
   ```
   [Deploy] Successfully registered 12 commands:
     - /status
     - /event
     ...
   ```
3. If it succeeds but commands still do not appear, wait up to 5 minutes.
   Discord caches command registrations.
4. If they still do not appear after 5 minutes, verify the bot has the
   `applications.commands` scope enabled in your Discord application's
   OAuth2 settings. Re-invite the bot with the correct scopes.

---

**Problem:** Bot crashes immediately on startup

**Likely cause:** A required environment variable is missing or invalid.

**Fix:**

1. The error will tell you which variables are missing. Typically:
   ```
   Missing required environment variables: BOT_TOKEN, CLIENT_ID, GUILD_ID
   ```
2. Copy `.env.example` to `.env` (if you have not already) and fill in every
   value.
3. Restart the bot.

---

**Problem:** DiscordSRV webhooks are not being received by the bot

**Likely cause:** Network issue, missing `x-webhook-secret`, or the bot's
webhook port is not reachable from the Minecraft server.

**Fix:**

1. Test the endpoint directly with curl from the Minecraft server's machine:
   ```bash
   curl -X POST http://bot-host:3000/health
   ```
   If this fails, the bot is not reachable. Check firewalls and that the bot
   is running.
2. If the health check works but webhooks return 401, check that the
   `WEBHOOK_SECRET` in `.env` matches the `WebChatChannelWebhookSecret` in
   DiscordSRV's `config.yml`.
3. Check the bot's console output for webhook errors:
   ```
   [Webhook] Channel "serverLog" not configured — skipping message.
   ```
   If you see this, set `CHANNEL_SERVER_LOG` in `.env`.

---

**Problem:** `/checkbans` returns no data even though punishments exist in AdvancedBans

**Likely cause:** The AdvancedBans MySQL table name or column names differ
from what the bot expects.

**Fix:**

1. Connect to MySQL directly and check the schema:
   ```sql
   DESCRIBE advancedbans.punishments;
   ```
2. Compare the column names with the queries in
   `src/integrations/advancedbans.js`. The queries hardcode column names like
   `uuid`, `type`, `reason`, `executor`, `start`, `end`, `active`.
3. If the column names differ, update the query strings. If the table name
   itself differs (some server operators rename it), update the `FROM`
   clause.
4. Also check the MySQL user has `SELECT` permission on the table. The bot's
   MySQL user needs at minimum:
   ```sql
   GRANT SELECT ON advancedbans.* TO 'advancedbans'@'bot-host';
   ```

---

**Problem:** RCON connection times out

**Likely cause:** RCON is not enabled, the port is wrong, or a firewall is
blocking the connection.

**Fix:**

1. Verify RCON is enabled on the Minecraft server:
   ```bash
   grep 'enable-rcon' server.properties
   # Should output: enable-rcon=true
   ```
2. Confirm the bot's `RCON_HOST`, `RCON_PORT`, and `RCON_PASSWORD` match
   the server's `server.properties`.
3. Test the connection from the bot's machine using `mcrcon`:
   ```bash
   mcrcon -H RCON_HOST -P RCON_PORT -p RCON_PASSWORD "list"
   ```
4. If the CLI tool also times out, check firewalls. RCON uses TCP — port
   25575 must be open between the bot and the Minecraft server.
5. If using Docker, ensure containers are on the same Docker network or that
   `--network host` is used.

---

**Problem:** Mojang API returns 429 (rate limited)

**Likely cause:** Too many requests in a short window. The limit is roughly
600 requests per 10 minutes per IP. The bot now caches UUID lookups for
1 hour, so repeated lookups for the same username will not hit the API.

**Fix:**

1. Wait 10 minutes. The bot will retry on the next command invocation.
2. Use `/cache stats` to check how many UUID entries are currently cached
   and how many API calls have been saved (hits vs misses).
3. If the cache is empty (e.g. after a restart), the first few lookups
   after restart will hit the API. This is normal.
4. For `/register` specifically: if a user gets a rate-limit error, wait
   a few minutes and try again. The 1-hour cache means subsequent
   `/whois` or moderation lookups for the same username will be served
   from cache without hitting the API.

---

**Problem:** Jest tests pass locally but fail in GitHub Actions

**Likely cause:** Platform-specific behaviour (typically line endings,
date formatting, or locale differences).

**Fix:**

1. Look at the failing test's snapshot or assertion in the CI logs. Common
   culprits:
   - **Windows line endings (CRLF):** The CI runner is Linux. If a snapshot
     was generated on Windows, it may include `\r\n`. Regenerate snapshots
     with `npx jest --updateSnapshot`.
   - **Timezone-dependent tests:** If you hardcoded a timezone-aware date,
     CI may use UTC while your local machine uses a different TZ. Use
     `jest.useFakeTimers()` with a fixed timestamp in tests that assert dates.
2. Run the tests locally with the CI environment:
   ```bash
   npm test -- --ci
   TZ=UTC npm test
   ```

---

**Problem:** PM2 process shows status "errored" after deployment

**Likely cause:** The bot crashed on startup and PM2 failed to restart it
within the retry limit. This usually means a missing dependency or an
invalid `.env` file on the server.

**Fix:**

1. SSH into the server and check the logs:
   ```bash
   pm2 logs minecraft-bot --lines 50
   ```
2. Common errors:
   - `Error: Cannot find module 'better-sqlite3'` → run `npm ci --omit=dev`
     on the server. The module is a native addon and must be compiled on the
     target machine.
   - `Missing required environment variables: BOT_TOKEN` → check that
     `.env` exists and is populated on the server. PM2 does not inherit the
     shell's environment — it reads `.env` if you use `ecosystem.config.js`
     with the env block, but the current config expects the .env file to be
     loaded by dotenv. Verify `.env` is present.
3. After fixing, restart:
   ```bash
   pm2 restart minecraft-bot && pm2 save
   ```

---

**Problem:** Coverage drops below 80 % after adding a new command

**Likely cause:** The new command's code paths are not fully tested.

**Fix:**

1. Run `npm run test:coverage` and scroll to the per-file table at the end.
   The files below the threshold are listed with their uncovered line numbers.
2. Focus on the **branch** column first — uncovered `if/else` branches are
   usually the quickest to cover.
3. Write tests for the uncovered lines. The test file pattern is already set
   up — add your tests under `tests/commands/` for command handlers,
   `tests/db/` for database helpers, etc.
4. Re-run `npm run test:coverage` to confirm the threshold is met.

---

**Problem:** A slash command works in one Discord server but not another

**Likely cause:** The bot is in multiple servers but `GUILD_ID` in `.env`
only points to one of them. Commands are registered as guild commands (not
global), so they only exist in the guild specified by `GUILD_ID`.

**Fix:**

1. If you want the bot to work in multiple servers, you have two options:
   - Change `deploy-commands.js` to use `Routes.applicationCommands(clientId)`
     (global commands) instead of `Routes.applicationGuildCommands(...)`.
     Global commands take up to an hour to propagate.
   - Or run a separate instance of the bot for each server with a different
     `.env`.
2. If you only intend to use one server, verify `GUILD_ID` is correct.

---

**Problem:** SQLite database file is missing or corrupted on startup

**Likely cause:** The database file (`smp-bot.db`) was deleted, or the bot
crashed during a write operation.

**Fix:**

1. If the file is missing, just restart the bot. It will create a fresh
   database and run the schema initialisation. **Warning:** all existing
   events, registrations, warnings, POIs, and season data will be lost.
   If this is a production instance, restore from backup.
2. If the file is corrupted (the bot logs `Error: SQLITE_CORRUPT`), stop
   the bot, delete the file, and restart. Data loss is the same as above.
   To prevent corruption, ensure the bot is always stopped cleanly (use
   `pm2 stop minecraft-bot` or send SIGINT/SIGTERM — never kill -9 unless
   necessary).

---

**Problem:** A player's Minecraft username changed and `/whois` returns stale data

**Likely cause:** The player registry stores the username that was current
at the time of `/register`. It does not auto-update when a player changes
their name on Mojang's side.

**Fix:**

1. Tell the player to run `/register` again with their new username. The
   `INSERT OR REPLACE` query updates the stored name.
2. Or a staff member runs the command on the player's behalf using the
   Discord ID lookup. The UUID remains the same, so all moderation
   references are unaffected.

---

---
**Problem:** Log files are growing too large

**Likely cause:** `LOG_LEVEL` is set to `debug` in a production environment,
causing every HTTP request and debug message to be written to disk.

**Fix:**
1. Set `LOG_LEVEL=info` in the production `.env` file.
2. The rotating file transport automatically deletes logs older than 14 days
   and gzips rotated files. If disk space is still tight, check that no
   external process is reading/writing the log files while the bot is running.
3. To verify current log sizes on the server:
   ```bash
   du -sh logs/
   ls -la logs/
   ```

---

**Problem:** `backups/` is filling up disk space

**Likely cause:** `BACKUP_RETAIN_DAILY` or `BACKUP_RETAIN_WEEKLY` set too
high, or pruning failed silently (e.g. the bot lost write permission to the
`backups/` directory).

**Fix:**
1. Check the bot logs for pruning errors:
   ```bash
   grep -i 'prune\|backup' logs/combined-*.log
   ```
2. Manually remove old `.db.gz` files from the `backups/` directory if disk
   space is urgently needed:
   ```bash
   ls -lh backups/
   rm backups/backup-OLDEST-FILES-HERE.db.gz
   ```
3. Ensure the bot has write permission to the `backups/` directory:
   ```bash
   chmod -R 755 backups/
   ```
4. Reduce retention in `.env`:
   ```
   BACKUP_RETAIN_DAILY=14
   BACKUP_RETAIN_WEEKLY=2
   ```
5. Restart the bot for new retention settings to take effect.

---

## Still Stuck?

If none of the above solves your problem:

1. **Check PM2 logs** (production server):
   ```bash
   pm2 logs minecraft-bot --lines 100
   ```
2. **Check the GitHub Actions run logs** — open the Actions tab in the repo
   and click the latest failed run. Every step's output is visible.
3. **Check raw Discord API responses** by running the command with
   `NODE_ENV=development` — the bot logs more detail in dev mode.
4. **Open a well-formed bug report.** Use the bug report template at
   `.github/ISSUE_TEMPLATE/bug_report.md`. Include:
   - What you did
   - What you expected to happen
   - What actually happened (paste the full error)
   - Environment details (Node version, OS, commit SHA)
