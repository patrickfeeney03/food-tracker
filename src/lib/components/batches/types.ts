import type { MealShortcutPickerFood } from '../meal-shortcuts/types';
import type { MealSlot } from '$lib/nutrition/constants';
import type { BatchNutritionFood } from '$lib/nutrition/batch';

export type BatchResult = {
  id: string;
  name: string;
  portionCount: number;
  loggedCount: number;
  remainingCount: number;
  itemCount: number;
  blocked: boolean;
  perPortionEnergyMkcal: number | null;
  lastPortionDate: string | null;
};

export type BatchPickerFood = MealShortcutPickerFood & BatchNutritionFood;

export type BatchLoggedPortion = { diaryDate: string; mealSlot: MealSlot };
