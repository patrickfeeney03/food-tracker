import { todayInDublin } from '$lib/date';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import { nutritionGoals } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  const user = requireUser(locals);

  const today = todayInDublin();
  const goals = db
    .select({
      id: nutritionGoals.id,
      effectiveFrom: nutritionGoals.effectiveFrom,
      targetEnergyMkcal: nutritionGoals.targetEnergyMkcal,
      targetProteinMg: nutritionGoals.targetProteinMg,
      targetCarbsMg: nutritionGoals.targetCarbsMg,
      targetFatMg: nutritionGoals.targetFatMg,
      updatedAt: nutritionGoals.updatedAt
    })
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, user.id))
    .orderBy(desc(nutritionGoals.effectiveFrom))
    .all();

  return {
    goals,
    today,
    currentGoalId: goals.find((goal) => goal.effectiveFrom <= today)?.id ?? null,
    saved: url.searchParams.get('saved') === '1'
  };
};
