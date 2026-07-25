import type { AmountUnit, PortionKind } from './constants';
import {
  parsePortionCountToMilli,
  resolvePortionAmount,
  scaleNutritionValue,
  toSafeInteger
} from './math';

export interface AdditionalNutritionValues {
  fibreMg?: number;
  sugarMg?: number;
  saturatedFatMg?: number;
  sodiumMg?: number;
  potassiumMg?: number;
}

export interface PortionDefinition {
  label: string;
  amount: bigint;
}

export interface PortionFood {
  amountUnit: AmountUnit;
  servingAmount: number | null;
  containerAmount: number | null;
}

export interface NutritionFood extends PortionFood {
  basisAmount: number;
  energyMkcalPerBasis: number;
  proteinMgPerBasis: number;
  carbsMgPerBasis: number;
  fatMgPerBasis: number;
  additionalNutrition: AdditionalNutritionValues | null;
}

export interface FoodLogCalculation {
  portionLabel: string;
  portionAmount: number;
  portionCountMilli: number;
  resolvedAmount: number;
  energyMkcal: number;
  proteinMg: number;
  carbsMg: number;
  fatMg: number;
  additionalNutritionTotal: AdditionalNutritionValues | null;
}

export function resolvePortionDefinition(
  food: PortionFood,
  portionKind: PortionKind
): PortionDefinition {
  const displayUnit = food.amountUnit === 'mg' ? 'g' : 'ml';

  switch (portionKind) {
    case 'unit':
      return {
        label: `1 ${displayUnit}`,
        amount: 1_000n
      };

    case 'hundred':
      return {
        label: `100 ${displayUnit}`,
        amount: 100_000n
      };

    case 'serving':
      if (food.servingAmount === null) {
        throw new RangeError(
          'Food does not define a serving amount'
        );
      }

      return {
        label: 'Serving',
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

export function scaleNutritionForStorage(
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

export function scaleAdditionalNutrition(
  valuesPerBasis: AdditionalNutritionValues | null,
  resolvedAmount: bigint,
  basisAmount: number
): AdditionalNutritionValues | null {
  if (valuesPerBasis === null) {
    return null;
  }

  const totals: AdditionalNutritionValues = {};

  if (valuesPerBasis.fibreMg !== undefined) {
    totals.fibreMg = scaleNutritionForStorage(
      valuesPerBasis.fibreMg,
      resolvedAmount,
      basisAmount
    );
  }

  if (valuesPerBasis.sugarMg !== undefined) {
    totals.sugarMg = scaleNutritionForStorage(
      valuesPerBasis.sugarMg,
      resolvedAmount,
      basisAmount
    );
  }

  if (valuesPerBasis.saturatedFatMg !== undefined) {
    totals.saturatedFatMg = scaleNutritionForStorage(
      valuesPerBasis.saturatedFatMg,
      resolvedAmount,
      basisAmount
    );
  }

  if (valuesPerBasis.sodiumMg !== undefined) {
    totals.sodiumMg = scaleNutritionForStorage(
      valuesPerBasis.sodiumMg,
      resolvedAmount,
      basisAmount
    );
  }

  if (valuesPerBasis.potassiumMg !== undefined) {
    totals.potassiumMg = scaleNutritionForStorage(
      valuesPerBasis.potassiumMg,
      resolvedAmount,
      basisAmount
    );
  }

  return totals;
}

export function calculateFoodLog(
  food: NutritionFood,
  input: {
    portionKind: PortionKind;
    portionCount: string;
  }
): FoodLogCalculation {
  const portion = resolvePortionDefinition(food, input.portionKind);
  const portionCountMilli = parsePortionCountToMilli(input.portionCount);
  const resolvedAmount = resolvePortionAmount(
    portion.amount,
    portionCountMilli
  );

  return {
    portionLabel: portion.label,
    portionAmount: toSafeInteger(portion.amount),
    portionCountMilli: toSafeInteger(portionCountMilli),
    resolvedAmount: toSafeInteger(resolvedAmount),
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
    additionalNutritionTotal: scaleAdditionalNutrition(
      food.additionalNutrition,
      resolvedAmount,
      food.basisAmount
    )
  };
}
