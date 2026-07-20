
export const amountUnits = ['mg', 'ul' /* micro liters */] as const;
export const portionKinds = [
  'unit',
  'hundred',
  'serving',
  'container'
] as const;
export const mealSlots = [
  'breakfast',
  'lunch',
  'dinner',
  'snacks'
] as const;

export type AmountUnit = (typeof amountUnits)[number];
export type PortionKind = (typeof portionKinds)[number];
export type MealSlot = (typeof mealSlots)[number];

export const mealNames: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks'
};
