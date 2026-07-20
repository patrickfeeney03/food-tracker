import { resolve } from '$app/paths';
import { todayInDublin } from '$lib/date';
import { withQuery } from '$lib/navigation';
import { readText } from '$lib/nutrition/food-form';
import { nutritionGoalInputSchema } from '$lib/nutrition/goal-input';
import { formatStoredValue } from '$lib/nutrition/math';
import { calendarDateString } from '$lib/nutrition/portion-input';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import { nutritionGoals } from '$lib/server/db/schema';
import { saveNutritionGoal } from '$lib/server/nutrition/save-nutrition-goal';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, lte } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  const user = requireUser(locals);

  const today = todayInDublin();
  const rawSelectedDate = url.searchParams.get('date');
  const selectedDateResult = rawSelectedDate === null
    ? null
    : calendarDateString.safeParse(rawSelectedDate);

  if (selectedDateResult !== null && !selectedDateResult.success) {
    return error(400, 'Invalid goal date');
  }

  const effectiveFrom = selectedDateResult?.data ?? today;
  const currentGoal = db
    .select()
    .from(nutritionGoals)
    .where(
      and(
        eq(nutritionGoals.userId, user.id),
        lte(nutritionGoals.effectiveFrom, effectiveFrom)
      )
    )
    .orderBy(desc(nutritionGoals.effectiveFrom))
    .limit(1)
    .get();

  return {
    openedFromHistory: url.searchParams.get('from') === 'history',
    selectedDate: selectedDateResult?.data ?? null,
    values: {
      effectiveFrom,
      targetEnergyKcal: currentGoal === undefined
        ? '2900'
        : formatStoredValue(BigInt(currentGoal.targetEnergyMkcal), 3),
      targetProteinG: currentGoal === undefined
        ? '200'
        : formatStoredValue(BigInt(currentGoal.targetProteinMg), 3),
      targetCarbsG: currentGoal === undefined
        ? '300'
        : formatStoredValue(BigInt(currentGoal.targetCarbsMg), 3),
      targetFatG: currentGoal === undefined
        ? '90'
        : formatStoredValue(BigInt(currentGoal.targetFatMg), 3)
    }
  };
};

export const actions = {
  default: async ({ locals, request, url }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const values = {
      effectiveFrom: readText(formData, 'effectiveFrom'),
      targetEnergyKcal: readText(formData, 'targetEnergyKcal'),
      targetProteinG: readText(formData, 'targetProteinG'),
      targetCarbsG: readText(formData, 'targetCarbsG'),
      targetFatG: readText(formData, 'targetFatG')
    };
    const result = nutritionGoalInputSchema.safeParse(values);

    if (!result.success) {
      return fail(400, {
        values,
        errors: z.flattenError(result.error).fieldErrors
      });
    }

    try {
      const goal = saveNutritionGoal(db, user.id, result.data);

      locals.log.info('nutrition_goal.saved', {
        nutritionGoalId: goal.id,
        effectiveFrom: goal.effectiveFrom
      });
    } catch (caught) {
      if (caught instanceof RangeError) {
        return fail(400, {
          values,
          errors: { form: [caught.message] }
        });
      }

      throw caught;
    }

    const openedFromHistory = url.searchParams.get('from') === 'history';

    return redirect(
      303,
      openedFromHistory
        ? resolve(withQuery('/settings/goals/history', { saved: 1 }))
        : resolve(withQuery('/settings', { targets: 'saved' }))
    );
  }
} satisfies Actions;
