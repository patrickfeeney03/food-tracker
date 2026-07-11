
export const amountUnits = ['mg', 'ul' /* micro liters */] as const;
export type AmountUnit = (typeof amountUnits)[number];
