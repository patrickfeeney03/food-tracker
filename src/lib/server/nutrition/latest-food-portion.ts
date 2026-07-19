import type { PortionKind } from '$lib/nutrition/constants';
import { formatStoredValue } from '$lib/nutrition/math';

type CurrentFoodPortions = {
  amountUnit: 'mg' | 'ul';
  servingAmount: number | null;
  containerAmount: number | null;
};

export type LatestFoodUse = {
  amountUnit: 'mg' | 'ul';
  portionKind: PortionKind;
  portionAmount: number;
  portionCountMilli: number;
  resolvedAmount: number;
};

export type ReplayableFoodPortion = {
  portionKind: PortionKind;
  portionCount: string;
};

function currentPortionAmount(
  food: CurrentFoodPortions,
  portionKind: PortionKind
): number | null {
  switch (portionKind) {
    case 'unit':
      return 1_000;
    case 'hundred':
      return 100_000;
    case 'serving':
      return food.servingAmount;
    case 'container':
      return food.containerAmount;
  }
}

export function replayLatestFoodPortion(
  food: CurrentFoodPortions,
  latestUse: LatestFoodUse
): ReplayableFoodPortion | null {
  if (food.amountUnit !== latestUse.amountUnit) {
    return null;
  }

  if (currentPortionAmount(food, latestUse.portionKind) === latestUse.portionAmount) {
    return {
      portionKind: latestUse.portionKind,
      portionCount: formatStoredValue(BigInt(latestUse.portionCountMilli), 3)
    };
  }

  return {
    portionKind: 'unit',
    portionCount: formatStoredValue(BigInt(latestUse.resolvedAmount), 3)
  };
}
