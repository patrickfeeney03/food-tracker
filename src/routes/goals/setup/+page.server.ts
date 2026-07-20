import { db } from "$lib/server/db";
import { nutritionGoals } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import {
  firstGoalEffectiveDateError,
  nutritionGoalInputSchema
} from "$lib/nutrition/goal-input";
import z from "zod";
import { saveNutritionGoal } from "$lib/server/nutrition/save-nutrition-goal";
import { todayInDublin } from '$lib/date';

function readText(
  formData: FormData,
  name: string
): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function hasGoal(userId: string): boolean {
  return db
    .select({ id: nutritionGoals.id })
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, userId))
    .get() !== undefined;
}

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

  if (hasGoal(locals.user.id)) {
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
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

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

    saveNutritionGoal(
      db,
      locals.user.id,
      result.data
    );

    return redirect(303, '/');
  }
} satisfies Actions;
