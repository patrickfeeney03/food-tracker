import { mealSlots } from "$lib/nutrition/constants";
import { calendarDateString } from "$lib/nutrition/portion-input";
import z from "zod";
import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { todayInDublin } from "$lib/date";
import {
  findActiveFoodByBarcode,
  listActiveFoods
} from "$lib/server/nutrition/food-catalogue";
import { resolve } from "$app/paths";
import { withQuery } from "$lib/navigation";

const destinationSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

const searchSchema = z.string().trim().max(200);
const barcodeSchema = z.string().trim().min(1).max(200);

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
  const rawBarcode = url.searchParams.get('barcode');
  const barcodeResult = rawBarcode === null
    ? null
    : barcodeSchema.safeParse(rawBarcode);

  if (barcodeResult !== null && !barcodeResult.success) {
    return error(400, 'Invalid barcode');
  }

  const scannedBarcode = barcodeResult?.data ?? null;

  if (scannedBarcode !== null) {
    const matchingFood = findActiveFoodByBarcode(
      db,
      locals.user.id,
      scannedBarcode
    );

    if (matchingFood === null) {
      return redirect(
        303,
        resolve(
          withQuery('/foods/new', {
            date: destinationResult.data.date,
            mealSlot: destinationResult.data.mealSlot,
            barcode: scannedBarcode
          })
        )
      );
    }

    return {
      destination: destinationResult.data,
      created: false,
      isToday: destinationResult.data.date === todayInDublin(),
      query: scannedBarcode,
      scannedBarcode,
      foods: [matchingFood]
    };
  }

  const foods = listActiveFoods(
    db,
    locals.user.id,
    query
  );

  return {
    destination: destinationResult.data,
    created: url.searchParams.get('created') === '1',
    isToday: destinationResult.data.date === todayInDublin(),
    query,
    scannedBarcode: null,
    foods
  };
}
