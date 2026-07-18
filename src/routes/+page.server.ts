import { error, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { nutritionGoals } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { calendarDateString } from "$lib/nutrition/portion-input";
import { loadDiaryDay } from "$lib/server/nutrition/diary-summary";
import { todayInDublin } from "$lib/date";
import { mealSlots, type MealSlot } from "$lib/nutrition/constants";
import {
  getMealShortcutApplicationFeedback,
  getMealShortcut,
  loadMealShortcutDraft,
  MealShortcutApplicationNotFoundError,
  MealShortcutNotFoundError,
  undoMealShortcutApplication
} from "$lib/server/nutrition/meal-shortcut";
import { resolve } from "$app/paths";
import { withQuery } from "$lib/navigation";
import { z } from "zod";
import type { Actions, PageServerLoad } from "./$types";

const applicationIdSchema = z.uuid();

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export const load: PageServerLoad = ({
  locals,
  url
}) => {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }
  const userId = locals.user.id;

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

  const today = todayInDublin();
  const rawDate =
    url.searchParams.get('date') ??
    today;

  const dateResult =
    calendarDateString.safeParse(rawDate);

  if (!dateResult.success) {
    return error(400, 'Invalid diary date');
  }

  const diary = loadDiaryDay(
    db,
    locals.user.id,
    dateResult.data
  );
  const shortcutEligibility = Object.fromEntries(
    mealSlots.map((slot) => {
      if (diary.meals[slot].entries.length === 0) {
        return [slot, false];
      }

      const draft = loadMealShortcutDraft(
        db,
        userId,
        dateResult.data,
        slot
      );

      return [
        slot,
        draft.items.length > 0 || draft.excludedEntries.length > 0
      ];
    })
  ) as Record<MealSlot, boolean>;

  const appliedId = url.searchParams.get('shortcutApplied');
  const undoneId = url.searchParams.get('shortcutUndone');
  const savedId = url.searchParams.get('shortcutSaved');
  let shortcutFeedback:
    | { kind: 'applied'; applicationId: string; shortcutName: string; entryCount: number }
    | { kind: 'undone'; shortcutName: string }
    | { kind: 'saved'; shortcutName: string }
    | null = null;

  const feedbackApplicationId = undoneId ?? appliedId;
  const applicationIdResult = applicationIdSchema.safeParse(feedbackApplicationId);

  if (applicationIdResult.success) {
    try {
      const feedback = getMealShortcutApplicationFeedback(
        db,
        locals.user.id,
        applicationIdResult.data
      );

      if (undoneId !== null && feedback.undone) {
        shortcutFeedback = {
          kind: 'undone',
          shortcutName: feedback.application.shortcutName
        };
      } else if (appliedId !== null && !feedback.undone) {
        shortcutFeedback = {
          kind: 'applied',
          applicationId: feedback.application.id,
          shortcutName: feedback.application.shortcutName,
          entryCount: feedback.entryCount
        };
      }
    } catch (caught) {
      if (!(caught instanceof MealShortcutApplicationNotFoundError)) {
        throw caught;
      }
    }
  }

  const savedIdResult = applicationIdSchema.safeParse(savedId);
  if (shortcutFeedback === null && savedIdResult.success) {
    try {
      const shortcut = getMealShortcut(db, locals.user.id, savedIdResult.data);
      shortcutFeedback = {
        kind: 'saved',
        shortcutName: shortcut.name
      };
    } catch (caught) {
      if (!(caught instanceof MealShortcutNotFoundError)) {
        throw caught;
      }
    }
  }

  return {
    today,
    user: {
      name: locals.user.name
    },
    diary,
    shortcutEligibility,
    shortcutFeedback
  };
};

export const actions = {
  undoShortcut: async ({ locals, request }) => {
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

    const formData = await request.formData();
    const applicationIdResult = applicationIdSchema.safeParse(
      readText(formData, 'applicationId')
    );
    const dateResult = calendarDateString.safeParse(readText(formData, 'diaryDate'));

    if (!applicationIdResult.success || !dateResult.success) {
      return error(400, 'Invalid meal shortcut undo request');
    }

    try {
      const feedback = undoMealShortcutApplication(
        db,
        locals.user.id,
        applicationIdResult.data
      );

      return redirect(
        303,
        resolve(
          withQuery('/', {
            date: dateResult.data,
            shortcutUndone: feedback.application.id
          })
        )
      );
    } catch (caught) {
      if (caught instanceof MealShortcutApplicationNotFoundError) {
        return error(404, 'Meal shortcut application not found');
      }

      throw caught;
    }
  }
} satisfies Actions;
