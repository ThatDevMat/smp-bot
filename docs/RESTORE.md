# Restore Procedure

This document explains how to restore the bot's SQLite database from a
compressed backup file.

---

## Prerequisites

- `gunzip` (usually pre-installed on Linux, available via `choco install gzip`
  on Windows or `brew install gzip` on macOS)
- `sqlite3` CLI (for verification)

---

## Restore Steps

### 1. Stop the bot

```bash
# If managed by PM2
pm2 stop minecraft-bot

# If running in the foreground, press Ctrl+C
```

**Important:** Confirm the bot is fully stopped before proceeding. Check
with `pm2 status` or verify the process is no longer running:

```bash
pm2 status minecraft-bot
# Should show "stopped" or no entry
```

### 2. Locate the backup file

Backups are stored in the `backups/` directory at the project root.
Choose the backup you want to restore:

```bash
ls -lh backups/backup-*.db.gz
```

### 3. Decompress the backup

```bash
gunzip backups/backup-2026-01-15T03-00-00.db.gz
```

This produces a file named `backup-2026-01-15T03-00-00.db`.

### 4. Replace the live database

```bash
# Backup the current database first (just in case)
cp smp-bot.db smp-bot.db.before-restore

# Replace with the decompressed backup
cp backups/backup-2026-01-15T03-00-00.db smp-bot.db
```

### 5. Verify the file is readable

```bash
sqlite3 smp-bot.db ".tables"
```

You should see the bot's tables listed:

```
events   player_registry   warnings   pois   seasons   rsvps
```

### 6. Restart the bot

```bash
pm2 restart minecraft-bot
pm2 save
```

### 7. Verify the bot is working

Check the logs for a successful startup:

```bash
pm2 logs minecraft-bot --lines 20
```

Then run `/status` or `/event list` in Discord to confirm data is present.

---

## Safety Warnings

- **Always stop the bot before replacing the database file.** Writing to
  the database while the bot is running can cause corruption.
- **Make a copy of the current database before overwriting** (step 4 above).
  This gives you a fallback if the restored backup is older than expected.
- **Do not delete backup files** after restoring — keep at least one recent
  backup in case the restored data has issues.
- If the restored database is from a much older backup, events that were
  created after that backup will be lost. Consider using `/event list` and
  `/poi list` to check what data is present after restoring.
