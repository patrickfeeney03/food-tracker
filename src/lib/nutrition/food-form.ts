export const foodFieldNames = [
  'name',
  'brand',
  'barcode',
  'amountUnit',
  'basisAmount',
  'servingAmount',
  'containerAmount',
  'energyKcal',
  'fatG',
  'saturatedFatG',
  'carbsG',
  'sugarG',
  'fibreG',
  'proteinG',
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
