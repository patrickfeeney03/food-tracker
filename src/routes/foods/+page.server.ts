import { mealSlots } from "$lib/nutrition/constants";
import { calendarDateString } from "$lib/nutrition/portion-input";
import z from "zod";
import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { and, asc, eq, isNull, like, or } from "drizzle-orm";
import { foods } from "$lib/server/db/schema";
import { db } from "$lib/server/db";

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

  const ownerAndActive = and(
    eq(foods.userId, locals.user.id),
    isNull(foods.deletedAt)
  );

  const results = db
    .select({
      id: foods.id,
      name: foods.name,
      brand: foods.brand,
      amountUnit: foods.amountUnit,
      basisAmount: foods.basisAmount,
      energyMkcalPerBasis: foods.energyMkcalPerBasis
    })
    .from(foods)
    .where(
      query === ''
        ? ownerAndActive
        : and(
          ownerAndActive,
          or(
            like(foods.name, `%${query}%`),
            like(foods.brand, `%${query}%`)
          )
        )
    )
    .orderBy(asc(foods.name))
    .limit(50)
    .all();

  return {
    destination: destinationResult.data,
    query,
    foods: results
  };
}
