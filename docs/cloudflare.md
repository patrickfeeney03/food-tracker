# Cloudflare deployment and recovery

The SvelteKit app runs on Workers with Static Assets and a request-scoped D1
binding. Google credentials are Worker secrets. Authenticated responses
are private and never cached. The offline shell is the only prerendered page.

## Local development

Use Node 24, `npm ci`, copy `.dev.vars.example` to `.dev.vars`, and fill in Google
credentials. `npm run db:migrate` prepares local D1; `npm run dev` runs Vite with
the Cloudflare adapter's platform proxy. `npm run cf:dev` runs the built Worker.
`npm run db:seed` seeds only the local D1 database; it does not touch production.
OAuth development redirects use the request origin when GOOGLE_REDIRECT_URI is
empty. Google must allow `http://localhost:5173/auth/google/callback` (or your
chosen development host). `.env`/DATABASE_URL and the shared SQLite file are no
longer used by the application.

Run `npm run check`, `npm test`, `npm run build`, `npm run test:e2e`, and
`npm run test:e2e:pwa`. Server integration tests use Miniflare D1; browser tests
exercise the built Worker with isolated local D1 storage. Test fixtures seed
that isolated SQLite implementation directly, never the live database.

## Environments and schema

`wrangler.jsonc` defines separate staging and production Workers and D1 bindings.
The remote database IDs are configured; the all-zero default binding is local only.

`migrations/` is the D1 history, starting with a clean baseline generated from the
current Drizzle schema. `drizzle/` is the preserved historical SQLite migration
history. Never replay it onto an imported D1 database. The baseline is applied
by Wrangler *before* importing data; its `d1_migrations` row is the explicit
migration baseline. SQLite `__drizzle_migrations` rows are not imported.

Edit `src/lib/server/db/schema.ts`, run `npm run db:generate`, inspect generated
SQL, and apply with the appropriate `db:migrate:*` script. Avoid table rebuilds
that drop referenced parents: D1 cannot disable foreign keys, and cascades can
remove data even when constraint checks are deferred. Prefer additive,
backward-compatible migrations. Keep application rollback compatible with the
already-applied schema; deploy schema removals separately after old code expires.
`npm run cf:types` regenerates binding types (without globally replacing Node/DOM
types). Runtime binding types are imported explicitly from workers-types.

## Google login and releases

For each environment store GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
GOOGLE_ALLOWED_EMAILS and GOOGLE_REDIRECT_URI as Worker secrets using
`wrangler secret put NAME --env staging` (and production). Secrets are not
committed; deployment configuration contains no Google credentials.
Register each exact callback URL in Google Cloud. Production callback is
`https://food-tracker.patrick.pe/auth/google/callback`.

Run `npm run deploy` for production. It runs Svelte checks, builds the app,
applies pending production D1 migrations, deploys the application Worker, and
updates the scheduled backup Worker. Steps stop on failure. `npm run
deploy:production` is the explicit equivalent; `npm run deploy:staging` checks,
builds, migrates and deploys only staging. `./deploy.sh` delegates to the same
production command, with an optional `staging` argument.

Deployment uses your local Wrangler OAuth login. Run `npx wrangler login` on a
new machine or when Wrangler requests authentication. No GitHub credentials or
workflows are required. Run unit/browser/PWA tests locally before releasing
application changes. Production uses the `food-tracker.patrick.pe/*` Worker
route on the `patrick.pe` zone, retaining the existing proxied DNS record.

## Rehearsal and cutover

1. Take a consistent backup of the live SQLite file with the SQLite backup API.
   `npm run db:export:sqlite -- /path/prod.db backups/rehearsal.sql` creates its
   own coherent backup, data-only SQL, and a per-table count/content-hash
   manifest. It includes committed WAL data. Do not copy only `prod.db`.
2. Apply the D1 baseline to an **empty** staging database, import using
   `wrangler d1 execute DB --remote --env staging --file backups/rehearsal.sql`,
   then run `npm run db:verify -- backups/rehearsal.sql.manifest.json --remote
   --env staging`. Verification checks every column of every application row,
   including nutrition, relationships, sessions, and offline mutation IDs, plus
   foreign keys and empty assertion storage. Inspect the import log for errors.
3. Validate login/logout/refresh, account isolation, food/diary/goals/shortcuts,
   undo, exports, PWA assets and offline retries on staging. Google staging
   callback registration requires access to the Google OAuth console.
4. Pause old writes (stop `food-tracker` on `dec`), then take a **fresh** coherent
   backup of `/var/www/food-tracker/prod.db`. Keep the snapshot and VPS release.
   Import into empty production D1 and verify the new manifest before routing
   traffic. If preparation fails, start the old service again before D1 writes.
5. Deploy and attach `food-tracker.patrick.pe` to the production Worker. Retain
   the origin hostname so cookies, IndexedDB, service workers and pending
   offline entries survive. Verify an existing session and reconnect replay.
6. Keep the old deployment stopped after D1 begins accepting writes. A rollback
   must reconcile new D1 writes; switching back to stale SQLite loses data.

The production app must be able to read all columns in the baseline. If the
source predates the current SQLite schema, migrate a *copy* of the consistent
snapshot with the preserved SQLite migrations, never the live source during
rehearsal, and then export that copy.

## Recovery and longer retention

Paid D1 Time Travel keeps 30 days of recovery points. Record a bookmark for a known time using
`wrangler d1 time-travel info DB --env production --timestamp <UTC-timestamp>`. Rehearse
restore in a disposable database; production restore overwrites subsequent
writes. Use `wrangler d1 export` for a full SQL backup; verify a restored copy by
foreign-key checks and row/hash comparisons before changing application routing.

The deployed `food-tracker-backup` Worker runs daily at 03:17 UTC via
`wrangler.backup.jsonc`, snapshots schema and all application tables in one D1
batch, and writes SQL plus a manifest/checksum to private `food-tracker-backups`
R2 storage. Bucket public access is disabled and objects expire after 90 days.
Its direct-binding backup fits the current small dataset; large tables approaching
D1 query/result limits should use the full CLI export below. The Worker has no
public fetch handler. `npm run deploy:backup` updates it.

For a manual full export, run
`npm run backup -- production food-tracker-backups`. It uploads SQL, a SHA-256
checksum and a row verification manifest using your local Wrangler login.
The script normalizes one coherent export to create all tables and indexes
before inserting data; raw Wrangler SQL can fail D1 foreign-key checks when
imported directly into an empty database.

Run `npm run backup:verify -- production/<timestamp>.sql` to download an object,
verify its SHA-256 checksum, restore into a newly created disposable remote D1,
compare all application row hashes and foreign keys, and delete the disposable
database. This supports both CLI and scheduled Worker manifests and never
overwrites production. It needs D1 create/delete permissions in addition to R2 read.
To restore, download the SQL and checksum, verify the checksum, import into an
empty D1 database, check foreign keys and schema, and test the app against it.
Treat these backups as sensitive because they include session token hashes.

Set Cloudflare usage notifications and review aggregate Workers/D1 allowances.
The Worker has a 100ms CPU ceiling and observability enabled; adjust from real
request logs if necessary. The subscription does not cap overage spending.

Primary references: [SvelteKit Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/),
[D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/),
[D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/),
[Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

See [the completed cutover record](cutover-2026-09-30.md) for deployed versions,
verified resources, recovery artifacts and remaining account configuration.
