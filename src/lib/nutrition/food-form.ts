export const foodFieldNames = [
  'name',
  'brand',
  'barcode',
  'amountUnit',
  'basisAmount',
  'servingAmount',
  'containerAmount',
  'energyKcal',
  'proteinG',
  'carbsG',
  'fatG',
  'fibreG',
  'sugarG',
  'saturatedFatG',
  'sodiumMg',
  'potassiumMg',
  'notes'
] as const;

export function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function readFoodFormValues(formData: FormData) {
  return Object.fromEntries(
    foodFieldNames.map((name) => [name, readText(formData, name)])
  ) as Record<(typeof foodFieldNames)[number], string>;
}
