# Calorie Tracker: Nutrition Math Contract

This document defines how numeric food-label input is parsed, stored, scaled, rounded, totalled, and displayed. It is the source of truth for nutrition calculations and should be represented by shared server-side functions and test vectors.

## Principles

- Preserve the nutrition basis printed on the food label. Do not normalize stored food data to 100 g or 100 ml.
- Treat the food's entered calories as authoritative. Never calculate or enforce calories from protein, carbohydrate, and fat.
- Use integer fixed-point arithmetic for persisted values and nutrition calculations.
- Parse decimal input from strings. Do not pass it through JavaScript `number` arithmetic before converting it to its storage integer.
- Round only at the boundaries defined below.
- Diary entries store calculated snapshots. Editing a reusable food never changes an existing diary entry.

Macro energy calculations such as `protein × 4 + carbohydrate × 4 + fat × 9` may be shown later as informational estimates, but they must not replace, validate, or reject the calories entered from a food label. Label calories and macro-derived energy frequently differ because of label rounding, fibre, sugar alcohols, and jurisdiction-specific rules.

## Canonical Units

| Value | UI unit | Storage unit | Scale |
|---|---|---|---:|
| Energy | kcal | milli-kilocalories (`mkcal`) | 1 kcal = 1,000 mkcal |
| Nutrients | g | milligrams (`mg`) | 1 g = 1,000 mg |
| Solid amount | g | milligrams (`mg`) | 1 g = 1,000 mg |
| Liquid amount | ml | microlitres (`ul`) | 1 ml = 1,000 ul |
| Portion count | portions | milli-portions | 1 portion = 1,000 milli-portions |

Sodium is stored in milligrams. Salt is not modelled initially.

Each food has exactly one `amount_unit`:

- A solid food uses `mg` for its basis, optional serving, optional container, diary amount, and shortcut amount.
- A liquid food uses `ul` for all of those values. `ul` is the ASCII storage identifier for microlitres (`µl`).
- The application does not convert between mass and volume. It has no density model.

## Decimal Input Parsing

Numeric UI values arrive at the server as strings. The parser must:

1. Trim surrounding whitespace.
2. Accept a single optional decimal point and ASCII digits.
3. Reject signs, exponent notation, grouping separators, `NaN`, and `Infinity`.
4. Reject more fractional digits than the field supports rather than silently rounding typed input.
5. Convert the whole and fractional digit strings directly to an integer.
6. Apply the field's positive or non-negative validation after conversion.

Examples:

```text
parse kcal "132.5"       -> 132500 mkcal
parse nutrient g "4.7"  -> 4700 mg
parse solid g "250.25"  -> 250250 mg
parse liquid ml "250.125" -> 250125 ul
parse portions "1.5"    -> 1500 milli-portions
```

Initial supported precision:

- Calories: at most 3 decimal places.
- Nutrients in grams: at most 3 decimal places.
- Solid amounts in grams: at most 3 decimal places.
- Liquid amounts in millilitres: at most 3 decimal places.
- Portion counts: at most 3 decimal places.

Trailing zeroes do not affect the stored value. For example, `1.5`, `1.50`, and `1.500` all become `1500` milli-portions.

## Entered Food Basis

A food stores the exact basis used for data entry:

```text
basis_amount
energy_mkcal_per_basis
protein_mg_per_basis
carbs_mg_per_basis
fat_mg_per_basis
additional_nutrition_per_basis
```

For a label that gives nutrition per 250 g, store a `250000 mg` basis and the nutrition printed for that 250 g. Do not first convert it to values per 100 g.

Example:

```text
Label basis: 250 g
Calories:    342 kcal
Protein:     52.5 g
Carbs:       0 g
Fat:         12.5 g

Stored basis_amount:             250000 mg
Stored energy_mkcal_per_basis:   342000 mkcal
Stored protein_mg_per_basis:      52500 mg
Stored carbs_mg_per_basis:            0 mg
Stored fat_mg_per_basis:          12500 mg
```

## Portion Resolution

The available portion kinds are:

- `unit`: 1 g (`1000 mg`) for solids or 1 ml (`1000 ul`) for liquids.
- `hundred`: 100 g (`100000 mg`) for solids or 100 ml (`100000 ul`) for liquids.
- `serving`: the food's optional exact serving amount.
- `container`: the food's optional exact container amount.

Each choice resolves to a `portion_amount` in the food's storage unit. The entered count is stored as `portion_count_milli`.

```text
resolved_amount = round_half_up(
  portion_amount * portion_count_milli / 1000
)
```

All operands are integers. `resolved_amount` must be greater than zero.

Example:

```text
portion kind:         hundred
portion amount:       100000 mg
entered count:        2.5
portion count stored: 2500 milli-portions

resolved amount = round_half_up(100000 * 2500 / 1000)
                = 250000 mg
                = 250 g
```

Rounding the resolved amount matters only when a fractional portion produces part of one storage unit. For example, `0.333 × 1 ml` resolves exactly to `333 ul` and is valid. A result below half a microlitre rounds to `0 ul` and is invalid because every resolved amount must be positive.

## Nutrition Scaling

After resolving the amount, calculate each nutrient independently:

```text
entry_value = round_half_up(
  value_per_basis * resolved_amount / basis_amount
)
```

Use the equation independently for energy in `mkcal`, core macros in `mg`, and each optional nutrient—including fibre and sodium—in `mg`.

Do not calculate calories from the macro results. Do not force label calories to agree with them.

Using the 250 g mince example, logging 150 g gives:

```text
energy  = round_half_up(342000 * 150000 / 250000) = 205200 mkcal
protein = round_half_up( 52500 * 150000 / 250000) =  31500 mg
carbs   = round_half_up(     0 * 150000 / 250000) =      0 mg
fat     = round_half_up( 12500 * 150000 / 250000) =   7500 mg
```

Displayed with normal adjuster precision, this is `205.2 kcal`, `31.5 g` protein, `0 g` carbohydrate, and `7.5 g` fat.

## Rounding Rule

All stored inputs and calculated values are non-negative integers. "Round half up" means:

```text
round_half_up(numerator / denominator)
  = floor((numerator + floor(denominator / 2)) / denominator)
```

Examples:

```text
10 / 4 = 2.5  -> 3
11 / 4 = 2.75 -> 3
 9 / 4 = 2.25 -> 2
```

The implementation must use integer arithmetic with enough range for intermediate multiplication. JavaScript `bigint` is recommended inside calculation functions, followed by a checked conversion to the integer type accepted by SQLite/Drizzle. An out-of-range result must fail validation instead of losing precision.

The calculation order is deliberate:

1. Parse and store the portion count exactly at milli-portion precision.
2. Calculate and round `resolved_amount` to the food's storage unit.
3. Treat `resolved_amount` as the authoritative logged amount.
4. Scale each nutrition value from that amount.
5. Round each calculated nutrition value once to `mkcal` or `mg`.

Do not normalize a food to 100 g/ml first. Do not use formatted display values as inputs to another calculation.

## Daily and Meal Totals

Meal and daily consumed totals are sums of the non-deleted diary-entry snapshot integers:

```text
meal_total_nutrient = sum(entry_nutrient)
day_total_nutrient  = sum(entry_nutrient)
```

Sum stored integers first and format only the final result. Do not add already rounded display strings. This can make a displayed daily total differ by one display unit from the visible sum of individually rounded rows; the daily total remains authoritative.

For each target:

```text
difference = target - consumed
```

- If `difference >= 0`, display it as remaining.
- If `difference < 0`, display `abs(difference)` as over.

The applicable target is the latest nutrition goal whose `effective_from` date is on or before the diary date.

## Display Formatting

Display formatting does not alter stored values. Initial defaults:

- Compact calorie values: nearest whole kcal.
- Amount Adjuster calorie preview: up to 1 decimal place when needed.
- Macronutrients in compact and preview views: up to 1 decimal gram when needed.
- Solid amounts: up to 3 decimal grams, with insignificant trailing zeroes removed.
- Liquid amounts: up to 3 decimal ml, with insignificant trailing zeroes removed.

Display rounding also uses half-up behavior. Values such as `12.0 g` may be displayed as `12 g`; this is formatting only.

## Logging, Editing, and Quick Add

Creating a diary entry snapshots the current food identity and entered-basis nutrition, selected portion representation, resolved amount, and independently calculated nutrition totals.

Editing an entry starts from its snapshotted portion representation. Recalculate it from its snapshotted basis values, not from a reusable food that may have changed since it was logged.

Quick Add reuses the most recent portion representation and amount for that food, but creates a new snapshot using the reusable food's current basis and nutrition. Correcting a reusable food affects future logs, including Quick Add, but never historical entries.

## Required Test Vectors

The shared nutrition math implementation must cover at least:

- exact whole-number scaling;
- scaling below and above one basis amount;
- results immediately below half, exactly at half, and immediately above half;
- arbitrary entered bases such as 30 g, 250 g, and 330 ml;
- zero macro and optional-nutrient values;
- label calories that do not agree with macro-derived energy;
- maximum accepted decimal precision;
- rejection of excess precision and invalid numeric syntax;
- a portion that rounds to zero resolved amount;
- overflow detection during intermediate multiplication;
- meal/day totals summed before display formatting;
- edit calculations from snapshot values;
- Quick Add calculations from current reusable-food values.
