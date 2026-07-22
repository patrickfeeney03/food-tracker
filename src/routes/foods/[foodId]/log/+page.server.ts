import { resolve } from '$app/paths';
import { withQuery } from '$lib/navigation';
import type { PortionKind } from '$lib/nutrition/constants';
import { readText } from '$lib/nutrition/food-form';
import { contextSchema } from '$lib/nutrition/navigation-context';
import { logFoodInputSchema } from '$lib/nutrition/portion-input';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import { diaryLogs, foods } from '$lib/server/db/schema';
import {
  ExistingFoodLogConflictError,
  ExistingFoodNotFoundError,
  logExistingFood
} from '$lib/server/nutrition/log-existing-food';
import { replayLatestFoodPortion } from '$lib/server/nutrition/latest-food-portion';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

function portionOptionsFor(food: {
  amountUnit: 'mg' | 'ul';
  servingAmount: number | null;
  containerAmount: number | null;
}) {
  const displayUnit = food.amountUnit === 'mg' ? 'g' : 'ml';
  const options: Array<{
    kind: PortionKind;
    label: string;
    amount: number;
  }> = [
    { kind: 'unit', label: `1 ${displayUnit}`, amount: 1_000 },
    { kind: 'hundred', label: `100 ${displayUnit}`, amount: 100_000 }
  ];

  if (food.servingAmount !== null) {
    options.push({
      kind: 'serving',
      label: 'Serving',
      amount: food.servingAmount
    });
  }

  if (food.containerAmount !== null) {
    options.push({
      kind: 'container',
      label: 'Container',
      amount: food.containerAmount
    });
  }

  return options;
}

export const load: PageServerLoad = ({ locals, params, url }) => {
  const user = requireUser(locals);

  const contextResult = contextSchema.safeParse({
    date: url.searchParams.get('date'),
    mealSlot: url.searchParams.get('mealSlot'),
    q: url.searchParams.get('q') ?? ''
  });

  if (!contextResult.success) {
    return error(400, 'Invalid diary destination');
  }

  const food = db
    .select({
      id: foods.id,
      name: foods.name,
      brand: foods.brand,
      amountUnit: foods.amountUnit,
      basisAmount: foods.basisAmount,
      servingAmount: foods.servingAmount,
      containerAmount: foods.containerAmount,
      energyMkcalPerBasis: foods.energyMkcalPerBasis,
      proteinMgPerBasis: foods.proteinMgPerBasis,
      carbsMgPerBasis: foods.carbsMgPerBasis,
      fatMgPerBasis: foods.fatMgPerBasis
    })
    .from(foods)
    .where(
      and(
        eq(foods.id, params.foodId),
        eq(foods.userId, user.id),
        isNull(foods.deletedAt)
      )
    )
    .get();

  if (food === undefined) {
    return error(404, 'Food not found');
  }

  const portionOptions = portionOptionsFor(food);
  const latestUse = db
    .select({
      portionKind: diaryLogs.portionKind,
      portionAmount: diaryLogs.portionAmount,
      portionCountMilli: diaryLogs.portionCountMilli,
      resolvedAmount: diaryLogs.resolvedAmount,
      amountUnit: diaryLogs.amountUnit
    })
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.userId, user.id),
        eq(diaryLogs.foodId, food.id),
        isNull(diaryLogs.deletedAt)
      )
    )
    .orderBy(desc(diaryLogs.loggedAt), desc(diaryLogs.id))
    .limit(1)
    .get();

  let portionKind: PortionKind = 'hundred';
  let portionCount = '';

  if (latestUse !== undefined) {
    const replay = replayLatestFoodPortion(food, latestUse);

    if (replay !== null) {
      portionKind = replay.portionKind;
      portionCount = replay.portionCount;
    }
  }

  return {
    context: contextResult.data,
    food,
    portionOptions,
    values: {
      clientMutationId: crypto.randomUUID(),
      portionKind,
      portionCount,
      diaryDate: contextResult.data.date,
      mealSlot: contextResult.data.mealSlot
    }
  };
};

export const actions = {
  default: async ({ locals, params, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const values = {
      clientMutationId: readText(formData, 'clientMutationId'),
      portionKind: readText(formData, 'portionKind'),
      portionCount: readText(formData, 'portionCount'),
      diaryDate: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    };
    const result = logFoodInputSchema.safeParse(values);

    if (!result.success) {
      return fail(400, {
        values,
        errors: z.flattenError(result.error).fieldErrors
      });
    }

    try {
      const entry = logExistingFood(db, user.id, params.foodId, result.data);

      locals.log.info('diary_entry.logged', {
        diaryEntryId: entry.id,
        foodId: params.foodId,
        diaryDate: entry.diaryDate,
        mealSlot: entry.mealSlot,
        clientMutationId: result.data.clientMutationId,
        source: 'existing_food'
      });
    } catch (caught) {
      if (caught instanceof ExistingFoodNotFoundError) {
        return error(404, 'Food not found');
      }

      if (caught instanceof ExistingFoodLogConflictError) {
        return fail(409, {
          values,
          errors: {
            form: [caught.message]
          }
        });
      }

      if (caught instanceof RangeError) {
        return fail(400, {
          values,
          errors: {
            portionKind: [caught.message]
          }
        });
      }

      throw caught;
    }

    return redirect(
      303,
      resolve(
        withQuery('/foods', {
          date: result.data.diaryDate,
          mealSlot: result.data.mealSlot,
          added: 1
        })
      )
    );
  }
} satisfies Actions;
