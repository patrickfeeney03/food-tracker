import { editFoodSchema, type EditFoodFormInput } from '$lib/nutrition/food-input';
import { formatStoredValue } from '$lib/nutrition/math';
import type { AppDatabase, ReadDatabase } from '$lib/server/db/connection';
import { foods, mealShortcutItems, type Food } from '$lib/server/db/schema';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { mapFoodInput } from './food-mapper';
import { atomicBatch, isAtomicGuardError, isConstraintError } from '$lib/server/db/atomic';

export class FoodNotFoundError extends Error {
  constructor() {
    super('Food not found');
    this.name = 'FoodNotFoundError';
  }
}

export class FoodEditConflictError extends Error {
  constructor() {
    super('This food changed elsewhere. Reload the page before saving again.');
    this.name = 'FoodEditConflictError';
  }
}

export class FoodBarcodeConflictError extends Error {
  constructor() {
    super('This barcode is already assigned to another active food.');
    this.name = 'FoodBarcodeConflictError';
  }
}

export class FoodAmountUnitConflictError extends Error {
  constructor() {
    super('The g/ml unit cannot change while this food is used by a meal shortcut.');
    this.name = 'FoodAmountUnitConflictError';
  }
}

export async function getActiveFoodForEdit(
  db: ReadDatabase,
  userId: string,
  foodId: string
): Promise<Food | undefined> {
  return db
    .select()
    .from(foods)
    .where(
      and(
        eq(foods.id, foodId),
        eq(foods.userId, userId),
        isNull(foods.deletedAt)
      )
    )
    .get();
}

function formatOptional(value: number | null, fractionalDigits = 3): string {
  return value === null
    ? ''
    : formatStoredValue(BigInt(value), fractionalDigits);
}

function formatOptionalMilligrams(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function formatFoodForEdit(food: Food): EditFoodFormInput {
  const additional = food.additionalNutritionJson ?? {};

  return {
    name: food.name,
    brand: food.brand ?? '',
    barcode: food.barcode ?? '',
    amountUnit: food.amountUnit,
    basisAmount: formatStoredValue(BigInt(food.basisAmount), 3),
    servingAmount: formatOptional(food.servingAmount),
    containerAmount: formatOptional(food.containerAmount),
    energyKcal: formatStoredValue(BigInt(food.energyMkcalPerBasis), 3),
    fatG: formatStoredValue(BigInt(food.fatMgPerBasis), 3),
    saturatedFatG: formatOptional(additional.saturatedFatMg ?? null),
    carbsG: formatStoredValue(BigInt(food.carbsMgPerBasis), 3),
    sugarG: formatOptional(additional.sugarMg ?? null),
    fibreG: formatOptional(additional.fibreMg ?? null),
    proteinG: formatStoredValue(BigInt(food.proteinMgPerBasis), 3),
    sodiumMg: formatOptionalMilligrams(additional.sodiumMg),
    potassiumMg: formatOptionalMilligrams(additional.potassiumMg),
    notes: food.notes ?? '',
    expectedUpdatedAt: String(food.updatedAt.getTime())
  };
}

async function barcodeBelongsToAnotherFood(
  db: ReadDatabase,
  userId: string,
  foodId: string,
  barcode: string
): Promise<boolean> {
  if (barcode === '') return false;

  return (await db
    .select({ id: foods.id })
    .from(foods)
    .where(
      and(
        eq(foods.userId, userId),
        eq(foods.barcode, barcode),
        ne(foods.id, foodId),
        isNull(foods.deletedAt)
      )
    )
    .get()) !== undefined;
}

export async function updateFood(
  db: AppDatabase,
  userId: string,
  foodId: string,
  rawInput: unknown
): Promise<Food> {
  const input = editFoodSchema.parse(rawInput);
  const expectedUpdatedAt = Number(input.expectedUpdatedAt);

  if (!Number.isSafeInteger(expectedUpdatedAt)) {
    throw new FoodEditConflictError();
  }

  const updatedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));

  try {
      const currentFood = await getActiveFoodForEdit(db, userId, foodId);
      if (currentFood === undefined) throw new FoodNotFoundError();

      if (input.amountUnit !== currentFood.amountUnit && (await db.select({ id: mealShortcutItems.id }).from(mealShortcutItems).where(and(eq(mealShortcutItems.userId, userId), eq(mealShortcutItems.foodId, foodId))).limit(1).get()) !== undefined) {
        throw new FoodAmountUnitConflictError();
      }

      if (await barcodeBelongsToAnotherFood(db, userId, foodId, input.barcode)) {
        throw new FoodBarcodeConflictError();
      }

      const guards = [sql`exists (select 1 from foods where id = ${foodId} and user_id = ${userId} and updated_at = ${expectedUpdatedAt} and deleted_at is null)`];
      if (input.amountUnit !== currentFood.amountUnit) {
        guards.push(sql`not exists (select 1 from meal_shortcut_items where user_id = ${userId} and food_id = ${foodId})`);
      }
      const [updatedRows] = await atomicBatch(db, guards, [db
        .update(foods)
        .set({
          ...mapFoodInput(input),
          updatedAt
        })
        .where(
          and(
            eq(foods.id, foodId),
            eq(foods.userId, userId),
            isNull(foods.deletedAt),
            eq(foods.updatedAt, new Date(expectedUpdatedAt))
          )
        )
        .returning()]);
      const updated = updatedRows[0];

      if (updated !== undefined) return updated;
      if (await getActiveFoodForEdit(db, userId, foodId) === undefined) {
        throw new FoodNotFoundError();
      }
      throw new FoodEditConflictError();
  } catch (caught) {
    if (isAtomicGuardError(caught)) {
      const current = await getActiveFoodForEdit(db, userId, foodId);
      if (current === undefined) throw new FoodNotFoundError();
      if (input.amountUnit !== current.amountUnit && await db.select({ id: mealShortcutItems.id }).from(mealShortcutItems).where(and(eq(mealShortcutItems.userId, userId), eq(mealShortcutItems.foodId, foodId))).limit(1).get()) throw new FoodAmountUnitConflictError();
      throw new FoodEditConflictError();
    }
    if (isConstraintError(caught)) throw new FoodBarcodeConflictError();
    throw caught;
  }

}

export async function archiveFood(
  db: AppDatabase,
  userId: string,
  foodId: string,
  expectedUpdatedAtText: string
): Promise<Food> {
  const expectedUpdatedAt = Number(expectedUpdatedAtText);

  if (!Number.isSafeInteger(expectedUpdatedAt)) {
    throw new FoodEditConflictError();
  }

  const archivedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));
  const archived = await db
    .update(foods)
    .set({
      deletedAt: archivedAt,
      updatedAt: archivedAt
    })
    .where(
      and(
        eq(foods.id, foodId),
        eq(foods.userId, userId),
        isNull(foods.deletedAt),
        eq(foods.updatedAt, new Date(expectedUpdatedAt))
      )
    )
    .returning()
    .get();

  if (archived !== undefined) return archived;

  if (await getActiveFoodForEdit(db, userId, foodId) === undefined) {
    throw new FoodNotFoundError();
  }

  throw new FoodEditConflictError();
}
