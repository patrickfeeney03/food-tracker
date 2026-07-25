import type { PortionKind } from './constants';
import {
  resolvePortionDefinition,
  type PortionFood
} from './food-log-calculation';
import { toSafeInteger } from './math';

export interface FoodPortionOption {
  kind: PortionKind;
  label: string;
  amount: number;
}

export function portionOptionsForFood(food: PortionFood): FoodPortionOption[] {
  const kinds: PortionKind[] = ['unit', 'hundred'];

  if (food.servingAmount !== null) {
    kinds.push('serving');
  }

  if (food.containerAmount !== null) {
    kinds.push('container');
  }

  return kinds.map((kind) => {
    const portion = resolvePortionDefinition(food, kind);

    return {
      kind,
      label: portion.label,
      amount: toSafeInteger(portion.amount)
    };
  });
}
