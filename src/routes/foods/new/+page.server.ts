import { mealSlots } from "$lib/nutrition/constants";
import { calendarDateString, logFoodInputSchema } from "$lib/nutrition/portion-input";
import z from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { createFoodSchema } from "$lib/nutrition/food-input";
import { createFoodAndLog } from "$lib/server/nutrition/create-food-and-log";
import { db } from "$lib/server/db";
import { resolve } from "$app/paths";
import { withQuery } from "$lib/navigation";

const destinationSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots)
});
const barcodeSchema = z.string().trim().max(200);

function readText(
  formData: FormData,
  name: string
): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export const load: PageServerLoad = ({
  locals,
  url
}) => {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

  const destinationResult =
    destinationSchema.safeParse({
      date: url.searchParams.get('date'),
      mealSlot: url.searchParams.get('mealSlot')
    });

  if (!destinationResult.success) {
    return error(400, 'Invalid diary destination');
  }

  const barcodeResult = barcodeSchema.safeParse(
    url.searchParams.get('barcode') ?? ''
  );

  if (!barcodeResult.success) {
    return error(400, 'Invalid barcode');
  }

  return {
    destination: destinationResult.data,
    values: {
      clientMutationId: crypto.randomUUID(),

      name: '',
      brand: '',
      barcode: barcodeResult.data,

      amountUnit: 'mg' as const,
      basisAmount: '100',
      servingAmount: '',
      containerAmount: '',

      energyKcal: '0',
      proteinG: '0',
      carbsG: '0',
      fatG: '0',

      fibreG: '',
      sugarG: '',
      saturatedFatG: '',
      sodiumMg: '',
      potassiumMg: '',

      notes: '',

      portionKind: 'hundred' as const,
      portionCount: '1',

      diaryDate: destinationResult.data.date,
      mealSlot: destinationResult.data.mealSlot
    }
  };
};

export const actions = {
  default: async ({ locals, request }) => {
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

    const formData = await request.formData();

    const values = {
      clientMutationId: readText(formData, 'clientMutationId'),

      name: readText(formData, 'name'),
      brand: readText(formData, 'brand'),
      barcode: readText(formData, 'barcode'),

      amountUnit: readText(formData, 'amountUnit'),
      basisAmount: readText(formData, 'basisAmount'),
      servingAmount: readText(formData, 'servingAmount'),
      containerAmount: readText(formData, 'containerAmount'),

      energyKcal: readText(formData, 'energyKcal'),
      proteinG: readText(formData, 'proteinG'),
      carbsG: readText(formData, 'carbsG'),
      fatG: readText(formData, 'fatG'),

      fibreG: readText(formData, 'fibreG'),
      sugarG: readText(formData, 'sugarG'),
      saturatedFatG: readText(formData, 'saturatedFatG'),
      sodiumMg: readText(formData, 'sodiumMg'),
      potassiumMg: readText(formData, 'potassiumMg'),

      notes: readText(formData, 'notes'),

      portionKind: readText(formData, 'portionKind'),
      portionCount: readText(formData, 'portionCount'),
      diaryDate: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    }

    const foodResult = createFoodSchema.safeParse({
      name: values.name,
      brand: values.brand,
      barcode: values.barcode,

      amountUnit: values.amountUnit,
      basisAmount: values.basisAmount,
      servingAmount: values.servingAmount,
      containerAmount: values.containerAmount,

      energyKcal: values.energyKcal,
      proteinG: values.proteinG,
      carbsG: values.carbsG,
      fatG: values.fatG,

      fibreG: values.fibreG,
      sugarG: values.sugarG,
      saturatedFatG: values.saturatedFatG,
      sodiumMg: values.sodiumMg,
      potassiumMg: values.potassiumMg,

      notes: values.notes
    });

    const logResult = logFoodInputSchema.safeParse({
      clientMutationId: values.clientMutationId,
      portionKind: values.portionKind,
      portionCount: values.portionCount,
      diaryDate: values.diaryDate,
      mealSlot: values.mealSlot
    });

    if (!foodResult.success || !logResult.success) {
      return fail(400, {
        values,
        errors: {
          ...(foodResult.success
            ? {}
            : z.flattenError(foodResult.error).fieldErrors),
          ...(logResult.success
            ? {}
            : z.flattenError(logResult.error).fieldErrors)
        }
      });
    }

    createFoodAndLog(
      db,
      locals.user.id,
      foodResult.data,
      logResult.data
    );

    return redirect(
      303,
      resolve(
        withQuery('/foods', {
          date: logResult.data.diaryDate,
          mealSlot: logResult.data.mealSlot,
          created: 1
        }))
    );
  }
} satisfies Actions;
