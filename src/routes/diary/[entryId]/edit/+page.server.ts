import { resolve } from "$app/paths";
import { withHash, withQuery } from "$lib/navigation";
import type { PortionKind } from "$lib/nutrition/constants";
import { readText } from "$lib/nutrition/food-form";
import { editDiaryEntryInputSchema } from "$lib/nutrition/portion-input";
import { editUntrackedEntryInputSchema } from "$lib/nutrition/untracked-entry-input";
import { formatStoredValue } from "$lib/nutrition/math";
import { requireUser } from "$lib/server/auth/require-user";
import { deleteDiaryEntry, DiaryEntryDeletionNotFoundError } from "$lib/server/nutrition/delete-diary-entry";
import { getActiveDiaryEntry } from "$lib/server/nutrition/diary-entry-query";
import {
  DiaryEntryNotFoundError,
  updateDiaryEntry,
  updateUntrackedEntry
} from "$lib/server/nutrition/update-diary-entry";
import type { DiaryLog } from "$lib/server/db/schema";
import { error, fail, redirect } from "@sveltejs/kit";
import * as z from "zod";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
  locals,
  params
}) => {
  const user = requireUser(locals);

  const entry = await getActiveDiaryEntry(
    locals.db,
    user.id,
    params.entryId
  );

  if (entry === undefined) {
    return error(404, 'Diary entry not found');
  }

  if (entry.untracked) {
    return {
      entry,
      portionOptions: [],
      values: {
        portionKind: entry.portionKind,
        portionCount: '',
        name: entry.foodName,
        diaryDate: entry.diaryDate,
        mealSlot: entry.mealSlot
      }
    };
  }

  const displayUnit =
    entry.amountUnit === 'mg' ? 'g' : 'ml';
  const portionOptions: Array<{
    kind: PortionKind;
    label: string;
    amount: number;
  }> = [
    {
      kind: 'unit',
      label: `1 ${displayUnit}`,
      amount: 1_000
    },
    {
      kind: 'hundred',
      label: `100 ${displayUnit}`,
      amount: 100_000
    }
  ];

  if (
    entry.portionKind === 'serving' ||
    entry.portionKind === 'container'
  ) {
    portionOptions.push({
      kind: entry.portionKind,
      label: entry.portionLabel,
      amount: entry.portionAmount
    });
  }

  return {
    entry,
    portionOptions,
    values: {
      portionKind: entry.portionKind,
      portionCount: formatStoredValue(
        BigInt(entry.portionCountMilli),
        3
      ),
      name: entry.foodName,
      diaryDate: entry.diaryDate,
      mealSlot: entry.mealSlot
    }
  };
};

function redirectToUpdatedEntry(entry: DiaryLog): never {
  return redirect(
    303,
    withHash(
      resolve(
        withQuery('/', {
          date: entry.diaryDate,
          updated: 1
        })
      ),
      entry.mealSlot
    )
  );
}

export const actions = {
  save: async ({
    locals,
    params,
    request
  }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const values = {
      portionKind: readText(formData, 'portionKind'),
      portionCount: readText(formData, 'portionCount'),
      diaryDate: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    };
    const result =
      editDiaryEntryInputSchema.safeParse(values);

    if (!result.success) {
      return fail(400, {
        values,
        errors: z.flattenError(result.error).fieldErrors
      });
    }

    try {
      const entry = await updateDiaryEntry(
        locals.db,
        user.id,
        params.entryId,
        result.data
      );

      locals.log.info('diary_entry.updated', {
        diaryEntryId: entry.id,
        foodId: entry.foodId,
        diaryDate: entry.diaryDate,
        mealSlot: entry.mealSlot
      });

      return redirectToUpdatedEntry(entry);
    } catch (caught) {
      if (caught instanceof DiaryEntryNotFoundError) {
        return error(404, 'Diary entry not found');
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
  },

  saveUntracked: async ({
    locals,
    params,
    request
  }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const values = {
      name: readText(formData, 'name'),
      diaryDate: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    };
    const result = editUntrackedEntryInputSchema.safeParse(values);

    if (!result.success) {
      return fail(400, {
        values,
        errors: z.flattenError(result.error).fieldErrors
      });
    }

    try {
      const entry = await updateUntrackedEntry(
        locals.db,
        user.id,
        params.entryId,
        result.data
      );

      locals.log.info('diary_entry.updated', {
        diaryEntryId: entry.id,
        foodId: entry.foodId,
        diaryDate: entry.diaryDate,
        mealSlot: entry.mealSlot,
        untracked: true
      });

      return redirectToUpdatedEntry(entry);
    } catch (caught) {
      if (caught instanceof DiaryEntryNotFoundError) {
        return error(404, 'Diary entry not found');
      }

      if (caught instanceof RangeError) {
        return fail(400, {
          values,
          errors: {
            name: [caught.message]
          }
        });
      }

      throw caught;
    }
  },

  delete: async ({ locals, params }) => {
    const user = requireUser(locals);

    try {
      const entry = await deleteDiaryEntry(
        locals.db,
        user.id,
        params.entryId
      );

      locals.log.info('diary_entry.deleted', {
        diaryEntryId: entry.id,
        foodId: entry.foodId,
        diaryDate: entry.diaryDate,
        mealSlot: entry.mealSlot,
        source: 'diary'
      });

      return redirect(
        303,
        withHash(
          resolve(
            withQuery('/', {
              date: entry.diaryDate,
              entryDeleted: entry.id
            })
          ),
          entry.mealSlot
        )
      );
    } catch (caught) {
      if (caught instanceof DiaryEntryDeletionNotFoundError) {
        return error(404, 'Diary entry not found');
      }

      throw caught;
    }
  }
} satisfies Actions;
