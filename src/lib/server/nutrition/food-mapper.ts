import type { CreateFoodFormInput } from "$lib/nutrition/food-input";
import { parseGramsToMg } from "$lib/nutrition/math";
import type { AdditionalNutrition, NewFood } from "$lib/server/db/schema";
import { parseKcalToMkcal, parseMilligrams, parseMillilitresToUl, toSafeInteger } from "$lib/nutrition/math";

type FixedPointParser = (input: string) => bigint;

function parseForStorage(
  value: string,
  parser: FixedPointParser
): number {
  return toSafeInteger(parser(value));
}

function parseOptionalForStorage(
  value: string,
  parser: FixedPointParser
): number | null {
  return value === ''
    ? null
    : parseForStorage(value, parser);
}

export function mapCreateFoodInput(
  input: CreateFoodFormInput,
  userId: string
): NewFood {
  const parseAmount =
    input.amountUnit === 'mg'
      ? parseGramsToMg
      : parseMillilitresToUl;

  const additionalNutrition: AdditionalNutrition = {};

  if (input.fibreG !== '') {
    additionalNutrition.fibreMg = parseForStorage(
      input.fibreG, parseGramsToMg
    );
  }

  if (input.sugarG !== '') {
    additionalNutrition.sugarMg = parseForStorage(
      input.sugarG, parseGramsToMg
    );
  }

  if (input.saturatedFatG !== '') {
    additionalNutrition.saturatedFatMg = parseForStorage(
      input.saturatedFatG, parseGramsToMg
    );
  }

  if (input.sodiumMg !== '') {
    additionalNutrition.sodiumMg = parseForStorage(
      input.sodiumMg, parseMilligrams
    );
  }

  if (input.potassiumMg !== '') {
    additionalNutrition.potassiumMg = parseForStorage(
      input.potassiumMg, parseMilligrams
    );
  }

  const hasAdditionalNutrition = Object.keys(additionalNutrition).length > 0;

  return {
    userId,
    name: input.name,
    brand: input.brand === '' ? null : input.brand,
    barcode: input.barcode === '' ? null : input.barcode,
    amountUnit: input.amountUnit,

    basisAmount: parseForStorage(
      input.basisAmount, parseAmount
    ),

    servingAmount: parseOptionalForStorage(
      input.servingAmount, parseAmount
    ),

    containerAmount: parseOptionalForStorage(
      input.containerAmount, parseAmount
    ),

    energyMkcalPerBasis: parseForStorage(
      input.energyKcal, parseKcalToMkcal
    ),

    proteinMgPerBasis: parseForStorage(
      input.proteinG, parseGramsToMg
    ),

    carbsMgPerBasis: parseForStorage(
      input.carbsG, parseGramsToMg
    ),

    fatMgPerBasis: parseForStorage(
      input.fatG, parseGramsToMg
    ),

    additionalNutritionJson:
      hasAdditionalNutrition
        ? additionalNutrition
        : null,

    notes: input.notes === '' ? null : input.notes
  };
}

