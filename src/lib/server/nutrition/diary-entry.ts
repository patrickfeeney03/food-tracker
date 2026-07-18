import type { PortionKind } from "$lib/nutrition/constants";
import { parsePortionCountToMilli, resolvePortionAmount, scaleNutritionValue, toSafeInteger } from "$lib/nutrition/math";
import type { EditDiaryEntryInput, LogFoodInput } from "$lib/nutrition/portion-input";
import type { AdditionalNutrition, DiaryLog, Food, NewDiaryLog } from "$lib/server/db/schema";

export interface PortionDefinition {
  label: string;
  amount: bigint;
}

export function resolvePortionDefinition(
  food: Food,
  portionKind: PortionKind
): PortionDefinition {
  const displayUnit = food.amountUnit === 'mg' ? 'g' : 'ml';

  switch (portionKind) {
    case 'unit':
      return {
        label: `1 ${displayUnit}`,
        amount: 1_000n
      }

    case 'hundred':
      return {
        label: `100 ${displayUnit}`,
        amount: 100_000n
      }

    case 'serving':
      if (food.servingAmount === null) {
        throw new RangeError(
          'Food does not define a serving amount'
        );
      }

      return {
        label: `Serving`,
        amount: BigInt(food.servingAmount)
      };

    case 'container':
      if (food.containerAmount === null) {
        throw new RangeError(
          'Food does not define a container amount'
        );
      }

      return {
        label: 'Container',
        amount: BigInt(food.containerAmount)
      };
  }
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

function scaleForStorage(
  valuePerBasis: number,
  resolvedAmount: bigint,
  basisAmount: number
): number {
  return toSafeInteger(
    scaleNutritionValue(
      BigInt(valuePerBasis),
      resolvedAmount,
      BigInt(basisAmount)
    )
  );
}

function scaleAdditionalNutrition(
  valuesPerBasis: AdditionalNutrition | null,
  resolvedAmount: bigint,
  basisAmount: number
): AdditionalNutrition | null {
  if (valuesPerBasis === null) {
    return null;
  }

  const totals: AdditionalNutrition = {};

  if (valuesPerBasis.fibreMg !== undefined) {
    totals.fibreMg = scaleForStorage(
      valuesPerBasis.fibreMg,
      resolvedAmount,
      basisAmount
    );
  }

  if (valuesPerBasis.sugarMg !== undefined) {
    totals.sugarMg = scaleForStorage(
      valuesPerBasis.sugarMg,
      resolvedAmount,
      basisAmount
    );
  }

  if (valuesPerBasis.saturatedFatMg !== undefined) {
    totals.saturatedFatMg = scaleForStorage(
      valuesPerBasis.saturatedFatMg,
      resolvedAmount,
      basisAmount
    );
  }

  if (valuesPerBasis.sodiumMg !== undefined) {
    totals.sodiumMg = scaleForStorage(
      valuesPerBasis.sodiumMg,
      resolvedAmount,
      basisAmount
    );
  }

  if (valuesPerBasis.potassiumMg !== undefined) {
    totals.potassiumMg = scaleForStorage(
      valuesPerBasis.potassiumMg,
      resolvedAmount,
      basisAmount
    );
  }

  return totals;
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

  const portion = resolvePortionDefinition(
    food,
    input.portionKind
  );

  const portionCountMilli = parsePortionCountToMilli(input.portionCount);

  const resolvedAmount = resolvePortionAmount(portion.amount, portionCountMilli);

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
    portionLabel: portion.label,
    portionAmount: toSafeInteger(portion.amount),
    portionCountMilli: toSafeInteger(portionCountMilli),
    resolvedAmount: toSafeInteger(resolvedAmount),

    energyMkcal: scaleForStorage(
      food.energyMkcalPerBasis,
      resolvedAmount,
      food.basisAmount
    ),

    proteinMg: scaleForStorage(
      food.proteinMgPerBasis,
      resolvedAmount,
      food.basisAmount
    ),

    carbsMg: scaleForStorage(
      food.carbsMgPerBasis,
      resolvedAmount,
      food.basisAmount
    ),

    fatMg: scaleForStorage(
      food.fatMgPerBasis,
      resolvedAmount,
      food.basisAmount
    ),

    additionalNutritionTotalJson: scaleAdditionalNutrition(
      food.additionalNutritionJson,
      resolvedAmount,
      food.basisAmount
    )
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
    energyMkcal: scaleForStorage(
      entry.energyMkcalPerBasis,
      resolvedAmount,
      entry.basisAmount
    ),
    proteinMg: scaleForStorage(
      entry.proteinMgPerBasis,
      resolvedAmount,
      entry.basisAmount
    ),
    carbsMg: scaleForStorage(
      entry.carbsMgPerBasis,
      resolvedAmount,
      entry.basisAmount
    ),
    fatMg: scaleForStorage(
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
