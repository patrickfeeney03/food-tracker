# Calorie Tracker Project State

Last updated: 2026-07-19

This is the compact handoff: durable decisions, implemented scope, known risks, and next work.

## Authority and Working Conventions

When artifacts conflict, use:

1. `NUTRITION_MATH.md` and the schema contract in `PLAN.md` for storage, calculations, snapshots, and integrity.
2. `UI_DESIGN_SPEC.md` for behavior, navigation, states, and accessibility.
3. `CalorieTrackerProductDesign.png` for visual appearance.

`drawing.excalidraw` is legacy and not authoritative. The product image also does not override nutrition rules, especially arbitrary label bases.

- This is Patrick's personal app; explain SvelteKit concepts incrementally.
- Edit implementation only when explicitly asked and preserve unrelated work.
- Use generated `./$types`, `z.flattenError()`, and Tailwind utilities by default.
- Use semantic tokens from `src/routes/layout.css` for consistent light/dark behavior.
- Build query strings with `withQuery()` and pass the result through `resolve()`.

## Durable Nutrition Contract

- Label calories are authoritative; do not derive or enforce them from macros.
- Foods retain the label's entered basis and are never normalized to 100 g/ml.
- `basisAmount`, `servingAmount`, and `containerAmount` are exact physical amounts, not multipliers.
- Nutrition scales as `value per basis × resolved amount / basis amount`.
- Portion kinds are `unit` (1 g/ml), `hundred` (100 g/ml), exact `serving`, and exact `container`; portion count multiplies the selected amount.
- Diary logs contain self-contained nutrition snapshots. Food edits affect future logs only; diary-entry edits recalculate from the saved snapshot.
- Sodium and fibre are supported; salt is not. Food notes do not affect calculations.
- Decimal strings are converted directly to fixed-point integers. Arithmetic uses `bigint`, half-up rounding, and checked safe-integer conversion.

| Value | UI | Storage |
| --- | --- | --- |
| Energy | kcal | mkcal |
| Nutrients | g | mg |
| Solid amount | g | mg |
| Liquid amount | ml | ul |
| Portion count | decimal | thousandths |

Amounts support up to three decimal places. The development database is currently disposable.

## Implemented Scope

### Platform and authentication

- SQLite/Drizzle schema covers users, OAuth accounts, sessions, effective-dated goals, foods, diary logs, shortcuts/items, and shortcut applications.
- Database startup enforces WAL, foreign keys, and busy timeout.
- Google OAuth with state, PKCE, user-info and allowed-email validation is implemented and manually verified.
- Sessions store only SHA-256 token hashes, expire after 90 days, refresh at most daily, and support POST-only logout/revocation.

### Food catalogue and logging

- `/foods` provides owner-scoped active-food search by name, brand, or barcode; recent-use ordering; barcode scanning/manual entry; destination preservation; and feedback.
- `/foods/new` atomically creates a reusable food and its first diary snapshot. It supports arbitrary solid/liquid bases, exact serving/container amounts, optional nutrition, live previews, and field-error preservation.
- Create-and-log retries store a canonical request fingerprint and reject a changed payload that reuses the same mutation UUID.
- Existing-food Amount Adjuster and `/diary/[entryId]/edit` support portion/date/meal changes using snapshot nutrition.
- Quick Add replays the latest compatible portion representation with current food nutrition, falls back to the previous exact amount when serving/container definitions change, and provides pending feedback plus Undo.
- Food editing has optimistic conflict checks, duplicate-barcode handling, and confirmed archival without changing diary history.
- Diary entry deletion soft-deletes the owned active row, recalculates the diary, and offers exact-deletion Undo.
- Existing-food mutations and shortcut applications are retry-safe; existing-food retries compare semantic input.

### Dashboard, shortcuts, goals, and settings

- `/` shows effective targets, calories/macros, meal totals, entries, date navigation, Settings, and edit links.
- Meal shortcuts support draft creation from populated meals, exact saved portions, reorder/edit/archive, blocked-food repair, idempotent batch application, provenance, and whole-batch Undo.
- `/goals/setup`, Settings Daily Targets, and Goal History share the effective-dated goal editor.
- Settings implements theme preference, current identity/targets, network/app information, active-session count, and current-session sign out.
- Shared shells, headers, feedback, submit bars, food fields, goal fields, amount-adjuster controls, shortcut editors, and Settings rows are componentized.

### Tests

- Unit/integration coverage includes nutrition math, services, database behavior, ownership, snapshots, conflicts, retry safety, deletion, and Undo.
- `tests/e2e/` covers core create/add/Quick Add/edit/delete/restore flows, arbitrary/fractional inputs, stale serving/container rejection, retries, and archived/cross-user access.
- Playwright uses a dedicated migrated `.playwright/e2e.db`; it does not touch the development database or Google OAuth.

## Current Route Gaps

- Create Food intentionally uses the implemented one-page atomic create-and-first-log flow.
- Normal Amount Adjuster adds do not yet have pending-button protection or success Undo.
- Dashboard rows omit some specified details; loading, stale-data, retry, and broader Undo states are incomplete.
- Barcode archived-hit recovery, checksum override, restore/replace, and link-collision flows are missing.
- Settings Account Details, individual session revocation, JSON/CSV export, and PWA/update destinations are placeholders or absent.
- Search tab/query/scroll restoration through nested flows is incomplete.

## Integrity and Technical Risks

- Diary edits lack `updatedAt` concurrency checks, so concurrent tabs can overwrite each other.
- The home goal guard checks for any goal, while diary selection requires one effective on or before the selected date.
- Session refresh revalidates before updating by ID; the update should repeat active/non-expired predicates.
- Food decimal validation limits precision but not magnitude; brand, barcode, and notes need explicit service-boundary length limits.
- Catalogue recent-use lookup reduces all matching diary rows in JavaScript instead of selecting one row per food.
- Migration `0001` does not convert legacy liquid `amount_unit='ml'` rows to `ul`; fix or squash before data becomes persistent.
- Meal shortcuts can only originate from populated meals; mixed unavailable-food drafts require repair before saving.
- Diary destination validation and small `readText` helpers are duplicated.
- `todayInDublin()` reads the clock directly; date helpers need deterministic DST-boundary tests.
- OAuth callback, Settings, shortcuts, and remaining dashboard states need focused route/component coverage.

## Next Work

### P0 — protect the completed logging flow

No open P0 work.

### P1 — repeated logging and integrity

1. Align first-goal guards with effective-date selection and make session refresh atomic.
2. Add magnitude/text limits and preserve catalogue query/tab/scroll context through nested flows.

### P2 — settings and resilience

1. Implement individual session revocation and JSON/CSV export.
2. Complete barcode recovery/collision outcomes and PWA/offline/update handling.
3. Audit core screens against `CalorieTrackerProductDesign.png` at mobile and desktop widths, including 44 px targets, focus, keyboard, and screen-reader behavior.
4. Optimize latest-use SQL, fix the legacy `ml` migration, make date helpers deterministic, and extend route/component coverage with remaining validation and portion variants.
5. Add reusable Button variants and consolidate truly identical form-reading helpers incrementally.

## Local Configuration

```dotenv
DATABASE_URL=local.db
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
GOOGLE_ALLOWED_EMAIL=
```

Never commit `.env` or Google client secrets.

## Commands

```bash
npm run check
npm run lint
npm test
npm run test:e2e
npm run build

npm run dev
npm run db:migrate
npm run db:generate
npm run db:studio
```
