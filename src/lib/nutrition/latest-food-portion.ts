import type { PortionKind } from './constants';
import {
  resolvePortionDefinition,
  type PortionFood
} from './food-log-calculation';
import { formatStoredValue, toSafeInteger } from './math';

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
  food: PortionFood,
  portionKind: PortionKind
): number | null {
  try {
    return toSafeInteger(resolvePortionDefinition(food, portionKind).amount);
  } catch {
    return null;
  }
}

export function replayLatestFoodPortion(
  food: PortionFood,
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
