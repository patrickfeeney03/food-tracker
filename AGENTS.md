# Preferences that AI should try to follow for this repository

- Use existing helper functions if they exist. Lets keep it DRY.

- Use `rg` to search

- For substantial implementation or refactoring work that can be divided into independent tasks, use sub-agents by default. Give each agent a bounded area such as architecture review, implementation, or testing, and keep the primary agent responsible for integration and final verification. Do not add delegation overhead for trivial changes. If you are the architect use agents that are smaller and quicker than you, so if you are Sol use Luna, if you are Opus 4.8 use Opus 4.6 or Sonnet 4.6, or if you can't change the model try changing the thinking level to make the process quicker.

# Local Cloudflare state

- Use `.dev.vars` for local Google configuration and secrets; it is gitignored. Copy `.dev.vars.example` and configure it per worktree.
- Local SQLite files and `DATABASE_URL` are no longer application configuration. The request uses the Cloudflare `DB` binding from `wrangler.jsonc`.
- `npm run db:migrate` and `npm run db:seed` prepare the local Wrangler D1 database in `.wrangler/state/v3`.
- Drizzle generates D1 migrations into `migrations/`; Wrangler applies them. Keep `drizzle/` as historical SQLite migration history and never replay it onto imported D1.
- Browser tests use isolated `.playwright/` D1 storage. Never seed or run destructive tests against remote production bindings.
- Deployment, cutover and recovery instructions are in `docs/cloudflare.md`.

# Worktrees

- There may be multiple concurrent agents working on the same worktrees or different worktrees.
- Each worktree would run its own dev server with its own port. To allow Google auth redirect, if needed, the range 5173-5179 inclusive is allowed in Google Auth Console.
- Worktrees keep separate `.dev.vars` and Wrangler state; configure each development server origin in Google OAuth as needed.
