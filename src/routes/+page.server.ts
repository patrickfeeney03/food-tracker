import { error, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { nutritionGoals } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { calendarDateString } from "$lib/nutrition/portion-input";
import { loadDiaryDay } from "$lib/server/nutrition/diary-summary";
import { todayInDublin } from "$lib/date";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({
  locals,
  url
}) => {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

  const hasGoal = db
    .select({ id: nutritionGoals.id })
    .from(nutritionGoals)
    .where(
      eq(
        nutritionGoals.userId,
        locals.user.id
      )
    )
    .get() !== undefined;

  if (!hasGoal) {
    return redirect(303, '/goals/setup');
  }

  const rawDate =
    url.searchParams.get('date') ??
    todayInDublin();

  const dateResult =
    calendarDateString.safeParse(rawDate);

  if (!dateResult.success) {
    return error(400, 'Invalid diary date');
  }

  return {
    user: {
      name: locals.user.name
    },
    diary: loadDiaryDay(
      db,
      locals.user.id,
      dateResult.data
    )
  };
};
