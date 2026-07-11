# Calorie Tracker: UI Design Specification

This document defines the screen inventory, navigation, content hierarchy, interaction states, and responsive behavior required before high-fidelity visual design or comprehensive implementation.

## Design Principles

- Phone-first, one-handed, fast logging.
- A food amount is never guessed silently.
- Text/name taps open details; circular `+` actions perform immediate logging only when enough history exists.
- Successful repeated actions keep the user in context; editing returns to the originating diary position.
- Unsaved input is never lost through background updates, camera overlays, or network errors.
- Desktop uses the same information architecture rather than becoming a separate application.
- Minimum interactive target size is 44 × 44 CSS pixels.
- Every action is usable without swipe, long-press, or hover.

## Navigation Model

There is no permanent bottom navigation in the initial release. The diary is the home screen.

- Dashboard header: date navigation and Settings.
- A diary slot's **Add Food** opens contextual Search/Add.
- Search/Add preserves the destination diary date and meal slot.
- Back returns one level without losing query or scroll state.
- Browser/PWA Back follows the same navigation semantics as the visible Back control.
- Scanner is an overlay, not a destructive navigation reset.

## Screen Inventory

| Screen | Purpose | Primary action |
|---|---|---|
| Sign In | Authenticate the allowlisted Google identity | Continue with Google |
| Initial Goals | Create the first effective-dated goal | Confirm goals |
| Diary Dashboard | Review a date, totals, and logged food | Add Food |
| Search/Add | Find foods or apply meal shortcuts | Open/quick-add item |
| Amount Adjuster | Preview and log or edit an exact amount | Log / Save |
| Create Food | Enter an unsaved reusable-food draft | Continue to amount |
| Edit Food | Correct reusable food data for future uses | Save Food |
| Barcode Scanner | Scan or manually enter a local code | Use code |
| Meal Shortcut Editor | Rename/change/archive a shortcut | Save Shortcut |
| Settings | Entry point for goals, sessions, export, theme | Open setting |
| Goal History | Add or edit effective-dated targets | Save Goal |
| Active Sessions | View and revoke phone/desktop sessions | Revoke |
| Data Export | Produce JSON or diary CSV | Export |

## 1. Sign In

Minimal centered layout:

- Application name and concise personal-tracker description.
- **Continue with Google** button.
- No registration, password, reset, or provider chooser.
- Unauthorized Google identity: clear access-denied message and Sign Out/Try Another Account.
- OAuth failure: retry without exposing provider error internals.

## 2. Initial Goal Setup

Shown only when the authenticated user has no nutrition goal.

Fields:

- Effective date, defaulting to today in `Europe/Dublin`.
- Calories in kcal.
- Protein, carbohydrates, and fat in grams.

Behavior:

- Suggested values are prefilled but require confirmation.
- Decimal strings are parsed into integer storage units.
- Zero is valid only where explicitly permitted by the goal contract; negative values are invalid.
- Save creates the first goal and enters the diary dashboard.

## 3. Diary Dashboard

### Header

- Previous-date control.
- Central date control: **Today** when current; otherwise formatted date with a return-to-Today affordance.
- Next-date control; future dates are supported.
- Settings icon.

### Daily Summary

Primary calorie equation:

```text
Goal − Consumed = Remaining
```

- When exceeded, display `X over` rather than a confusing negative remaining label.
- Compact Protein, Carbs, and Fat rows show consumed / target and remaining or over.
- Targets come from the latest goal effective on or before the diary date.

### Meal Slots

Fixed order:

1. Breakfast
2. Lunch
3. Dinner
4. Snacks

Each section contains:

- Slot name and calorie subtotal.
- Logged-food rows.
- **Add Food** action.
- **Save as Meal Shortcut** action when the slot contains at least one active entry.

Diary row:

- Food name.
- Optional brand.
- Entered portion representation and resolved g/ml amount.
- Calories and compact macro summary.
- Entire row tap opens Amount Adjuster in edit mode.
- No swipe-only or inline-edit behavior.

### Dashboard States

- Empty day: four lightweight empty slots; no large empty-state illustration.
- Loading: summary and row skeletons that preserve layout.
- Refresh failure with existing data: retain visible data, mark it stale, show Retry.
- Initial failure with no data: error panel with Retry; never show false zero totals.
- Deleted entry: remove immediately, recalculate totals, show Undo message.

## 4. Search/Add

### Header

- Back.
- Destination slot, such as **Lunch**, with diary date shown in secondary text.
- Create Food `+` action.

### Search Row

- Search field.
- Barcode launcher.
- Search is scoped to the authenticated user's active catalogue.

### Segmented Control

```text
[ Foods ] [ Meal Shortcuts ]
```

#### Foods Tab

Empty query:

- **Recently Logged**.
- One row per active reusable food.
- Ordered by most recent non-deleted use.

Non-empty query:

- Matching name and brand results.
- Archived foods excluded.
- Clear no-results state with **Create Food** and barcode actions.

Food row:

- Name, brand, latest resolved amount, and calories for that amount.
- Name tap opens Amount Adjuster.
- Circular `+` is visible/enabled only when a previous amount exists.
- `+` logs the most recent amount anywhere into the active date/slot.
- Pending `+` disables until its request completes.
- Success remains on Search/Add and shows `amount added to slot — Undo`.
- A later deliberate tap creates another independent diary row.

#### Meal Shortcuts Tab

- Search field filters shortcut names in this tab.
- Shortcut name tap opens the editor.
- Circular `+` applies the complete shortcut atomically.
- Success returns to the diary and shows `shortcut added — Undo`.
- Undo removes the whole application batch.
- A shortcut containing an archived food is visibly blocked and links to its editor.

### Search/Add State Preservation

- Returning from Amount Adjuster preserves query, active tab, destination, and scroll position.
- Network failure retains all state and shows Retry.
- PWA update never reloads this screen without confirmation.

## 5. Amount Adjuster

One shared screen with three modes:

1. New log from an existing food.
2. New food draft plus first log.
3. Existing diary-entry edit.

### Header

- Back.
- Mode title: **Add Food** or **Edit Entry**.
- Primary action: **Log** or **Save**.
- Existing reusable foods expose secondary **Edit Food** and **Link Barcode** actions as appropriate.

### Food Identity

- Food name.
- Optional brand.
- Barcode indicator when present.

### Portion Controls

- Portion selector:
  - `1 g/ml`
  - `100 g/ml`
  - exact Serving, if defined
  - exact Container, if defined
- Decimal number-of-portions input.
- Resolved g/ml amount displayed explicitly.
- Destination date and fixed meal slot controls.
- No quick-offset buttons initially.

Prefill behavior:

- Existing diary edit: original snapshotted portion representation.
- New log of previously used food: most recent portion/amount.
- Never-logged/new food: blank count requiring explicit input.

### Live Nutrition Preview

- Calories are displayed from label energy scaling.
- Protein, Carbs, and Fat values update as the amount changes.
- C/F/P energy-contribution percentages are informational and may not reconcile to label calories.
- Optional nutrients are shown in a compact expandable area rather than crowding the primary summary.

### Mode-Specific Completion

- New existing-food log: save, return to Search/Add, confirmation + Undo.
- New food draft: create food and first log atomically, return to Search/Add.
- Existing log edit: update snapshot totals/destination atomically, return to original diary position.
- Existing log edit includes **Delete Entry**; delete returns to diary with Undo.

### Failure Behavior

- Invalid amount: inline error; primary action disabled.
- Network/server failure: keep every input, show Retry, do not navigate.
- Stale concurrent edit: show that the entry changed elsewhere and require reload before overwriting.
- Back from a new-food draft discards both draft and pending log after a discard confirmation only when data has been entered.

## 6. Create Food

This is the first step of an atomic create-and-log wizard, not a standalone catalogue-management screen.

### Identity

- Name, required.
- Brand, optional.
- Barcode, optional; scanned values are locked with Clear/Rescan.
- Possible normalized brand/name duplicate: warn and link, but allow continuation.

### Measurement

- Solid (`g`) or Liquid (`ml`).
- Solid and liquid amounts accept up to three decimal places; liquid values are stored internally as microlitres.
- Nutrition basis amount, default `100`, editable.
- Exact Serving amount, optional.
- Exact Container amount, optional.
- Servings-per-container is derived and not entered.

### Required Nutrition on the Entered Basis

- Calories.
- Protein.
- Carbohydrates.
- Fat.

Required macro values may be zero.

### Optional Nutrition

- Fibre.
- Sugar.
- Saturated fat.
- Sodium.
- Potassium.

### Notes

- Optional plain-text personal reference for the reusable food.
- Notes affect no nutrition calculation.
- Notes remain on the reusable food and are not copied into diary-entry snapshots.

Trace/less-than labels are resolved manually to a numeric value.

### Form Behavior

- All numeric fields use decimal-appropriate mobile keyboards.
- Static unit suffixes are outside the editable text.
- Continue validates and forwards an unsaved draft to Amount Adjuster.
- The reusable food is persisted only when the first log succeeds.
- Similar-name warning does not erase entered data.

## 7. Edit Food

Reuses Create Food field groups with an **Edit Food** title.

- Saving changes future uses only.
- Existing diary snapshots never change.
- If opened from a pending new log, the pending preview refreshes.
- **Archive Food** is available in a destructive-actions section.
- Archival hides the food from search and barcode hits.
- Affected meal shortcuts become blocked until corrected.

## 8. Barcode Scanner Overlay

- Opens over the current Search/Create/Adjuster state.
- Camera viewfinder and concise instructions.
- Flash control where supported.
- **Enter barcode manually** fallback.
- Permission denial and scan failure preserve underlying state.
- Scanned values retain leading zeroes.
- Invalid common retail checksum warns with explicit override.

Outcomes:

- Active hit: close overlay and open Amount Adjuster.
- Miss: open blank Create Food draft with barcode locked and Brand focused.
- Archived hit: offer Restore or Replace Mapping.
- Link collision with another active food: block and show mapped food.

## 9. Meal Shortcut Editor

Creation mode starts from all non-deleted entries in one diary slot after amounts are corrected.

- Name, required.
- Ordered food rows with default exact portion/amount.
- Change default amount.
- Remove or replace food.
- Archived-food error state.
- Save affects future applications only.
- Archive Shortcut in destructive-actions section.

Cooked-yield recipe behavior is not present.

## 10. Settings

Simple list grouped into:

### Nutrition

- Current goals.
- Goal history.
- Add future/effective-dated goal.

### Account

- Google identity summary.
- Active sessions.
- Sign out current session.

### Data

- Full JSON export.
- Diary CSV export.

### Appearance

- Light / Dark / System theme.

### Application

- Version.
- Update available action when applicable.

No food-creation or public-account administration lives in Settings initially.

## 11. Responsive Desktop Behavior

- Centered application shell with a comfortable maximum width rather than stretching diary rows across the screen.
- At wider widths, Dashboard may use a two-column meal grid only if it preserves the fixed reading order; a single wider column is acceptable initially.
- Search/Add may display results and Amount Adjuster side-by-side as a progressive enhancement, but route behavior remains identical to mobile.
- Keyboard focus, Enter submission, Escape close/back, and visible focus rings are mandatory.
- Hover styling supplements rather than replaces tap/click affordances.

## Shared Feedback Patterns

- Success/Undo messages are non-blocking and announced to assistive technology.
- Destructive food/shortcut archival uses confirmation; reversible diary removal uses Undo rather than pre-confirmation.
- Loading indicators do not replace typed input.
- Server validation appears beside the relevant field and in a concise summary when multiple fields fail.
- Authentication expiry preserves the intended destination and returns there after Google sign-in when safe.
- The offline shell clearly states that connectivity is required for diary and catalogue changes.

## Visual Design Still To Define

The following are aesthetic decisions, not architectural blockers:

- Typeface.
- Colour palette.
- Corner radius and elevation system.
- Macro colours.
- Icon family.
- Exact spacing scale.
- Illustration usage, if any.
- Light and dark theme tokens.

These should be explored in high-fidelity mockups after the low-fidelity page layouts and state variants are accepted.
