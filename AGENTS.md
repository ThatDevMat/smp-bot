# AGENTS.md — AI Contributor Guide

This file is written for AI coding agents working on this codebase. It tells
you exactly how to contribute without breaking things, without asking
unnecessary questions, and without violating the project's conventions.

---

## 1. Project Summary

You are working on a Discord bot that manages a Minecraft SMP server. It
relays in-game chat via DiscordSRV webhooks, manages whitelists via RCON,
reads punishment data from an AdvancedBans MySQL database, and maintains its
own state (events, player registrations, warnings, POIs, seasons) in a local
SQLite file. The tech stack is Node.js 20+, discord.js v14, Express.js,
better-sqlite3, mysql2, and rcon-client.

---

## 2. Repository Map

| Path                                    | Purpose                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/commands/`                         | 13 slash command handlers, one file per command                                                     |
| `src/events/`                           | discord.js lifecycle event handlers (ready.js, interactionCreate.js)                                |
| `src/webhooks/`                         | Express router for the DiscordSRV webhook receiver                                                  |
| `src/db/`                               | SQLite schema initialisation and all query helpers                                                  |
| `src/integrations/`                     | Wrappers for RCON, AdvancedBans MySQL, Mojang API, mcsrvstat.us                                     |
| `src/utils/`                            | Embed builders, permission checks, player UUID resolution, logger, backup, cache, shutdown handlers |
| **`src/schemas/`**                      | **Zod validation schemas for all command inputs and webhook payloads**                              |
| `src/config.js`                         | dotenv config loader with `validateConfig()`                                                        |
| `src/index.js`                          | Entry point — boot sequence, never excluded from lint                                               |
| `tests/`                                | Jest test files mirroring `src/` structure                                                          |
| `tests/setup.js`                        | Shared test factories and mocks                                                                     |
| `.github/dependabot.yml`                | Dependabot config for npm and GitHub Actions dependency updates                                     |
| `.github/labeler.yml`                   | Path-based PR auto-label rules (used by pr-labeler.yml)                                             |
| `.github/release-drafter.yml`           | Release notes template grouped by `type:*` labels                                                   |
| `.github/workflows/ci.yml`              | CI pipeline (lint → test + security audit + Docker build validation)                                |
| `.github/workflows/codeql.yml`          | CodeQL security analysis (on push/PR + weekly schedule)                                             |
| `.github/workflows/deploy.yml`          | Deploy pipeline (SSH + pm2, runs after CI passes on main)                                           |
| `.github/workflows/pr-labeler.yml`      | Auto-labels PRs by changed file paths using .github/labeler.yml                                     |
| `.github/workflows/pr-title-lint.yml`   | Validates PR titles use conventional commits format, auto-adds `type:*` label                       |
| `.github/workflows/release-drafter.yml` | Auto-drafts GitHub releases from merged PRs, grouped by label                                       |
| `.github/PULL_REQUEST_TEMPLATE.md`      | PR checklist template                                                                               |
| `.github/ISSUE_TEMPLATE/`               | Bug report and feature request templates                                                            |
| `docker/`                               | Docker Compose setup: MySQL init script, mock DiscordSRV webhook service                            |
| `Dockerfile`                            | Multi-stage Dockerfile (deps, dev, production)                                                      |
| `docker-compose.yml`                    | Production Compose file (bot + MySQL with healthcheck)                                              |
| `.dockerignore`                         | Excludes node_modules, .env, coverage, logs, backups from Docker build                              |
| `docs/`                                 | Onboarding, architecture, contributing, integrations, troubleshooting, restore guide                |
| `backups/`                              | Automated SQLite backup files (gitignored — managed by the backup scheduler)                        |
| `jest.config.js`                        | Jest config with 80% coverage threshold                                                             |
| `ecosystem.config.js`                   | PM2 process manager config                                                                          |
| `.eslintrc.json`                        | ESLint rules                                                                                        |
| `.prettierrc`                           | Prettier formatting configuration                                                                   |
| `.env.example`                          | Template for all required environment variables                                                     |
| `deploy-commands.js`                    | Script to register slash commands with the Discord REST API                                         |

### Files and directories you must NEVER modify without explicit instruction

- **`.env`** and any file containing real secrets — these are gitignored and
  never committed. If you need to add a new env var, update `.env.example`
  only.
- **`package-lock.json`** — never edit by hand. Let npm manage it.
- **The AdvancedBans MySQL schema** — external system, read-only. The bot
  only queries it; never suggest altering it.
- **`backups/`** — automated backup output, gitignored. Do not delete or
  modify files here manually — they are managed by the backup scheduler.
- **`coverage/`** — generated output, gitignored. Delete and regenerate with
  `npm run test:coverage`.
- **`logs/`** — runtime output, gitignored. Never reference these files in
  source code.
- **`type:*` labels** (e.g. `type:feature`, `type:bug`) — auto-managed by
  the PR title lint workflow. Do not rename, delete, or reassign these
  manually. If you add a new conventional commit type, update the type list
  in `pr-title-lint.yml`, the colours map in the same file, the label match
  lists in `release-drafter.yml`, and the version-resolver mapping — keeping
  all three files in sync is required.

---

## 3. Architecture Rules

These boundaries must never be violated:

- **Business logic belongs in service modules (`src/utils/`, `src/db/`,
  `src/integrations/`), not in command handlers.**
  _Violation:_ calling `db.prepare()` inside a command's `execute()` function
  instead of using the exported helper from `src/db/index.js`.

- **All database queries belong in `src/db/` only.**
  _Violation:_ writing a raw SQL query inside a command file or utility.

- **All external HTTP calls belong in `src/integrations/` only.**
  _Violation:_ calling `fetch()` inside a command file or an embed builder.

- **Discord interaction replies belong in command handlers only.**
  _Violation:_ calling `interaction.reply()` from a service module or
  database helper.

- **No secret or credential may appear in source code.**
  _Violation:_ hardcoding a token, password, or IP address in any `.js` file.
  Every secret comes from `process.env` through `src/config.js`.

- **Embeds must be built using the shared utility functions in
  `src/utils/embeds.js`.**
  _Violation:_ constructing `new EmbedBuilder()` directly inside a command.
  Every embed shape has a dedicated builder function — use it.

- **Never call node-cache directly — always use the typed helpers in
  `src/utils/cache.js`.**
  _Violation:_ calling `cache.get()` or `cache.set()` outside of
  `src/utils/cache.js`. Use `getCachedUUID`, `setCachedUUID`,
  `invalidateUUIDCache`, `getCachedServerStatus`, or `setCachedServerStatus`
  instead.

- **All user input and webhook payload validation must go through
  `src/utils/validate.js` using a schema from `src/scheams/`.**
  _Violation:_ calling `interaction.options.getString()` and using the raw
  value without first validating it through `validateInput()` and a Zod
  schema. Every command must extract its raw options into a plain object,
  pass it through `validateInput()`, and use the typed result.

---

## 4. Commands Reference

| Command      | File                        | Staff Only                   | Description                                                          | Dependencies                                   |
| ------------ | --------------------------- | ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| `/backup`    | `src/commands/backup.js`    | Yes                          | Triggers an immediate SQLite database backup                         | SQLite (backup API), filesystem                |
| `/cache`     | `src/commands/cache.js`     | Flush: Yes; Stats: No        | View cache statistics or flush the in-memory API cache               | node-cache                                     |
| `/status`    | `src/commands/status.js`    | No                           | Shows server online status, player count, list of online players     | RCON (primary), mcsrvstat.us (fallback)        |
| `/event`     | `src/commands/event.js`     | Create/Cancel: Yes; List: No | Create, list, and cancel scheduled events with RSVP                  | SQLite (`events`, `rsvps`)                     |
| `/register`  | `src/commands/register.js`  | No                           | Links a Discord user to a Minecraft username/UUID                    | Mojang API, SQLite (`player_registry`)         |
| `/whois`     | `src/commands/whois.js`     | No                           | Looks up a Discord user's registered Minecraft account               | SQLite (`player_registry`)                     |
| `/whitelist` | `src/commands/whitelist.js` | Yes                          | Adds or removes a player from the server whitelist                   | RCON                                           |
| `/checkbans` | `src/commands/checkbans.js` | Yes                          | Queries active bans for a player from AdvancedBans                   | AdvancedBans MySQL (`punishments`), Mojang API |
| `/history`   | `src/commands/history.js`   | Yes                          | Full punishment history for a player from AdvancedBans               | AdvancedBans MySQL (`punishments`), Mojang API |
| `/warn`      | `src/commands/warn.js`      | Yes                          | Issues a local warning stored in SQLite, DMs the linked Discord user | SQLite (`warnings`, `player_registry`)         |
| `/warnings`  | `src/commands/warnings.js`  | Yes                          | Views local warning history for a player                             | SQLite (`warnings`)                            |
| `/poi`       | `src/commands/poi.js`       | Add/List: No; Remove: Yes    | Register, list, or remove points of interest                         | SQLite (`pois`)                                |
| `/season`    | `src/commands/season.js`    | Set: Yes; Info: No           | View or update current SMP season info                               | SQLite (`seasons`)                             |
| `/poll`      | `src/commands/poll.js`      | No                           | Creates a reaction-based poll                                        | None (pure Discord)                            |

### Every command file must follow this exact pattern:

```js
const { SlashCommandBuilder } = require('discord.js');
const { requireStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('command-name')
    .setDescription('Description'),

  async execute(interaction) {
    // 1. Permission check (if staff-only)
    // 2. Parse options from interaction
    // 3. Call service / db / integration functions
    // 4. Build embed via src/utils/embeds.js
    // 5. Reply to interaction
  },
};
```

Any new command must also be added to `deploy-commands.js` (it auto-discovers
files in `src/commands/`, so no import change is needed — just verify the
file exists and exports `data`). Every new command must have corresponding
unit tests before the PR is opened.

### Adding a new slash command checklist — validation

When adding a new slash command, in addition to the checklist in
`docs/CONTRIBUTING.md`:

1. **Define a Zod schema** in the appropriate `src/schemas/` file for all
   command inputs **before** writing the `execute()` function.
2. **Validate at the very start** of `execute()` — extract raw options into
   a plain object, pass it through `validateInput()`, and use the validated
   data for the rest of the function.
3. **Never access `interaction.options` values** that form command input
   without first validating them through a schema. Meta-options like
   `getSubcommand()` are exempt — only actual user input must be validated.
4. **Add test cases** for both valid and invalid input — invalid input must
   produce an ephemeral error reply and not execute any business logic.

---

## 5. Environment Variables

| Variable                 | What It Maps To                                               | Required | Consumed By                               |
| ------------------------ | ------------------------------------------------------------- | -------- | ----------------------------------------- |
| `BOT_TOKEN`              | Discord bot secret token                                      | Yes      | `config.js` → `discord.js` REST + Gateway |
| `CLIENT_ID`              | Discord application client ID                                 | Yes      | `deploy-commands.js`                      |
| `GUILD_ID`               | Discord server (guild) ID                                     | Yes      | `deploy-commands.js`, slash command scope |
| `RCON_HOST`              | Minecraft server RCON hostname                                | No       | `src/integrations/rcon.js`                |
| `RCON_PORT`              | RCON port (default 25575)                                     | No       | `src/integrations/rcon.js`                |
| `RCON_PASSWORD`          | RCON password                                                 | No       | `src/integrations/rcon.js`                |
| `MYSQL_HOST`             | AdvancedBans MySQL host                                       | No       | `src/integrations/advancedbans.js`        |
| `MYSQL_PORT`             | AdvancedBans MySQL port (default 3306)                        | No       | `src/integrations/advancedbans.js`        |
| `MYSQL_USER`             | AdvancedBans MySQL username                                   | No       | `src/integrations/advancedbans.js`        |
| `MYSQL_PASSWORD`         | AdvancedBans MySQL password                                   | No       | `src/integrations/advancedbans.js`        |
| `MYSQL_DB`               | AdvancedBans MySQL database name                              | No       | `src/integrations/advancedbans.js`        |
| `WEBHOOK_PORT`           | Port for the Express DiscordSRV webhook server (default 3000) | No       | `src/webhooks/discordsrv.js`              |
| `WEBHOOK_SECRET`         | Shared secret for DiscordSRV webhook auth                     | No       | `src/webhooks/discordsrv.js`              |
| `CHANNEL_MINECRAFT_CHAT` | Discord channel ID for in-game chat relay                     | No       | `src/webhooks/discordsrv.js`              |
| `CHANNEL_SERVER_LOG`     | Discord channel ID for join/leave/death/advancement logs      | No       | `src/webhooks/discordsrv.js`              |
| `CHANNEL_SERVER_STATUS`  | Discord channel ID for server start/stop events               | No       | `src/webhooks/discordsrv.js`              |
| `CHANNEL_EVENTS`         | Discord channel ID for event announcements                    | No       | `src/commands/event.js`                   |
| `CHANNEL_POLLS`          | Discord channel ID for poll embeds                            | No       | `src/commands/poll.js`                    |
| `STAFF_ROLE_IDS`         | Comma-separated staff Discord role IDs                        | No       | `src/utils/permissions.js`                |

If you add a new environment variable you must:

1. Add it to `.env.example` with a descriptive comment and a placeholder value
2. Add it to the environment variables table in `docs/ONBOARDING.md`
3. Add it to the environment variables table in `README.md`

Never use a hardcoded fallback for a required variable — throw a clear
startup error via `validateConfig()` in `src/config.js` instead.

---

## 6. Database Reference

### SQLite (local data — file: `smp-bot.db`)

The database is managed entirely by `src/db/index.js`. Every table is created
in `initSchema()` and queries go through exported helper functions. Direct
`db.prepare()` calls are forbidden outside of `src/db/index.js`.

| Table             | Columns                                                                                                      | Purpose                                   | Owned By                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------- |
| `events`          | `id`, `name`, `description`, `event_date`, `event_time`, `timezone`, `created_by`, `created_at`, `cancelled` | Scheduled SMP events                      | `src/commands/event.js` (via `src/db/`)                                     |
| `player_registry` | `discord_id` (PK), `minecraft_username`, `minecraft_uuid`, `registered_at`                                   | Links Discord users to Minecraft accounts | `src/commands/register.js`, `src/commands/whois.js`, `src/commands/warn.js` |
| `warnings`        | `id`, `player_uuid`, `discord_id`, `reason`, `issued_by`, `issued_at`                                        | Local Discord-side warnings               | `src/commands/warn.js`, `src/commands/warnings.js`                          |
| `pois`            | `id`, `name` (UNIQUE), `x`, `y`, `z`, `dimension`, `description`, `created_by`, `created_at`                 | Points of interest                        | `src/commands/poi.js`                                                       |
| `seasons`         | `id`, `season_number` (UNIQUE), `start_date`, `seed`, `created_at`                                           | SMP season tracking                       | `src/commands/season.js`                                                    |
| `rsvps`           | `event_id` (FK → events.id), `discord_id` (PK compound), `responded_at`                                      | Event RSVPs                               | `src/commands/event.js`                                                     |

### AdvancedBans MySQL (read-only — never write to these)

The bot queries two tables in the AdvancedBans MySQL database. **You must
never write to, drop, or alter these tables under any circumstance.**

| Table            | Columns Used                                                   | Purpose                       |
| ---------------- | -------------------------------------------------------------- | ----------------------------- |
| `punishments`    | `uuid`, `type`, `reason`, `executor`, `start`, `end`, `active` | All bans, mutes, and warnings |
| `player_aliases` | `uuid`, `name`, `lastSeen`                                     | Username-to-UUID resolution   |

The table and column names are hardcoded in `src/integrations/advancedbans.js`.
If the AdvancedBans plugin updates its schema, these query strings must be
updated to match. The MySQL connection uses a connection pool defined in the
same file.

### Migration Policy

Any schema change to the SQLite tables must:

- Be made in `src/db/index.js` inside the `initSchema()` function
- Use `CREATE TABLE IF NOT EXISTS` for new tables so existing databases are
  not overwritten
- Be backward compatible where possible (add nullable columns rather than
  requiring a migration script)
- Include a comment explaining why the change was made
- Never silently drop or rename a column without updating every query helper
  that references it

---

## 7. Testing Requirements

These rules are non-negotiable:

- **Every new feature must include unit tests** before the task is complete.
  Writing code without tests is an incomplete task.
- **Every bug fix must include a test** that reproduces the bug before the
  fix and passes after.
- **The coverage threshold is 80 %** across statements, branches, functions,
  and lines. If your changes cause coverage to drop below this, add tests
  until it is restored. Do not modify the threshold in `jest.config.js`.
- **Never mock the module under test** — only mock its dependencies.
- **Never delete or skip existing tests** to make coverage pass.
- **Run `npm test -- --coverage` after every change** and confirm it passes
  before considering a task done.

### Established mock patterns in `tests/setup.js`

Reuse these — do not reinvent them:

- **Mock interaction factory:** `createMockInteraction({ isStaff: true })`
  returns a full interaction stub with `reply`, `editReply`, `deferReply`,
  `followUp`, option getters, and embed payload capture (`_lastEmbeds`,
  `_lastContent`). Set option values via `interaction.options._setOption()`.
- **Express request/response stubs:** `createMockReq()` and `createMockRes()`
  for testing the webhook handler without binding a port.
- **Embed assertion helpers:** `parseEmbed(embed)` extracts title,
  description, color, fields, footer; `findField(embed, name)` finds a field
  by name for targeted assertions.
- **SQLite mock pattern:** Mock modules that import `better-sqlite3` by
  providing a `prepare → run/get/all` chain. See `tests/db/index.test.js`.
- **MySQL pool mock pattern:** Mock `mysql2/promise` so `createPool` returns
  a pool with a `query` jest.fn() that resolves to `[[rows], []]`.
- **RCON client mock pattern:** Mock `rcon-client` so `Rcon.connect` returns
  a client stub with a `send` jest.fn().
- **Mojang API fixture data:** The Mojang integration uses Node's built-in
  `https` module — mock `https.get` to emit fake response data.

---

## 8. Code Style Rules

- 2-space indentation
- Single quotes for all strings
- Semicolons required
- Trailing commas in multi-line objects and arrays
- Maximum function length: ~30 lines. If a function exceeds this, split it.
- Early returns and guard clauses over nested conditionals
- Named constants for all magic values (e.g. `COLOR.GREEN` in `embeds.js`)
- No `console.log()` in production code paths — use `console.warn()` or
  `console.error()` for operational messages
- Async/await only — no raw Promise chains (except in integration wrappers
  that use `new Promise`)
- Descriptive variable and function names — no single-letter names outside
  of loop indices (`i`, `j` are acceptable there)
- Never use `console.log`, `console.warn`, or `console.error`. Always import
  and use the shared logger from `src/utils/logger.js`.

ESLint and Prettier are enforced in CI. Run `npm run lint` before completing
any task — it must produce zero errors.

---

## 9. Security Checklist

Before completing any task that touches these areas, verify each item:

### Any staff-only command

- [ ] Role permission check is the first thing executed in the handler, using
      `requireStaff()` from `src/utils/permissions.js`
- [ ] Permission check uses the shared utility — not a one-off role ID
      comparison in the command file
- [ ] Lack of permission results in an ephemeral reply only — no further
      code executes

### Any code that accepts user input

- [ ] Input used in a database query is passed as a parameter, never
      interpolated into the SQL string
- [ ] Input used in an RCON command is sanitised through
      `sanitiseUsername()` in `src/integrations/rcon.js` before being sent
- [ ] Input used to look up a player validates format (username length,
      allowed characters) before hitting an external API

### Any new webhook endpoint

- [ ] Shared secret is validated as the very first step (see
      `src/webhooks/discordsrv.js` for the pattern)
- [ ] Payload shape is validated before any field is accessed
- [ ] A 401 is returned for unauthorized requests, 400 for malformed payloads

### Any new environment variable containing a secret

- [ ] Only read via `process.env` — never passed as a function argument that
      could be accidentally logged

---

## 10. CI/CD Awareness

Two GitHub Actions workflows run against changes you make:

### `ci.yml` (every push and PR)

Three jobs, must all pass for a PR to be mergeable:

1. **lint** — Runs ESLint and Prettier check. Fastest job; fails early if
   formatting or code quality is broken.
2. **test** (needs: lint) — Runs Jest with `--coverage --ci`. Coverage must
   meet the 80% threshold. On PRs, posts a coverage summary comment.
3. **security-audit** (needs: lint, parallel with test) — Runs
   `npm audit --audit-level=high --omit=dev`. Blocks if any high or critical
   vulnerability exists in production dependencies.

### `deploy.yml` (CI completion on `main` only)

- Deploys via SSH using `appleboy/ssh-action@v1`
- Runs `git pull`, `npm ci --omit=dev`, `pm2 restart minecraft-bot`,
  `pm2 save` on the server
- Waits up to 15 seconds for the PM2 process to report `online` status
- On failure, posts a notification embed to the `DISCORD_DEPLOY_WEBHOOK`
  Discord webhook

**Do not modify workflow files** unless the task explicitly requires it. If
you must change a workflow, explain the reason in the commit message.

---

## 11. Commit Conventions

All commits must follow **Conventional Commits** format:

```
type(scope): short description

body (optional — explain the why, not the what)

BREAKING CHANGE: description (if applicable)
```

### Valid types

`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `ci`

### Scope

Use the area of the codebase: `commands`, `db`, `webhooks`, `integrations`,
`utils`, `ci`. Omit scope if the change touches multiple areas.

### Rules

- One logical change per commit — do not bundle unrelated changes
- The commit message subject must complete the sentence:
  "If applied, this commit will ..."
- Never commit directly to `main`
- Never commit `.env`, `node_modules/`, `coverage/`, or `logs/`
- If a task spans multiple files, commit in logical stages rather than one
  giant commit

### Example commit messages from this project

```
feat(commands): add slash command for whitelist add/remove
test: add unit test suite with 80% coverage threshold
ci: add GitHub Actions lint, test, and deploy pipeline
refactor(commands): centralise player UUID resolution
chore: code review — clean code, security, and consistency pass
```

---

## 12. Interaction Patterns

### Adding a new slash command

Follow the checklist in `docs/CONTRIBUTING.md` exactly. Do not skip the
tests or the `deploy-commands.js` registration step.

### Modifying a database table

1. Update the schema in `initSchema()` inside `src/db/index.js`
2. Update all affected query helpers in `src/db/index.js`
3. Update the database reference in this file (section 6) and in
   `docs/ARCHITECTURE.md`
4. Add or update tests for the changed queries

### Adding a new npm package

- Prefer packages already in use before adding new ones
- Do not add a package that duplicates functionality already provided by an
  existing dependency
- Run `npm install <pkg>` for production deps, `npm install -D <pkg>` for
  dev deps
- Briefly justify the addition in the commit message

### Changing a shared utility

Any change to `src/utils/` potentially affects every command and webhook
handler. Run the full test suite after any utility change, not just the
tests for the utility itself.

### Fixing a bug

Write a failing test that reproduces the bug first. Then fix the code.
Confirm the test passes. Commit the test and the fix together.

### When uncertain about intended behaviour

Check `docs/ARCHITECTURE.md` for design decisions before making assumptions.
If the answer is not there, state your assumption explicitly in a comment in
the code and flag it in the PR description. Do not silently guess.

---

## 13. Pull Request Workflow

All changes to this repository must go through a pull request workflow.
Never push directly to `master` (or `main`). The CI/CD pipelines and
release drafter depend on PRs to run checks, assign labels, and track
history for release notes.

### Standard workflow

1. **Create a feature branch** from the latest `master`

   ```bash
   git checkout master && git pull
   git checkout -b feat/my-feature-description
   ```

2. **Work on the branch** — commit in logical atomic steps using
   conventional commit messages (see §11).

3. **Push the branch**:

   ```bash
   git push -u origin feat/my-feature-description
   ```

4. **Create a pull request** — title must follow conventional commit
   format so `pr-title-lint.yml` can validate it and assign the correct
   `type:*` label. Include a description covering what, why, and any
   testing done.

5. **Let CI run** — the `ci.yml` workflow (ESLint, Prettier, Jest,
   Docker build) must pass before merging. CodeQL runs alongside.
   The PR labeler will auto-apply `area:*` labels based on changed
   files, and `pr-title-lint.yml` will add the `type:*` label.

6. **Merge via Squash merge** — squash your branch commits into a
   single conventional commit message on `master`. This keeps the
   mainline history clean and ensures the release drafter picks up
   the PR correctly.

### Exceptions

Only direct-push to `master` without a PR for:

- CI/CD workflow changes that need to be tested on `master` itself
  (e.g. fixing a broken CI pipeline). Even then, prefer a PR from
  a branch if the fix is non-trivial.

### PR checklist

Before creating a PR, confirm:

- [ ] Tests pass locally (`npm test`)
- [ ] Prettier formatting passes (`npx prettier --check .`)
- [ ] ESLint reports zero errors (`npm run lint`)
- [ ] Conventional commit title is used for the PR (not just the
      individual commits)
- [ ] Any new env vars have been added to `.env.example`
- [ ] AGENTS.md is updated if the repo structure, commands, or
      conventions changed

---

## 14. Out of Scope

Do not do any of the following unless a human explicitly overrides the
instruction in the current task:

- Upgrade major versions of any dependency
- Change the database engine (SQLite or MySQL)
- Add a new Discord.js event handler without a corresponding test
- Expose any new public HTTP endpoint without webhook secret validation
- Remove or weaken any existing permission check
- Modify AGENTS.md itself — this file is maintained by the human team
- Change the Jest coverage threshold in `jest.config.js`
- Alter the PM2 ecosystem config without confirming the production
  deployment impact
- Add a second logger instance — always import `src/utils/logger.js`
- Delete or modify files in `backups/` — these are managed automatically by
  the backup scheduler
- **Modify `docker/mysql/init.sql`**'s table structure — it must match the
  real AdvancedBans schema. If AdvancedBans updates its schema, update both
  `init.sql` and `src/integrations/advancedbans.js` together.

---

## Maintenance Notes

The following sections of this file will need updating as the project grows:

- **Section 4 (Commands Reference):** Add a row for every new slash command.
- **Section 5 (Environment Variables):** Add a row for every new env var.
- **Section 6 (Database Reference):** Add a table row for every new SQLite
  table, and update if the AdvancedBans schema changes.
- **Section 7 (Testing Requirements):** Update mock patterns when new test
  infrastructure is added.
- **Section 9 (Security Checklist):** Add items when new integration types
  are introduced (e.g. a REST API client).
- **Section 13 (Pull Request Workflow):** Update if the PR workflow or
  checklist changes.
