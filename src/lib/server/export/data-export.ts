import { mealNames, mealSlots, type AmountUnit } from '$lib/nutrition/constants';
import { formatStoredValue } from '$lib/nutrition/math';
import type { AppDatabase } from '$lib/server/db/connection';
import {
  diaryLogs,
  foods,
  mealShortcutItems,
  mealShortcuts,
  nutritionGoals,
  users,
  type AdditionalNutrition
} from '$lib/server/db/schema';
import { parseTheme } from '$lib/server/theme';
import { and, asc, eq, isNull } from 'drizzle-orm';

export const DATA_EXPORT_FORMAT_VERSION = 1;
export const DATA_EXPORT_TIME_ZONE = 'Europe/Dublin';

function toIsoString(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

function energyValue(value: number) {
  return {
    mkcal: value,
    kcal: formatStoredValue(BigInt(value), 3)
  };
}

function nutrientValue(value: number) {
  return {
    mg: value,
    g: formatStoredValue(BigInt(value), 3)
  };
}

function amountValue(value: number, unit: AmountUnit) {
  return {
    storageValue: value,
    storageUnit: unit,
    displayValue: formatStoredValue(BigInt(value), 3),
    displayUnit: unit === 'mg' ? 'g' : 'ml'
  };
}

function optionalAmountValue(value: number | null, unit: AmountUnit) {
  return value === null ? null : amountValue(value, unit);
}

function portionCountValue(value: number) {
  return {
    milli: value,
    value: formatStoredValue(BigInt(value), 3)
  };
}

function additionalNutritionValue(value: AdditionalNutrition | null) {
  return value === null
    ? null
    : {
      fibre: value.fibreMg === undefined ? null : nutrientValue(value.fibreMg),
      sugar: value.sugarMg === undefined ? null : nutrientValue(value.sugarMg),
      saturatedFat:
        value.saturatedFatMg === undefined ? null : nutrientValue(value.saturatedFatMg),
      sodium: value.sodiumMg === undefined ? null : nutrientValue(value.sodiumMg),
      potassium: value.potassiumMg === undefined ? null : nutrientValue(value.potassiumMg)
    };
}

function coreNutritionValue(values: {
  energyMkcal: number;
  proteinMg: number;
  carbsMg: number;
  fatMg: number;
}) {
  return {
    energy: energyValue(values.energyMkcal),
    protein: nutrientValue(values.proteinMg),
    carbohydrate: nutrientValue(values.carbsMg),
    fat: nutrientValue(values.fatMg)
  };
}

function nutritionValue(values: {
  energyMkcal: number;
  proteinMg: number;
  carbsMg: number;
  fatMg: number;
  additionalNutrition: AdditionalNutrition | null;
}) {
  return {
    ...coreNutritionValue(values),
    additional: additionalNutritionValue(values.additionalNutrition)
  };
}

export function buildPortableDataExport(
  database: AppDatabase,
  userId: string,
  exportedAt = new Date()
) {
  return database.transaction((transaction) => {
    const account = transaction
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (account === undefined) {
      throw new Error('Cannot export data for a missing user');
    }

    const goals = transaction
      .select()
      .from(nutritionGoals)
      .where(eq(nutritionGoals.userId, userId))
      .orderBy(asc(nutritionGoals.effectiveFrom), asc(nutritionGoals.id))
      .all();

    const ownedFoods = transaction
      .select()
      .from(foods)
      .where(eq(foods.userId, userId))
      .orderBy(asc(foods.createdAt), asc(foods.id))
      .all();

    const entries = transaction
      .select()
      .from(diaryLogs)
      .where(eq(diaryLogs.userId, userId))
      .orderBy(asc(diaryLogs.diaryDate), asc(diaryLogs.loggedAt), asc(diaryLogs.id))
      .all();

    const shortcuts = transaction
      .select()
      .from(mealShortcuts)
      .where(eq(mealShortcuts.userId, userId))
      .orderBy(asc(mealShortcuts.createdAt), asc(mealShortcuts.id))
      .all();

    const shortcutItems = transaction
      .select()
      .from(mealShortcutItems)
      .where(eq(mealShortcutItems.userId, userId))
      .orderBy(asc(mealShortcutItems.shortcutId), asc(mealShortcutItems.position))
      .all();

    const itemsByShortcut = new Map<string, typeof shortcutItems>();
    for (const item of shortcutItems) {
      const items = itemsByShortcut.get(item.shortcutId) ?? [];
      items.push(item);
      itemsByShortcut.set(item.shortcutId, items);
    }

    return {
      formatVersion: DATA_EXPORT_FORMAT_VERSION,
      exportedAt: exportedAt.toISOString(),
      timezone: DATA_EXPORT_TIME_ZONE,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        theme: parseTheme(account.settingsJson.theme),
        createdAt: toIsoString(account.createdAt),
        updatedAt: toIsoString(account.updatedAt)
      },
      nutritionGoals: goals.map((goal) => ({
        id: goal.id,
        effectiveFrom: goal.effectiveFrom,
        targets: coreNutritionValue({
          energyMkcal: goal.targetEnergyMkcal,
          proteinMg: goal.targetProteinMg,
          carbsMg: goal.targetCarbsMg,
          fatMg: goal.targetFatMg
        }),
        createdAt: toIsoString(goal.createdAt),
        updatedAt: toIsoString(goal.updatedAt)
      })),
      foods: ownedFoods.map((food) => ({
        id: food.id,
        name: food.name,
        brand: food.brand,
        barcode: food.barcode,
        amountUnit: food.amountUnit,
        basisAmount: amountValue(food.basisAmount, food.amountUnit),
        servingAmount: optionalAmountValue(food.servingAmount, food.amountUnit),
        containerAmount: optionalAmountValue(food.containerAmount, food.amountUnit),
        nutritionPerBasis: nutritionValue({
          energyMkcal: food.energyMkcalPerBasis,
          proteinMg: food.proteinMgPerBasis,
          carbsMg: food.carbsMgPerBasis,
          fatMg: food.fatMgPerBasis,
          additionalNutrition: food.additionalNutritionJson
        }),
        notes: food.notes,
        createdAt: toIsoString(food.createdAt),
        updatedAt: toIsoString(food.updatedAt),
        archivedAt: toIsoString(food.deletedAt)
      })),
      diaryEntries: entries.map((entry) => ({
        id: entry.id,
        foodId: entry.foodId,
        diaryDate: entry.diaryDate,
        meal: entry.mealSlot,
        sourceShortcutId: entry.sourceShortcutId,
        food: {
          name: entry.foodName,
          brand: entry.foodBrand
        },
        snapshot: {
          amountUnit: entry.amountUnit,
          basisAmount: amountValue(entry.basisAmount, entry.amountUnit),
          nutritionPerBasis: nutritionValue({
            energyMkcal: entry.energyMkcalPerBasis,
            proteinMg: entry.proteinMgPerBasis,
            carbsMg: entry.carbsMgPerBasis,
            fatMg: entry.fatMgPerBasis,
            additionalNutrition: entry.additionalNutritionPerBasisJson
          })
        },
        portion: {
          kind: entry.portionKind,
          label: entry.portionLabel,
          amount: amountValue(entry.portionAmount, entry.amountUnit),
          count: portionCountValue(entry.portionCountMilli),
          resolvedAmount: amountValue(entry.resolvedAmount, entry.amountUnit)
        },
        nutritionTotal: nutritionValue({
          energyMkcal: entry.energyMkcal,
          proteinMg: entry.proteinMg,
          carbsMg: entry.carbsMg,
          fatMg: entry.fatMg,
          additionalNutrition: entry.additionalNutritionTotalJson
        }),
        loggedAt: toIsoString(entry.loggedAt),
        createdAt: toIsoString(entry.createdAt),
        updatedAt: toIsoString(entry.updatedAt),
        deletedAt: toIsoString(entry.deletedAt)
      })),
      mealShortcuts: shortcuts.map((shortcut) => ({
        id: shortcut.id,
        name: shortcut.name,
        items: (itemsByShortcut.get(shortcut.id) ?? []).map((item) => ({
          id: item.id,
          foodId: item.foodId,
          position: item.position,
          amountUnit: item.amountUnit,
          defaultAmount: amountValue(item.defaultAmount, item.amountUnit),
          defaultPortion:
            item.defaultPortionKind === null ||
              item.defaultPortionLabel === null ||
              item.defaultPortionAmount === null ||
              item.defaultPortionCountMilli === null
              ? null
              : {
                kind: item.defaultPortionKind,
                label: item.defaultPortionLabel,
                amount: amountValue(item.defaultPortionAmount, item.amountUnit),
                count: portionCountValue(item.defaultPortionCountMilli)
              }
        })),
        createdAt: toIsoString(shortcut.createdAt),
        updatedAt: toIsoString(shortcut.updatedAt),
        archivedAt: toIsoString(shortcut.deletedAt)
      }))
    };
  });
}

export type PortableDataExport = ReturnType<typeof buildPortableDataExport>;

function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const diaryCsvHeaders = [
  'diary_date',
  'meal',
  'food_name',
  'food_brand',
  'portion_kind',
  'portion_label',
  'portion_count',
  'resolved_amount',
  'amount_unit',
  'energy_kcal',
  'protein_g',
  'carbohydrate_g',
  'fat_g',
  'fibre_g',
  'sugar_g',
  'saturated_fat_g',
  'sodium_mg',
  'potassium_mg',
  'logged_at_utc'
] as const;

function optionalNutrientGrams(value: number | undefined): string | null {
  return value === undefined ? null : formatStoredValue(BigInt(value), 3);
}

function optionalNutrientMilligrams(value: number | undefined): number | null {
  return value ?? null;
}

export function buildDiaryCsvExport(database: AppDatabase, userId: string) {
  const entries = database
    .select()
    .from(diaryLogs)
    .where(and(eq(diaryLogs.userId, userId), isNull(diaryLogs.deletedAt)))
    .orderBy(asc(diaryLogs.diaryDate), asc(diaryLogs.loggedAt), asc(diaryLogs.id))
    .all();

  const mealOrder = new Map(mealSlots.map((meal, index) => [meal, index]));
  entries.sort((left, right) => {
    const dateOrder = left.diaryDate.localeCompare(right.diaryDate);
    if (dateOrder !== 0) return dateOrder;

    const slotOrder = (mealOrder.get(left.mealSlot) ?? 0) - (mealOrder.get(right.mealSlot) ?? 0);
    if (slotOrder !== 0) return slotOrder;

    const loggedAtOrder = left.loggedAt.getTime() - right.loggedAt.getTime();
    return loggedAtOrder !== 0 ? loggedAtOrder : left.id.localeCompare(right.id);
  });

  const rows = entries.map((entry) => {
    const additional = entry.additionalNutritionTotalJson;

    return [
      entry.diaryDate,
      mealNames[entry.mealSlot],
      entry.foodName,
      entry.foodBrand,
      entry.portionKind,
      entry.portionLabel,
      formatStoredValue(BigInt(entry.portionCountMilli), 3),
      formatStoredValue(BigInt(entry.resolvedAmount), 3),
      entry.amountUnit === 'mg' ? 'g' : 'ml',
      formatStoredValue(BigInt(entry.energyMkcal), 3),
      formatStoredValue(BigInt(entry.proteinMg), 3),
      formatStoredValue(BigInt(entry.carbsMg), 3),
      formatStoredValue(BigInt(entry.fatMg), 3),
      optionalNutrientGrams(additional?.fibreMg),
      optionalNutrientGrams(additional?.sugarMg),
      optionalNutrientGrams(additional?.saturatedFatMg),
      optionalNutrientMilligrams(additional?.sodiumMg),
      optionalNutrientMilligrams(additional?.potassiumMg),
      entry.loggedAt.toISOString()
    ].map(csvCell);
  });

  return {
    content: `\uFEFF${[diaryCsvHeaders.join(','), ...rows.map((row) => row.join(','))].join('\r\n')}\r\n`,
    diaryEntryCount: rows.length
  };
}

export function dataExportResponse(
  body: string,
  contentType: string,
  filename: string
): Response {
  return new Response(body, {
    headers: {
      'cache-control': 'private, no-store',
      'content-disposition': `attachment; filename="${filename}"`,
      'content-type': contentType,
      'x-content-type-options': 'nosniff'
    }
  });
}
