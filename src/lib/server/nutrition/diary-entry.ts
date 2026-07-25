import type { MealSlot, PortionKind } from "$lib/nutrition/constants";
import {
  calculateFoodLog,
  scaleAdditionalNutrition,
  scaleNutritionForStorage,
  type PortionDefinition
} from "$lib/nutrition/food-log-calculation";
import {
  parsePortionCountToMilli,
  resolvePortionAmount,
  toSafeInteger
} from "$lib/nutrition/math";
import type { EditDiaryEntryInput, LogFoodInput } from "$lib/nutrition/portion-input";
import type { DiaryLog, Food, NewDiaryLog } from "$lib/server/db/schema";

export { resolvePortionDefinition } from "$lib/nutrition/food-log-calculation";

export interface ExactDiaryLogInput {
  diaryDate: string;
  mealSlot: MealSlot;
  resolvedAmount: number;
  portionKind: PortionKind;
  portionLabel: string;
  portionAmount: number;
  portionCountMilli: number;
  sourceShortcutId: string;
  shortcutBatchId: string;
  loggedAt?: Date;
}

export function resolveDiaryEntryPortionDefinition(
  entry: DiaryLog,
  portionKind: PortionKind
): PortionDefinition {
  const displayUnit = entry.amountUnit === 'mg' ? 'g' : 'ml';

  if (portionKind === 'unit') {
    return {
      label: `1 ${displayUnit}`,
      amount: 1_000n
    };
  }

  if (portionKind === 'hundred') {
    return {
      label: `100 ${displayUnit}`,
      amount: 100_000n
    };
  }

  if (portionKind !== entry.portionKind) {
    throw new RangeError(
      `Diary entry does not contain a ${portionKind} portion snapshot`
    );
  }

  return {
    label: entry.portionLabel,
    amount: BigInt(entry.portionAmount)
  };
}

export function buildDiaryLogValues(
  food: Food,
  input: LogFoodInput
): NewDiaryLog {
  if (food.deletedAt !== null) {
    throw new RangeError(
      'Cannot log an archived food'
    );
  }

  const calculation = calculateFoodLog(
    {
      ...food,
      additionalNutrition: food.additionalNutritionJson
    },
    input
  );

  return {
    userId: food.userId,
    foodId: food.id,

    diaryDate: input.diaryDate,
    mealSlot: input.mealSlot,
    clientMutationId: input.clientMutationId,

    foodName: food.name,
    foodBrand: food.brand,
    amountUnit: food.amountUnit,
    basisAmount: food.basisAmount,

    energyMkcalPerBasis: food.energyMkcalPerBasis,
    proteinMgPerBasis: food.proteinMgPerBasis,
    carbsMgPerBasis: food.carbsMgPerBasis,
    fatMgPerBasis: food.fatMgPerBasis,

    additionalNutritionPerBasisJson: food.additionalNutritionJson,

    portionKind: input.portionKind,
    portionLabel: calculation.portionLabel,
    portionAmount: calculation.portionAmount,
    portionCountMilli: calculation.portionCountMilli,
    resolvedAmount: calculation.resolvedAmount,

    energyMkcal: calculation.energyMkcal,
    proteinMg: calculation.proteinMg,
    carbsMg: calculation.carbsMg,
    fatMg: calculation.fatMg,

    additionalNutritionTotalJson: calculation.additionalNutritionTotal
  };
}

export function buildDiaryLogValuesForExactAmount(
  food: Food,
  input: ExactDiaryLogInput
): NewDiaryLog {
  if (food.deletedAt !== null) {
    throw new RangeError('Cannot log an archived food');
  }

  const resolvedAmount = BigInt(input.resolvedAmount);
  const portionAmount = BigInt(input.portionAmount);
  const portionCountMilli = BigInt(input.portionCountMilli);

  if (resolvedAmount <= 0n || portionAmount <= 0n || portionCountMilli <= 0n) {
    throw new RangeError('Shortcut portions must resolve to a positive amount');
  }

  if (resolvePortionAmount(portionAmount, portionCountMilli) !== resolvedAmount) {
    throw new RangeError('Shortcut portion does not match its exact amount');
  }

  return {
    userId: food.userId,
    foodId: food.id,
    diaryDate: input.diaryDate,
    mealSlot: input.mealSlot,
    sourceShortcutId: input.sourceShortcutId,
    shortcutBatchId: input.shortcutBatchId,
    foodName: food.name,
    foodBrand: food.brand,
    amountUnit: food.amountUnit,
    basisAmount: food.basisAmount,
    energyMkcalPerBasis: food.energyMkcalPerBasis,
    proteinMgPerBasis: food.proteinMgPerBasis,
    carbsMgPerBasis: food.carbsMgPerBasis,
    fatMgPerBasis: food.fatMgPerBasis,
    additionalNutritionPerBasisJson: food.additionalNutritionJson,
    portionKind: input.portionKind,
    portionLabel: input.portionLabel,
    portionAmount: input.portionAmount,
    portionCountMilli: input.portionCountMilli,
    resolvedAmount: input.resolvedAmount,
    energyMkcal: scaleNutritionForStorage(
      food.energyMkcalPerBasis,
      resolvedAmount,
      food.basisAmount
    ),
    proteinMg: scaleNutritionForStorage(
      food.proteinMgPerBasis,
      resolvedAmount,
      food.basisAmount
    ),
    carbsMg: scaleNutritionForStorage(
      food.carbsMgPerBasis,
      resolvedAmount,
      food.basisAmount
    ),
    fatMg: scaleNutritionForStorage(
      food.fatMgPerBasis,
      resolvedAmount,
      food.basisAmount
    ),
    additionalNutritionTotalJson: scaleAdditionalNutrition(
      food.additionalNutritionJson,
      resolvedAmount,
      food.basisAmount
    ),
    loggedAt: input.loggedAt
  };
}

export function buildDiaryLogUpdateValues(
  entry: DiaryLog,
  input: EditDiaryEntryInput,
  updatedAt = new Date()
): Partial<NewDiaryLog> {
  if (entry.deletedAt !== null) {
    throw new RangeError(
      'Cannot edit a deleted diary entry'
    );
  }

  const portion = resolveDiaryEntryPortionDefinition(
    entry,
    input.portionKind
  );
  const portionCountMilli = parsePortionCountToMilli(input.portionCount);
  const resolvedAmount = resolvePortionAmount(portion.amount, portionCountMilli);

  return {
    diaryDate: input.diaryDate,
    mealSlot: input.mealSlot,
    portionKind: input.portionKind,
    portionLabel: portion.label,
    portionAmount: toSafeInteger(portion.amount),
    portionCountMilli: toSafeInteger(portionCountMilli),
    resolvedAmount: toSafeInteger(resolvedAmount),
    energyMkcal: scaleNutritionForStorage(
      entry.energyMkcalPerBasis,
      resolvedAmount,
      entry.basisAmount
    ),
    proteinMg: scaleNutritionForStorage(
      entry.proteinMgPerBasis,
      resolvedAmount,
      entry.basisAmount
    ),
    carbsMg: scaleNutritionForStorage(
      entry.carbsMgPerBasis,
      resolvedAmount,
      entry.basisAmount
    ),
    fatMg: scaleNutritionForStorage(
      entry.fatMgPerBasis,
      resolvedAmount,
      entry.basisAmount
    ),
    additionalNutritionTotalJson: scaleAdditionalNutrition(
      entry.additionalNutritionPerBasisJson,
      resolvedAmount,
      entry.basisAmount
    ),
    updatedAt
  };
}
