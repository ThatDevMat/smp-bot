# Contributing

Thanks for contributing to the SMP Bot. This document sets the standard for
how we collaborate so every contribution is consistent, reviewable, and safe.

---

## Branching Strategy

- **`main`** is always production-ready and deployable. Every commit on
  main has passed CI and been reviewed.
- All work happens on feature branches. Name them consistently:

  | Branch Prefix | When to Use                                      |
  | ------------- | ------------------------------------------------ |
  | `feature/`    | New feature (e.g. `feature/discord-boost-roles`) |
  | `fix/`        | Bug fix (e.g. `fix/rcon-timeout-handling`)       |
  | `chore/`      | Maintenance (e.g. `chore/update-dependencies`)   |
  | `docs/`       | Documentation only (e.g. `docs/api-reference`)   |

- Never commit directly to `main`. Open a pull request instead.

---

## Commit Message Convention

All commits must follow **Conventional Commits** format:

```
type(scope): short description

body (optional — explain the why, not the what)

BREAKING CHANGE: description (if applicable)
```

### Allowed types

`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `ci`

### Scope

Use the area of the codebase you changed, e.g. `commands`, `db`, `webhooks`,
`integrations`, `utils`, `ci`. Omit the scope if the change touches multiple
areas (but try to keep commits focused enough that you do not need to).

### Real examples from this project

```
feat(commands): add slash command for whitelist add/remove

Implements /whitelist with add and remove subcommands.
Calls RCON to execute the whitelist changes on the server.
Input is sanitised to alphanumeric + underscore only (1-16 chars).
```

```
test: add unit test suite with 80% coverage threshold

Adds 15 test files covering all command handlers, database helpers,
integration wrappers, and utility modules. Mocks external services
(discord.js, rcon-client, mysql2, better-sqlite3, node-fetch).
```

```
ci: add GitHub Actions lint, test, and deploy pipeline

Two workflows: CI (lint → test + security audit) runs on every push
and PR. Deploy runs on CI completion on main via workflow_run pattern.
SSH deploy with pm2 restart + health check + Discord failure alert.
```

```
refactor(commands): centralise player UUID resolution

Extracts UUID / Mojang username resolution from individual commands
into utils/playerResolver.js. The 5 commands that accept a "player"
argument now route through this single function.
```

```
chore: code review — clean code, security, and consistency pass

Consolidates embed builders into embeds.js with COLOR constants,
sanitises RCON input with a regex whitelist, adds global
unhandledRejection handler, refactors event command into
handleCreate/handleList/handleCancel, creates ESLint + Prettier config.
```

---

## Pull Request Process

1. **Branch must be up to date with `main`** before opening a PR. Rebase
   or merge `main` into your branch.

2. **All CI checks must be green.** The CI workflow runs lint, test, and
   security audit. If any job fails, fix it before requesting review.

3. **Coverage must not drop below 80 %.** The Jest config enforces this
   globally. Run `npm run test:coverage` locally to check.

4. **At least one review approval is required** before merging.

5. **Use squash merge** when you merge. This keeps `main` history clean
   — one commit per feature/fix, with the PR description as the commit body.

6. **Delete the branch after merging.** GitHub can do this automatically
   if you check the box on the merge page.

7. **Reference any related issue** in the PR description using GitHub's
   "Closes #123" syntax. This auto-closes the issue when the PR merges.

---

## Adding a New Slash Command

Use this checklist to ensure nothing is missed:

1. [ ] Create the command file in `src/commands/` following the existing
       pattern exactly (export `data` with a `SlashCommandBuilder` and an
       `execute` function).
2. [ ] Add any required business logic to a service module (`src/utils/`,
       `src/db/`, or `src/integrations/`), not in the command file itself.
3. [ ] Add any required database queries to `src/db/index.js` — the command
       should call a named function, not write raw SQL.
4. [ ] Register the command in `deploy-commands.js` (it auto-discovers files
       in `src/commands/`, so if your file follows the pattern it should
       just work — verify with a console log).
5. [ ] Add the command to the permissions table in `docs/ARCHITECTURE.md`
       and the commands table in `README.md`.
6. [ ] Write unit tests covering happy path, permission gate, and at least
       two failure cases (invalid input, service error, network timeout).
7. [ ] Confirm coverage remains above 80 % with `npm run test:coverage`.
8. [ ] Update `docs/ONBOARDING.md` if the new command requires new
       environment variables.

---

## Code Review Etiquette

### For reviewers

- **Be specific and constructive.** Point to a line number and explain
  _why_ something should change, not just that it should. "This query
  is not parameterised — use a `?` placeholder instead of string
  interpolation" is good. "Fix this query" is not.
- **Distinguish blocking issues from suggestions.** Prefix your comments:

  | Label        | Meaning                                                            |
  | ------------ | ------------------------------------------------------------------ |
  | `[blocking]` | Must be resolved before merging (bug, security issue, logic error) |
  | `[nit]`      | Style preference — the author can take it or leave it              |
  | `[question]` | You do not understand something — ask before approving             |

- **Do not approve a PR you do not understand.** If the change is in a
  part of the codebase you are unfamiliar with, say so. Request a review
  from someone who knows that area.

### For authors

- **Do not merge your own PR.** Always get at least one approval from
  someone else.
- **Respond to every comment.** Even a simple "acknowledged" or "fixed"
  is better than silence. Resolve the conversation when the issue is
  addressed.
- **Keep PRs small.** A PR that touches 15 files and does three different
  things is hard to review. Split it. If that is not possible (e.g. a
  refactor that touches many files with one mechanical change), explain
  why in the description.
