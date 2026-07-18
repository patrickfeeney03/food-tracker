# Calorie Tracker Project State

Last updated: 2026-07-18

This file records the current implementation state, durable decisions, known compromises, and the next implementation sequence.

## Source Authority

When project artifacts disagree, use this order:

1. `NUTRITION_MATH.md` and the schema contract in `PLAN.md` for nutrition, storage, snapshot, and data-integrity behavior.
2. `UI_DESIGN_SPEC.md` for navigation, interaction behavior, responsive requirements, and screen states.
3. `CalorieTrackerProductDesign.png` for visual appearance such as colour, typography, spacing, and composition.

`drawing.excalidraw` is a legacy low-fidelity exploration. It contains superseded ideas such as salt, per-100-only nutrition, and servings-per-container input, so it is not an implementation contract.

The product image is also not authoritative for nutrition behavior. In particular, wording about normalizing nutrition per 100 g/ml conflicts with the fixed-point contract: foods preserve the arbitrary basis entered from the label.

## Working Style

- This is a personal application.
- Patrick has Angular and backend experience but is learning SvelteKit and meta-framework conventions.
- Patrick generally wants to type the code himself. Only edit implementation files when explicitly asked to add, change, or fix something.
- Explain new SvelteKit concepts incrementally.
- Use the generated route types from `./$types`, such as `PageServerLoad`, `Actions`, and `PageProps`.
- Use `z.flattenError()` rather than deprecated Zod error flattening methods.
- Use Tailwind CSS utility classes as the default approach for UI styling. Reserve component-level CSS for effects or behavior that would be awkward or unclear to express with utilities.
- Preserve unrelated work in the shared worktree and avoid broad cosmetic rewrites.

## Core Nutrition Decisions

- Calories entered for a food are authoritative. Do not derive or enforce calories from protein, carbohydrate, and fat.
- Food nutrition remains stored on the basis entered from the label; it is not normalized to 100 g/ml.
- Sodium is supported; salt is not.
- Fibre is supported.
- Food notes are plain reusable-food notes and do not affect calculations.
- Existing diary logs are historical snapshots. Editing a reusable food affects future logs only.
- The database is disposable during development.

### Fixed-point storage

- Energy UI unit: kcal.
- Energy storage unit: mkcal.
- Nutrient UI unit: normally grams.
- Nutrient storage unit: mg.
- Solid amount UI unit: g.
- Solid amount storage unit: mg.
- Liquid amount UI unit: ml.
- Liquid amount storage unit: ul.
- Both solid and liquid UI amounts support up to three decimal places.
- Portion counts are stored in thousandths.
- Decimal strings are parsed directly into integers.
- Arithmetic uses `bigint`, half-up rounding, and checked conversion to safe JavaScript integers.

### Basis, serving, and container semantics

All food amounts are exact physical amounts, not multipliers.

```text
basisAmount = 100
servingAmount = 125
containerAmount = 500
```

For a solid food, these mean:

- Nutrition values are stated per 100 g.
- One serving is exactly 125 g.
- The full container is exactly 500 g.

Do not enter `1.25` as the serving amount or `5` as the container amount. Serving and container amounts are not derived from the basis.

If a food contains 200 kcal per 100 g:

```text
125 g serving   = 200 × 125 / 100 = 250 kcal
500 g container = 200 × 500 / 100 = 1000 kcal
```

The basis controls nutrition scaling only. It does not restrict which quantities can be logged.

## Portion Model

The supported portion kinds are:

- `unit`: 1 g or 1 ml
- `hundred`: 100 g or 100 ml
- `serving`: the food's exact `servingAmount`
- `container`: the food's exact `containerAmount`

The portion count multiplies the selected portion amount.

```text
125 × 1 g
1.25 × 100 g
1 × Serving (125 g)
0.25 × Container (500 g)
```

These all resolve to 125 g. Nutrition is then scaled independently:

```text
nutrition total = nutrition per basis × resolved amount / basis amount
```

## Database and Services

The SQLite/Drizzle schema contains:

- `users`
- `auth_accounts`
- `sessions`
- `nutrition_goals`
- `foods`
- `meal_shortcuts`
- `meal_shortcut_items`
- `meal_shortcut_applications`
- `diary_logs`

Database initialization verifies WAL mode, foreign-key enforcement, and the busy timeout.

Implemented nutrition services include:

- Fixed-point input parsing, portion resolution, scaling, rounding, and display formatting.
- Food input mapping, active-catalogue search, recent-use ordering, and barcode lookup.
- Atomic food creation and first diary snapshot.
- Historical diary snapshots and idempotent mutation retry handling.
- Existing-food logging with owner/active checks, semantic retry validation, and immutable snapshots.
- Daily diary summaries, applicable-goal selection, and goal insert/update.
- Diary-entry snapshot updates.
- Reusable-food edit, optimistic conflict detection, barcode-conflict handling, and archive.
- Meal-shortcut draft creation from populated diary slots, exact-amount create/edit/reorder/archive, optimistic conflict detection, owner-scoped catalogue search, blocked-food handling, idempotent atomic batch application, and whole-batch Undo.
- Shortcut applications keep their own owner-scoped mutation identity and immutable shortcut-name snapshot. Applied diary rows retain both shortcut provenance and the application batch ID.
- Foods referenced by active or archived shortcuts may still be edited, but their physical amount unit cannot change between g and ml.

## Authentication

Google OAuth is implemented and has been manually verified.

```text
Google authorization
→ state and PKCE validation
→ Google user-info validation
→ allowed-email enforcement
→ local user/account lookup or creation
→ local session creation
→ secure session cookie
```

Session behavior:

- Raw session tokens exist only in the browser cookie.
- SQLite stores SHA-256 token hashes.
- Sessions expire after 90 days.
- Active sessions refresh at most once per 24 hours.
- Revoked and expired sessions are rejected.
- Logout revokes the current session and deletes the cookie.

Required local environment variables:

```dotenv
DATABASE_URL=local.db
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
GOOGLE_ALLOWED_EMAIL=
```

Never commit `.env` or Google client secrets.

## Current Routes and UI

### `/sign-in` and `/logout`

- Authenticated users are redirected away from Sign In.
- Controlled OAuth failure messages and the Google sign-in action are implemented.
- Sign In uses the shared visual tokens and responsive product styling.
- Logout is POST-only, revokes the current session, and removes the cookie.

### `/goals/setup`

- Authentication, no-existing-goal guard, Dublin-date defaults, suggested targets, Zod validation, preserved form values/errors, and first-goal persistence are implemented.
- The route uses the same mobile shell, semantic colour tokens, form styling, and dark-mode behavior as the rest of the application.

### `/`

- Authentication and missing-goal redirects are implemented.
- A validated `date` query selects the diary day and effective goal.
- The dashboard shows the calorie equation, macro progress, meal subtotals, empty/populated slots, and contextual Add Food actions.
- Previous, next, Today, Settings, desktop layout, dark-theme tokens, and diary-row links to Edit Entry are implemented.
- Diary rows currently show resolved amount and calories, but not every richer detail requested by `UI_DESIGN_SPEC.md`, such as brand, original portion representation, and compact macro text.

### `/foods`

- The route requires a valid diary date and meal slot and lists only the signed-in user's active foods.
- Name, brand, and barcode search are implemented.
- Empty-query results are ordered by most recent non-deleted use, then alphabetically; never-logged catalogue foods follow logged foods.
- Latest resolved amount and calories are displayed when a previous use exists.
- The destination is preserved across Search/Add, Create Food, and Edit Food navigation.
- The Foods/Meal Shortcuts visual tab, barcode launcher, empty/results states, and `created=1` success feedback are styled.
- Food editing is available from each row.
- Food-name taps open the existing-food Amount Adjuster while Edit Food remains a separate action.
- Successful existing-food logging returns to Search/Add with announced `added=1` feedback.
- Quick Add remains disabled.
- Food create, add, edit, and archive redirects render announced confirmation messages.

### `/foods/new`

- The route validates the diary destination, generates a retry-safe client mutation UUID, validates food and diary inputs separately, and calls `createFoodAndLog()` atomically.
- The shared food fields include identity, barcode, solid/liquid type, arbitrary label basis, exact serving/container amounts, core nutrition, fibre, sugar, saturated fat, sodium, potassium, and notes.
- The create-food merge artifact that duplicated most form fields and produced duplicate IDs has been removed in the current working change.
- The misleading hardcoded 100 g/ml first-entry UX has been replaced in the current working change with unit, hundred, available Serving, and available Container choices.
- The current working change also shows resolved amount and live calorie/macro previews, disables invalid submission, and reports unavailable serving/container choices from the server.
- The route remains a one-page create-and-first-log flow. This differs from the two-step unsaved-draft wizard in `UI_DESIGN_SPEC.md`; either implement that wizard later or explicitly revise the behavior spec after a product decision.
- Duplicate active barcodes are reported as a field-level error and covered by a service test.

### `/foods/[foodId]/edit`

- Reusable food fields can be edited for future logs without changing diary history.
- Optimistic conflict detection and friendly barcode collision errors are implemented.
- Food archival is implemented with confirmation and retains historical diary entries.
- Styling and shared food fields use the common semantic light/dark tokens.

### `/diary/[entryId]/edit`

- Existing snapshot portion data is loaded without consulting mutable reusable-food nutrition.
- Portion selection, live resolved amount, live nutrition preview, date change, and meal-slot change are implemented.
- Saving recalculates and updates the snapshot atomically and returns to the destination diary date.
- Delete Entry, Undo, and optimistic stale-edit protection are not implemented.

### Barcode scanner overlay

- Camera scanning, manual entry, torch control where available, permission/failure states, and preservation of the underlying Search/Add state are implemented.
- An active barcode hit returns the matching catalogue food; a miss opens Create Food with the barcode populated.
- Active hits can continue through the existing-food Amount Adjuster; archived-hit recovery remains unimplemented.
- Archived-code restore/replace, checksum warning/override, and link-collision workflows are not implemented.

### `/settings`

- Current targets, signed-in identity, active-session count, Light/Dark/System preference, network state, app version, and current-session sign out are displayed.
- Theme persistence is implemented.
- Daily Targets opens an effective-dated editor, prefilled from the current applicable goal. Saving updates the selected date or starts a new historical target period and returns with announced feedback.
- Goal History lists target periods newest-first, identifies current/upcoming/previous periods, and links each period to the shared editor. New future/effective-dated periods can also be added there.
- Account details, active-session revocation, and JSON/CSV export destination routes are not implemented; their current rows are visual placeholders and should not imply working navigation.
- Settings uses the same canvas, surface, panel, border, text, status, and action tokens as the other application screens.

## Shared UI and Navigation

- `src/routes/layout.css` defines light/dark application colours and common form defaults.
- `src/lib/components/AppPageShell.svelte`, `BackPageHeader.svelte`, `FeedbackBanner.svelte`, and `BottomSubmitBar.svelte` provide the shared responsive page frame, navigation header, form feedback, and fixed submit action.
- `src/lib/components/FoodFormFields.svelte` provides shared Create/Edit Food fields.
- `src/lib/components/NutritionGoalForm.svelte` provides the shared onboarding and Settings target form.
- `src/lib/components/amount-adjuster/` provides shared portion selection, portion quantity, nutrition preview, and diary destination controls for Create Food, Add Food, and Edit Entry.
- `src/lib/components/meal-shortcuts/` provides the shared shortcut editor and active-food replacement picker for Create/Edit Shortcut.
- `src/lib/components/settings/` provides the repeated Settings section and row structures.
- `src/lib/components/BarcodeScanner.svelte` provides the state-preserving scanner overlay.
- `src/lib/date.ts` provides current Dublin date and calendar-date shifting.
- `src/lib/navigation.ts` provides `withQuery()` for encoded navigation context.

Use `withQuery()` inside `resolve()`:

```ts
resolve(
  withQuery('/foods', {
    date,
    mealSlot
  })
)
```

## Known Compromises and Risks

- Quick Add, normal add success Undo, and diary-entry deletion are absent. Meal-shortcut application Undo is implemented for the whole application batch.
- Existing-food logging rejects reuse of a mutation UUID with different semantic input. The older create-and-log service still accepts an exact UUID replay without comparing the retried payload, because no request fingerprint is stored.
- The home-page goal guard checks whether any goal exists, while diary selection requires a goal effective on or before the diary date. A future-dated first goal can therefore bypass setup but leave the current diary without an applicable goal.
- Diary-entry edits do not compare `updatedAt`, so concurrent tabs can overwrite one another.
- Session refresh revalidates a session and then updates by ID alone. A concurrent revoke/expiry between those operations should be closed by repeating the active-session predicates in the update.
- Decimal validation limits precision but not magnitude; extremely large values reach checked conversion later. Brand, barcode, and notes also need explicit service-boundary length limits.
- Recent-use lookup currently loads every matching diary row for up to 50 foods and reduces them in JavaScript; replace it with a one-row-per-food query before diary history becomes large.
- Migration `0001` does not transform legacy liquid `amount_unit='ml'` rows to `ul`. The database is disposable today, but migrations must be squashed or corrected before preserving real data.
- Search query, active tab, and scroll restoration across nested flows are not fully implemented.
- Create Food currently uses a one-page create-and-log experience rather than the specified unsaved-draft wizard.
- Meal shortcuts can only be created from a populated diary meal. A mixed meal containing unavailable food opens as a repairable draft; blocked rows must be replaced or removed before saving.
- Active Sessions, Data Export, and PWA/update screens are absent.
- Core routes, shared food fields, and the scanner use one semantic palette for consistent light/dark behavior. Camera and brand surfaces retain intentional fixed colours.
- Dashboard loading, stale-data, retry, and Undo states from the UI specification are not implemented comprehensively.
- The diary-destination Zod schema is duplicated between `/foods` and `/foods/new`.
- `todayInDublin()` reads the clock directly and should accept an optional `Date` for deterministic tests.
- Date helpers need focused tests around Dublin daylight-saving boundaries.
- Core services have useful unit/integration coverage, but route loaders/actions, OAuth callback orchestration, and the main Svelte interactions need focused tests.

## Prioritized Roadmap

### P0: protect the completed core logging flow

1. Add route/component tests for Create Food and both Amount Adjusters, including validation preservation and unavailable Serving/Container rejection.
2. Add browser-level coverage for food-row navigation, successful existing-food logging, idempotent retry, and cross-user/archived-food rejection.
3. Manually verify:
   - 100 g basis with a 125 g Serving.
   - Arbitrary 125 g and 250 g bases.
   - Fractional ml input and liquid Serving/Container choices.
4. Decide whether to keep the current one-page Create Food flow or implement the specified two-step unsaved-draft wizard, then align `UI_DESIGN_SPEC.md`.
5. Add a stored/request fingerprint or equivalent comparison so create-and-log retries reject a changed payload using the same mutation UUID.

### P1: complete repeated logging and close integrity gaps

1. Implement Quick Add from the most recent portion representation while calculating from the reusable food's current nutrition.
2. Add idempotency, pending-button protection, success feedback, and Undo for normal add and Quick Add.
3. Add Delete Entry with immediate diary recalculation and Undo.
4. Add optimistic concurrency protection to diary-entry editing.
5. Make first-goal/setup guards use the same effective-date rule as diary goal selection.
6. Make session refresh atomically require a non-revoked, non-expired session and handle a zero-row update as unauthenticated.
7. Add magnitude and text-length limits at food service boundaries with field-level failures.
8. Preserve search query, active tab, destination, and scroll state through adjust/edit/back flows.

### P2: settings, resilience, and visual completion

1. Implement Active Sessions with individual revocation.
2. Implement full JSON export and diary CSV export.
3. Complete barcode checksum, archived-hit, restore/replace, and link-collision outcomes.
4. Add PWA/offline/update handling that never discards unsaved input.
5. Compare core screens against `CalorieTrackerProductDesign.png` at 390 × 844 and desktop widths, then verify 44 px targets, focus visibility, keyboard behavior, and screen-reader feedback.
6. Extract the shared diary-destination schema, make date helpers deterministic, and add route-level and component interaction tests.
7. Replace catalogue latest-use reduction with a one-row-per-food SQL query and correct/squash the legacy `ml` → `ul` migration before the database becomes persistent.
8. Add a reusable Button component with primary, secondary, ghost, and danger variants, then migrate repeated inline button styles incrementally.
9. Refactor the repeated `readText` FormData helper into a shared function where the behavior is consistent.

## Verification Commands

```bash
npm run check
npx eslint .
npm test
```

Development:

```bash
npm run dev
```

Database:

```bash
npm run db:migrate
npm run db:generate
npm run db:studio
```
