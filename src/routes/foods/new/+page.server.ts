import { inputLimits } from "$lib/nutrition/input-limits";
import { destinationSchema } from "$lib/nutrition/navigation-context";
import { logFoodInputSchema } from "$lib/nutrition/portion-input";
import z from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { createFoodSchema } from "$lib/nutrition/food-input";
import {
  createFoodAndLog,
  FoodCreateBarcodeConflictError,
  FoodCreateMutationConflictError
} from "$lib/server/nutrition/create-food-and-log";
import { requireUser } from "$lib/server/auth/require-user";
import { db } from "$lib/server/db";
import { resolve } from "$app/paths";
import { withQuery } from "$lib/navigation";
import { readFoodFormValues, readText } from "$lib/nutrition/food-form";

const barcodeSchema = z.string().trim().max(inputLimits.food.barcode.maxLength);

export const load: PageServerLoad = ({
  locals,
  url
}) => {
  requireUser(locals);

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
    const user = requireUser(locals);

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

    try {
      const created = createFoodAndLog(
        db,
        user.id,
        foodResult.data,
        logResult.data
      );

      if (!created.replayed) {
        locals.log.info('food.created', {
          foodId: created.food.id,
          diaryEntryId: created.diaryLog.id,
          clientMutationId: logResult.data.clientMutationId
        });
      }

      locals.log.info('diary_entry.logged', {
        diaryEntryId: created.diaryLog.id,
        foodId: created.food.id,
        diaryDate: created.diaryLog.diaryDate,
        mealSlot: created.diaryLog.mealSlot,
        clientMutationId: logResult.data.clientMutationId,
        source: 'new_food',
        replayed: created.replayed
      });
    } catch (caught) {
      if (caught instanceof FoodCreateBarcodeConflictError) {
        return fail(400, {
          values,
          errors: {
            barcode: [caught.message]
          }
        });
      }

      if (caught instanceof FoodCreateMutationConflictError) {
        return fail(409, {
          values,
          errors: {
            form: [caught.message]
          }
        });
      }

      if (caught instanceof RangeError) {
        const isUnavailablePortion =
          caught.message.startsWith('Food does not define');

        return fail(400, {
          values,
          errors: isUnavailablePortion
            ? { portionKind: [caught.message] }
            : { form: [caught.message] }
        });
      }

      throw caught;
    }

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
