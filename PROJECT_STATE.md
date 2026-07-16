# Calorie Tracker Project State

Last updated: 2026-07-16

This file records the current implementation state, important decisions, known compromises, and the recommended next steps. The detailed contracts remain in:

- `PLAN.md`
- `UI_DESIGN_SPEC.md`
- `NUTRITION_MATH.md`

## Working Style

- This is a personal application.
- Patrick has Angular and backend experience but is learning SvelteKit and meta-framework conventions.
- Patrick generally wants to type the code himself. Only edit implementation files when explicitly asked to add, change, or fix something.
- Explain new SvelteKit concepts incrementally.
- Use the generated route types from `./$types`, such as `PageServerLoad`, `Actions`, and `PageProps`.
- Use `z.flattenError()` rather than deprecated Zod error flattening methods.
- Use Tailwind CSS utility classes as the default approach for UI styling. Reserve component-level CSS for effects or behavior that would be awkward or unclear to express with utilities.

## Core Nutrition Decisions

- Calories entered for a food are authoritative. Do not derive or enforce calories from protein, carbohydrate, and fat.
- Food nutrition remains stored on the basis entered from the label.
- Sodium is supported; salt is not.
- Fibre is supported.
- Food notes are plain reusable-food notes and do not affect calculations.
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
- Arithmetic uses `bigint`, half-up rounding, and checked conversion to safe JavaScript integers.

### Basis, serving, and container semantics

All food amounts are exact physical amounts, not multipliers.

Example:

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

The following all resolve to 125 g:

```text
125 × 1 g
1.25 × 100 g
1 × Serving (125 g)
0.25 × Container (500 g)
```

Nutrition is then scaled independently:

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
- `diary_logs`

Database connection setup verifies:

- WAL mode
- Foreign-key enforcement
- Busy timeout

Implemented nutrition services include:

- Food input mapping
- Portion resolution
- Historical diary snapshots
- Atomic food creation and first diary log
- Idempotent mutation retry handling
- Daily diary summary and goal selection
- Nutrition goal mapping
- Nutrition goal insert/update

## Authentication

Google OAuth is implemented and has been successfully tested manually.

The flow is:

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

## Implemented Routes

### `/sign-in`

- Redirects authenticated users to `/`.
- Displays controlled OAuth failure messages.
- Starts Google sign-in.

### `/logout`

- POST-only.
- Revokes the current session.
- Deletes the session cookie.

### `/goals/setup`

- Requires authentication.
- Redirects away when the user already has a goal.
- Prefills the current Dublin date and suggested targets.
- Validates with Zod.
- Preserves values and field errors on failure.
- Saves the first effective-dated goal.

### `/`

- Requires authentication.
- Redirects users without a goal to `/goals/setup`.
- Accepts a validated `date` query parameter.
- Loads the applicable goal, meal entries, totals, and balances.
- Displays a functional but unstyled diary dashboard.
- Contains previous/next/today navigation.
- Contains contextual Add Food links for all four meal slots.

### `/foods`

- Requires authentication.
- Requires a valid diary date and meal slot.
- Lists only the current user's active foods.
- Supports name/brand search.
- Preserves the diary destination in navigation.
- Empty search currently sorts the active catalogue alphabetically.

### `/foods/new`

- Requires authentication.
- Validates the diary destination.
- Generates a retry-safe client mutation UUID.
- Validates food input and diary input independently.
- Calls `createFoodAndLog()` to insert the food and first diary snapshot atomically.
- Returns validation errors and all entered values on failure.
- Redirects back to Search/Add after success.

## Shared UI/Navigation Utilities

- `src/lib/date.ts`
  - Current Dublin calendar date.
  - Calendar-date shifting without doing date mutation inside a Svelte component.
- `src/lib/navigation.ts`
  - `withQuery()` builds encoded query strings.
  - Use it inside `resolve()`:

```ts
resolve(
  withQuery('/foods', {
    date,
    mealSlot
  })
)
```

This avoids repeated manual `encodeURIComponent()` calls while retaining SvelteKit base-path and route handling.

## Current Known Compromises

### Create Food portion UX is misleading

The current Create Food form hardcodes:

```text
portionKind = hundred
```

Therefore its first diary-entry count currently means multiples of 100 g/ml:

```text
1 = 100 g/ml
1.25 = 125 g/ml
```

This is not a business rule. It was a temporary vertical-slice implementation and caused understandable confusion when basis or serving amounts differed from 100.

This should be corrected before further feature work or styling.

The Create Food form should provide:

- A portion selector for 1 g/ml.
- A portion selector for 100 g/ml.
- Serving when `servingAmount` is populated.
- Container when `containerAmount` is populated.
- A number-of-portions input.
- An explicit resolved g/ml preview.

Server validation must also reject `serving` or `container` when the corresponding amount is absent. Do not rely solely on disabled or hidden UI options.

### Styling has started on the diary

The home diary screen now follows the supplied product design:

- Mobile-first 390 px-style shell.
- Compact date navigation.
- Daily energy equation card.
- Colored macro progress indicators.
- Empty and populated meal cards.
- Responsive centered presentation on wider screens.

The other routes remain mostly unstyled. Continue the design foundation with:

- Colour, typography, spacing, radius, border, and shadow tokens.
- Global page shell.
- Reusable button, input, field, card, and alert styles.
- Mobile-first layout based on the Figma reference.
- Diary dashboard first, followed by Sign In, Goals, Search/Add, and Create Food.

### Search/Add is incomplete

- Empty query should eventually show Recently Logged rather than alphabetical foods.
- Food rows are not yet clickable.
- Existing foods cannot yet be logged.
- Quick-add is not implemented.
- `created=1` is added after creating a food but is not yet shown as a success message.
- Undo is not implemented.

### Create Food is incomplete

- The server accepts optional nutrition fields, but the current page exposes only core nutrition and notes.
- Fibre, sugar, saturated fat, sodium, and potassium fields still need UI controls.
- Duplicate active barcode failures are not yet converted into friendly form errors.
- Serving/container first-log choices are not implemented.
- Resolved amount and nutrition preview are not implemented.

### Technical cleanup

- The diary-destination Zod schema is duplicated between `/foods` and `/foods/new`; extract it when editing these routes next.
- `todayInDublin()` directly reads the clock and should accept an optional `Date` for deterministic tests.
- Date helpers need focused tests around Dublin summer-time boundaries.
- Route loaders/actions and OAuth callback orchestration do not yet have route-level tests. Core services have integration tests.
- Some formatting is inconsistent because files were typed incrementally; avoid cosmetic rewrites until touching the relevant file.

## Recommended Next Steps

1. Correct the Create Food portion selector and resolved-amount behavior.
2. Add server-side validation for unavailable serving/container portions.
3. Manually verify creation with:
   - A 100 g basis and 125 g serving.
   - A 125 g basis.
   - A liquid food with fractional ml.
4. Begin the shared styling/design foundation.
5. Style the diary dashboard against the Figma reference.
6. Implement logging an existing food through an Amount Adjuster.
7. Add Recently Logged ordering and quick-add.
8. Add success feedback and Undo.
9. Continue with editing entries, editing foods, meal shortcuts, barcode scanning, settings, goal history, sessions, and export.

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
