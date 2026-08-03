import type {
  AmountUnit,
  MealSlot,
  PortionKind
} from '$lib/nutrition/constants';
import type { LogFoodInput } from '$lib/nutrition/portion-input';

export interface OfflineAdditionalNutrition {
  fibreMg?: number;
  sugarMg?: number;
  saturatedFatMg?: number;
  sodiumMg?: number;
  potassiumMg?: number;
}

export interface OfflineCoreNutrition {
  energyMkcal: number;
  proteinMg: number;
  carbsMg: number;
  fatMg: number;
}

export interface OfflineNutritionBalance {
  consumed: number;
  target: number;
  remaining: number;
  over: number;
}

export interface OfflineDiaryBalances {
  energyMkcal: OfflineNutritionBalance;
  proteinMg: OfflineNutritionBalance;
  carbsMg: OfflineNutritionBalance;
  fatMg: OfflineNutritionBalance;
}

export interface OfflineNutritionGoal {
  id: string;
  effectiveFrom: string;
  targetEnergyMkcal: number;
  targetProteinMg: number;
  targetCarbsMg: number;
  targetFatMg: number;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineDiaryEntry extends OfflineCoreNutrition {
  id: string;
  foodId: string | null;
  diaryDate: string;
  mealSlot: MealSlot;
  sourceShortcutId: string | null;
  shortcutBatchId: string | null;
  clientMutationId: string | null;
  foodName: string;
  foodBrand: string | null;
  amountUnit: AmountUnit;
  basisAmount: number;
  energyMkcalPerBasis: number;
  proteinMgPerBasis: number;
  carbsMgPerBasis: number;
  fatMgPerBasis: number;
  additionalNutritionPerBasis: OfflineAdditionalNutrition | null;
  portionKind: PortionKind;
  portionLabel: string;
  portionAmount: number;
  portionCountMilli: number;
  resolvedAmount: number;
  additionalNutritionTotal: OfflineAdditionalNutrition | null;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineMealSummary {
  slot: MealSlot;
  entries: OfflineDiaryEntry[];
  totals: OfflineCoreNutrition;
}

export interface OfflineDiaryDay {
  date: string;
  goal: OfflineNutritionGoal | null;
  meals: Record<MealSlot, OfflineMealSummary>;
  totals: OfflineCoreNutrition;
  balances: OfflineDiaryBalances | null;
}

export interface OfflineLatestFoodUse extends OfflineCoreNutrition {
  diaryEntryId: string;
  loggedAt: string;
  amountUnit: AmountUnit;
  portionKind: PortionKind;
  portionLabel: string;
  portionAmount: number;
  portionCountMilli: number;
  resolvedAmount: number;
  additionalNutritionTotal: OfflineAdditionalNutrition | null;
}

export interface OfflineFood {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  amountUnit: AmountUnit;
  basisAmount: number;
  servingAmount: number | null;
  containerAmount: number | null;
  energyMkcalPerBasis: number;
  proteinMgPerBasis: number;
  carbsMgPerBasis: number;
  fatMgPerBasis: number;
  additionalNutrition: OfflineAdditionalNutrition | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  latestUse: OfflineLatestFoodUse | null;
}

export interface TrackerSnapshot {
  schemaVersion: 1;
  user: {
    id: string;
    name: string;
  };
  savedAt: number;
  diaryDays: Record<string, OfflineDiaryDay>;
  foods: OfflineFood[];
}

export interface OfflineMutationFailure {
  code: string;
  message: string;
}

export interface OfflineLogExistingFoodMutation {
  userId: string;
  clientMutationId: string;
  kind: 'log-existing-food';
  foodId: string;
  input: LogFoodInput;
  createdAt: number;
  state: 'pending' | 'failed';
  failure?: OfflineMutationFailure;
}

export type OfflineMutation = OfflineLogExistingFoodMutation;
