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
import { readFoodFormValues, readText } from "$lib/nutrition/food-form";

const destinationSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots)
});
const barcodeSchema = z.string().trim().max(200);

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
      ...readFoodFormValues(formData),
      clientMutationId: readText(formData, 'clientMutationId'),
      portionKind: readText(formData, 'portionKind'),
      portionCount: readText(formData, 'portionCount'),
      diaryDate: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    }

    const foodResult = createFoodSchema.safeParse(values);

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
