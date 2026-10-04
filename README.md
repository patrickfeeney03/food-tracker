# Food tracker

SvelteKit calorie and macro tracker with Google login, Cloudflare D1 storage,
and offline/PWA food logging.

For local setup, migrations, staging/production releases, data cutover and
private R2 recovery, see [Cloudflare deployment](docs/cloudflare.md).

```sh
npm ci
cp .dev.vars.example .dev.vars
# Fill in Google credentials in .dev.vars.
npm run db:migrate
npm run dev
```

Deployments are manual. `git push` does not trigger a deployment; there are no
GitHub deployment workflows. Each command deploys your current local code,
including uncommitted changes, from whichever branch is checked out.

Deploy to staging with its separate D1 database:

```sh
npm run deploy:staging
```

Open https://food-tracker-staging.patrickfeeneytamayo.workers.dev/ afterward.
Staging is shared: each deployment replaces the previous staging version.

Deploy to production:

```sh
npm run deploy
```

This checks and builds the app, applies production D1 migrations, deploys the
app, and updates the daily backup Worker. It uses your local Wrangler login;
run `npx wrangler login` if needed. Production runs at
https://food-tracker.patrick.pe/ and uses the production D1 database.
