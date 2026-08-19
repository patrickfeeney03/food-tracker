export type MealShortcutResult = {
  id: string;
  name: string;
  itemCount: number;
  blocked: boolean;
  energyMkcal: number | null;
};

export type MealShortcutEditorItem = {
  key: string;
  itemId?: string;
  sourceEntryId?: string;
  foodId: string | null;
  foodName: string;
  foodBrand: string | null;
  amountUnit: 'mg' | 'ul' | null;
  amount: string;
  blocked: boolean;
  blockedReason?: string;
};

export type MealShortcutPickerFood = {
  id: string;
  name: string;
  brand: string | null;
  amountUnit: 'mg' | 'ul';
  suggestedAmount: number;
};
