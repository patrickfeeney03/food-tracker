import { mealSlots } from "$lib/nutrition/constants";
import { calendarDateString } from "$lib/nutrition/portion-input";
import z from "zod";
import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { todayInDublin } from "$lib/date";
import { listActiveFoods } from "$lib/server/nutrition/food-catalogue";

const destinationSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

const searchSchema = z.string().trim().max(200);

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

  const searchResult = searchSchema.safeParse(
    url.searchParams.get('q') ?? ''
  );

  if (!searchResult.success) {
    return error(400, 'Invalid food search');
  }

  const query = searchResult.data;

  return {
    destination: destinationResult.data,
    created: url.searchParams.get('created') === '1',
    isToday: destinationResult.data.date === todayInDublin(),
    query,
    foods: listActiveFoods(
      db,
      locals.user.id,
      query
    )
  };
}
