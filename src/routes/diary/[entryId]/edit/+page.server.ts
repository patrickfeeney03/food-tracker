import { resolve } from "$app/paths";
import { withQuery } from "$lib/navigation";
import type { PortionKind } from "$lib/nutrition/constants";
import { editDiaryEntryInputSchema } from "$lib/nutrition/portion-input";
import { formatStoredValue } from "$lib/nutrition/math";
import { db } from "$lib/server/db";
import { diaryLogs } from "$lib/server/db/schema";
import { DiaryEntryNotFoundError, updateDiaryEntry } from "$lib/server/nutrition/update-diary-entry";
import { error, fail, redirect } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Actions, PageServerLoad } from "./$types";

function readText(
  formData: FormData,
  name: string
): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function loadEntry(
  userId: string,
  entryId: string
) {
  return db
    .select()
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.id, entryId),
        eq(diaryLogs.userId, userId),
        isNull(diaryLogs.deletedAt)
      )
    )
    .get();
}

export const load: PageServerLoad = ({
  locals,
  params
}) => {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

  const entry = loadEntry(
    locals.user.id,
    params.entryId
  );

  if (entry === undefined) {
    return error(404, 'Diary entry not found');
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
      diaryDate: entry.diaryDate,
      mealSlot: entry.mealSlot
    }
  };
};

export const actions = {
  default: async ({
    locals,
    params,
    request
  }) => {
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

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
      const entry = updateDiaryEntry(
        db,
        locals.user.id,
        params.entryId,
        result.data
      );

      return redirect(
        303,
        resolve(
          withQuery('/', {
            date: entry.diaryDate,
            updated: 1
          })
        )
      );
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
  }
} satisfies Actions;
