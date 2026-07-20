import { db } from "$lib/server/db";
import { nutritionGoals } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import {
  firstGoalEffectiveDateError,
  nutritionGoalInputSchema
} from "$lib/nutrition/goal-input";
import { readText } from "$lib/nutrition/food-form";
import z from "zod";
import { requireUser } from "$lib/server/auth/require-user";
import { saveNutritionGoal } from "$lib/server/nutrition/save-nutrition-goal";
import { todayInDublin } from '$lib/date';

function hasGoal(userId: string): boolean {
  return db
    .select({ id: nutritionGoals.id })
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, userId))
    .get() !== undefined;
}

export const load: PageServerLoad = ({ locals }) => {
  const user = requireUser(locals);

  if (hasGoal(user.id)) {
    return redirect(303, '/');
  }

  const today = todayInDublin();

  return {
    maxEffectiveDate: today,
    values: {
      effectiveFrom: today,
      targetEnergyKcal: '2900',
      targetProteinG: '200',
      targetCarbsG: '300',
      targetFatG: '90'
    }
  };
}

export const actions = {
  default: async ({ locals, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();

    const values = {
      effectiveFrom: readText(
        formData,
        'effectiveFrom'
      ),
      targetEnergyKcal: readText(
        formData,
        'targetEnergyKcal'
      ),
      targetProteinG: readText(
        formData,
        'targetProteinG'
      ),
      targetCarbsG: readText(
        formData,
        'targetCarbsG'
      ),
      targetFatG: readText(
        formData,
        'targetFatG'
      )
    };

    const result = nutritionGoalInputSchema.safeParse(values);

    if (!result.success) {
      return fail(400, {
        values,
        errors: z.flattenError(
          result.error
        ).fieldErrors
      });
    }

    const effectiveDateError = firstGoalEffectiveDateError(
      result.data.effectiveFrom,
      todayInDublin()
    );

    if (effectiveDateError !== undefined) {
      return fail(400, {
        values,
        errors: { effectiveFrom: [effectiveDateError] }
      });
    }

    const goal = saveNutritionGoal(
      db,
      user.id,
      result.data
    );

    locals.log.info('nutrition_goal.saved', {
      nutritionGoalId: goal.id,
      effectiveFrom: goal.effectiveFrom
    });

    return redirect(303, '/');
  }
} satisfies Actions;
