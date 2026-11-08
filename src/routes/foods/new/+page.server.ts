import { inputLimits } from "$lib/nutrition/input-limits";
import { destinationSchema } from "$lib/nutrition/navigation-context";
import { createFoodMutationSchema, logFoodInputSchema } from "$lib/nutrition/portion-input";
import * as z from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { createFoodSchema } from "$lib/nutrition/food-input";
import {
  createFood,
  createFoodAndLog,
  FoodCreateBarcodeConflictError,
  FoodCreateMutationConflictError
} from "$lib/server/nutrition/create-food-and-log";
import { requireUser } from "$lib/server/auth/require-user";
import { resolve } from "$app/paths";
import { withQuery } from "$lib/navigation";
import { readFoodFormValues, readText } from "$lib/nutrition/food-form";

const barcodeSchema = z.string().trim().max(inputLimits.food.barcode.maxLength);

/** The switch submits "1" over a hidden "0"; requests without the field keep the original add-to-diary behaviour. */
function readAddToDiary(formData: FormData): boolean {
  const submitted = formData.getAll('addToDiary');
  return submitted.length === 0 || submitted.includes('1');
}

export const load: PageServerLoad = async ({
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

      addToDiary: true,
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
      addToDiary: readAddToDiary(formData),
      portionKind: readText(formData, 'portionKind'),
      portionCount: readText(formData, 'portionCount'),
      diaryDate: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    }

    const foodResult = createFoodSchema.safeParse(values);

    const logInput = {
      clientMutationId: values.clientMutationId,
      portionKind: values.portionKind,
      portionCount: values.portionCount,
      diaryDate: values.diaryDate,
      mealSlot: values.mealSlot
    };
    const logResult = values.addToDiary
      ? logFoodInputSchema.safeParse(logInput)
      : createFoodMutationSchema.safeParse(logInput);
    const destinationResult = destinationSchema.safeParse({
      date: values.diaryDate,
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

    if (!destinationResult.success) {
      return error(400, 'Invalid diary destination');
    }

    const clientMutationId = logResult.data.clientMutationId;

    try {
      const created = values.addToDiary
        ? await createFoodAndLog(locals.db, user.id, foodResult.data, logResult.data)
        : await createFood(locals.db, user.id, foodResult.data, logResult.data);

      if (!created.replayed) {
        locals.log.info('food.created', {
          foodId: created.food.id,
          diaryEntryId: created.diaryLog?.id ?? null,
          clientMutationId
        });
      }

      if (created.diaryLog) {
        locals.log.info('diary_entry.logged', {
          diaryEntryId: created.diaryLog.id,
          foodId: created.food.id,
          diaryDate: created.diaryLog.diaryDate,
          mealSlot: created.diaryLog.mealSlot,
          clientMutationId,
          source: 'new_food',
          replayed: created.replayed
        });
      }
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
          date: destinationResult.data.date,
          mealSlot: destinationResult.data.mealSlot,
          created: values.addToDiary ? 1 : 'saved'
        }))
    );
  }
} satisfies Actions;
