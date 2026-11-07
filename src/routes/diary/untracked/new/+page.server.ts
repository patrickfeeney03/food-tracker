import { resolve } from "$app/paths";
import { withHash, withQuery } from "$lib/navigation";
import { readText } from "$lib/nutrition/food-form";
import { destinationSchema } from "$lib/nutrition/navigation-context";
import { logUntrackedEntryInputSchema } from "$lib/nutrition/untracked-entry-input";
import { requireUser } from "$lib/server/auth/require-user";
import {
  logUntrackedEntry,
  UntrackedEntryConflictError
} from "$lib/server/nutrition/log-untracked-entry";
import { error, fail, redirect } from "@sveltejs/kit";
import * as z from "zod";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  requireUser(locals);

  const destinationResult = destinationSchema.safeParse({
    date: url.searchParams.get('date'),
    mealSlot: url.searchParams.get('mealSlot')
  });

  if (!destinationResult.success) {
    return error(400, 'Invalid diary destination');
  }

  // The name is a convenience prefill from the food search, so an unusable
  // value is dropped rather than rejected.
  const nameResult = logUntrackedEntryInputSchema.shape.name.safeParse(
    url.searchParams.get('name') ?? ''
  );

  return {
    destination: destinationResult.data,
    values: {
      clientMutationId: crypto.randomUUID(),
      name: nameResult.success ? nameResult.data : '',
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
      clientMutationId: readText(formData, 'clientMutationId'),
      name: readText(formData, 'name'),
      diaryDate: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    };
    const result = logUntrackedEntryInputSchema.safeParse(values);

    if (!result.success) {
      return fail(400, {
        values,
        errors: z.flattenError(result.error).fieldErrors as Partial<
          Record<'clientMutationId' | 'name' | 'diaryDate' | 'mealSlot' | 'form', string[]>
        >
      });
    }

    let entry;
    try {
      const logged = await logUntrackedEntry(locals.db, user.id, result.data);
      entry = logged.entry;

      locals.log.info('diary_entry.logged', {
        diaryEntryId: entry.id,
        foodId: null,
        diaryDate: entry.diaryDate,
        mealSlot: entry.mealSlot,
        clientMutationId: result.data.clientMutationId,
        source: 'untracked',
        replayed: logged.replayed
      });
    } catch (caught) {
      if (caught instanceof UntrackedEntryConflictError) {
        return fail(409, {
          values,
          errors: { form: [caught.message] } as Partial<
            Record<'clientMutationId' | 'name' | 'diaryDate' | 'mealSlot' | 'form', string[]>
          >
        });
      }

      throw caught;
    }

    return redirect(
      303,
      withHash(
        resolve(withQuery('/', { date: entry.diaryDate, updated: 1 })),
        entry.mealSlot
      )
    );
  }
} satisfies Actions;
