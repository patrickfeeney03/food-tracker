# Preferences that AI should try to follow for this repository

- Use existing helper functions if they exist. Lets keep it DRY.

- Use `rg` to search

- For substantial implementation or refactoring work that can be divided into independent tasks, use sub-agents by default. Give each agent a bounded area such as architecture review, implementation, or testing, and keep the primary agent responsible for integration and final verification. Do not add delegation overhead for trivial changes. If you are the architect use agents that are smaller and quicker than you, so if you are Sol use Luna, if you are Opus 4.8 use Opus 4.6 or Sonnet 4.6, or if you can't change the model try changing the thinking level to make the process quicker.

# Shared local state

- '.env' and 'local.db' live outside the worktree in '/home/patrick/code/calories-shared/' so all git worktrees share the same database and env config.
- No per-worktree '.env' symlink is needed.
- The shared path is defined once in 'shared-local.ts'; vite's 'envDir', 'drizzle.config.ts', and 'src/lib/server/db/seed.ts' all load from there.
- '.env' sets 'DATABASE_URL' to the absolute path '/home/patrick/code/calories-shared/local.db', so drizzle-kit, the dev server, and 'npm run db:seed' all resolve to the shared db from any worktree.

# Worktrees

- There may be multiple concurrent agents working on the same worktrees or different worktrees.
- Each worktree would run its own dev server with its own port. To allow Google auth redirect, if needed, the range 5173-5179 inclusive is allowed in Google Auth Console.
- These worktrees would share the same .env file and local.db file to make things easier.
