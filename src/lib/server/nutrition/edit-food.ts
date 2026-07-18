import { editFoodSchema, type EditFoodFormInput } from '$lib/nutrition/food-input';
import { formatStoredValue } from '$lib/nutrition/math';
import type { DatabaseConnection } from '$lib/server/db/connection';
import { foods, type Food } from '$lib/server/db/schema';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { mapFoodInput } from './food-mapper';

type AppDatabase = DatabaseConnection['db'];

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

export function getActiveFoodForEdit(
  db: AppDatabase,
  userId: string,
  foodId: string
): Food | undefined {
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
    proteinG: formatStoredValue(BigInt(food.proteinMgPerBasis), 3),
    carbsG: formatStoredValue(BigInt(food.carbsMgPerBasis), 3),
    fatG: formatStoredValue(BigInt(food.fatMgPerBasis), 3),
    fibreG: formatOptional(additional.fibreMg ?? null),
    sugarG: formatOptional(additional.sugarMg ?? null),
    saturatedFatG: formatOptional(additional.saturatedFatMg ?? null),
    sodiumMg: formatOptionalMilligrams(additional.sodiumMg),
    potassiumMg: formatOptionalMilligrams(additional.potassiumMg),
    notes: food.notes ?? '',
    expectedUpdatedAt: String(food.updatedAt.getTime())
  };
}

function barcodeBelongsToAnotherFood(
  db: AppDatabase,
  userId: string,
  foodId: string,
  barcode: string
): boolean {
  if (barcode === '') return false;

  return db
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
    .get() !== undefined;
}

function isUniqueConstraintError(caught: unknown): boolean {
  return (
    caught instanceof Error &&
    'code' in caught &&
    String(caught.code).startsWith('SQLITE_CONSTRAINT')
  );
}

export function updateFood(
  db: AppDatabase,
  userId: string,
  foodId: string,
  rawInput: unknown
): Food {
  const input = editFoodSchema.parse(rawInput);
  const expectedUpdatedAt = Number(input.expectedUpdatedAt);

  if (!Number.isSafeInteger(expectedUpdatedAt)) {
    throw new FoodEditConflictError();
  }

  if (barcodeBelongsToAnotherFood(db, userId, foodId, input.barcode)) {
    throw new FoodBarcodeConflictError();
  }

  const updatedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));

  try {
    const updated = db
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
      .returning()
      .get();

    if (updated !== undefined) return updated;
  } catch (caught) {
    if (isUniqueConstraintError(caught)) {
      throw new FoodBarcodeConflictError();
    }
    throw caught;
  }

  if (getActiveFoodForEdit(db, userId, foodId) === undefined) {
    throw new FoodNotFoundError();
  }

  throw new FoodEditConflictError();
}

export function archiveFood(
  db: AppDatabase,
  userId: string,
  foodId: string,
  expectedUpdatedAtText: string
): Food {
  const expectedUpdatedAt = Number(expectedUpdatedAtText);

  if (!Number.isSafeInteger(expectedUpdatedAt)) {
    throw new FoodEditConflictError();
  }

  const archivedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));
  const archived = db
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

  if (getActiveFoodForEdit(db, userId, foodId) === undefined) {
    throw new FoodNotFoundError();
  }

  throw new FoodEditConflictError();
}
