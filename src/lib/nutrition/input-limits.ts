// Limits apply to the display-unit strings entered in forms, before the server
// maps them to fixed-point storage units such as mg, ul, or mkcal.
export const inputLimits = {
  food: {
    name: { maxLength: 200 },
    brand: { maxLength: 200 },
    barcode: { maxLength: 200 },
    notes: { maxLength: 2_000 },
    basisAmount: { max: 10_000 },
    servingAmount: { max: 10_000 },
    containerAmount: { max: 10_000 },
    energyKcal: { max: 10_000 },
    proteinG: { max: 1_000 },
    carbsG: { max: 1_000 },
    fatG: { max: 1_000 },
    fibreG: { max: 1_000 },
    sugarG: { max: 1_000 },
    saturatedFatG: { max: 1_000 },
    sodiumMg: { max: 10_000 },
    potassiumMg: { max: 10_000 },
  },
  portionCount: { max: 10_000 }, // in case a 1g basis is used
  goal: {
    targetEnergyKcal: { max: 10_000 },
    targetProteinG: { max: 1_000 },
    targetCarbsG: { max: 1_000 },
    targetFatG: { max: 1_000 },
  },
  mealShortcut: {
    name: { maxLength: 200 },
    amount: { max: 10_000 },
  },
  catalogueQuery: { maxLength: 200 },
} as const;
