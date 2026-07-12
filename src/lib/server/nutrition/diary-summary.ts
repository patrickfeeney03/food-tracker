import { mealSlots, type MealSlot } from "$lib/nutrition/constants";
import { toSafeInteger } from "$lib/nutrition/math";
import { calendarDateString } from "$lib/nutrition/portion-input";
import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import type { DatabaseConnection } from "../db/connection";
import { diaryLogs, nutritionGoals, type DiaryLog } from "../db/schema";

type AppDatabase = DatabaseConnection['db'];
type NutritionGoal = typeof nutritionGoals.$inferSelect;

export interface DiaryBalances {
  energyMkcal: NutritionBalance,
  proteinMg: NutritionBalance,
  carbsMg: NutritionBalance,
  fatMg: NutritionBalance
}

export interface DiaryDaySummary {
  date: string;
  goal: NutritionGoal | null;
  meals: Record<MealSlot, MealSummary>;
  totals: CoreNutrition;
  balances: DiaryBalances | null;
}

export interface CoreNutrition {
  energyMkcal: number;
  proteinMg: number;
  carbsMg: number;
  fatMg: number;
}

export interface MealSummary {
  slot: MealSlot;
  entries: DiaryLog[];
  totals: CoreNutrition
}

export interface NutritionBalance {
  consumed: number;
  target: number;
  remaining: number;
  over: number;
}

export function sumDiaryNutrition(
  entries: readonly DiaryLog[]
): CoreNutrition {
  let energyMkcal = 0n;
  let proteinMg = 0n;
  let carbsMg = 0n;
  let fatMg = 0n;

  for (const entry of entries) {
    energyMkcal += BigInt(entry.energyMkcal);
    proteinMg += BigInt(entry.proteinMg);
    carbsMg += BigInt(entry.carbsMg);
    fatMg += BigInt(entry.fatMg);
  }

  return {
    energyMkcal: toSafeInteger(energyMkcal),
    proteinMg: toSafeInteger(proteinMg),
    carbsMg: toSafeInteger(carbsMg),
    fatMg: toSafeInteger(fatMg)
  };
}

export function loadDiaryDay(
  db: AppDatabase,
  userId: string,
  rawDate: string
): DiaryDaySummary {
  const date = calendarDateString.parse(rawDate);

  const entries = db
    .select()
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.userId, userId),
        eq(diaryLogs.diaryDate, date),
        isNull(diaryLogs.deletedAt)
      )
    )
    .orderBy(
      asc(diaryLogs.loggedAt),
      asc(diaryLogs.id)
    )
    .all();

  const goal = db
    .select()
    .from(nutritionGoals)
    .where(
      and(
        eq(nutritionGoals.userId, userId),
        lte(nutritionGoals.effectiveFrom, date)
      )
    )
    .orderBy(
      desc(nutritionGoals.effectiveFrom)
    )
    .limit(1)
    .get() ?? null;

  const meals = Object.fromEntries(
    mealSlots.map((slot) => {
      const mealEntries = entries.filter(
        (entry) => entry.mealSlot === slot
      );

      return [
        slot,
        {
          slot,
          entries: mealEntries,
          totals: sumDiaryNutrition(mealEntries)
        }
      ]
    })
  ) as Record<MealSlot, MealSummary>;

  const totals = sumDiaryNutrition(entries);

  const balances =
    goal === null
      ? null
      : {
        energyMkcal: calculateBalance(
          totals.energyMkcal,
          goal.targetEnergyMkcal
        ),
        proteinMg: calculateBalance(
          totals.proteinMg,
          goal.targetProteinMg
        ),
        carbsMg: calculateBalance(
          totals.carbsMg,
          goal.targetCarbsMg
        ),
        fatMg: calculateBalance(
          totals.fatMg,
          goal.targetFatMg
        )
      };

  return {
    date,
    goal,
    meals,
    totals,
    balances
  }
}

export function calculateBalance(
  consumed: number,
  target: number
): NutritionBalance {
  if (
    !Number.isSafeInteger(consumed) ||
    consumed < 0
  ) {
    throw new RangeError(
      'Consumed value must be a non-negative safe integer'
    );
  }

  if (
    !Number.isSafeInteger(target) ||
    target < 0
  ) {
    throw new RangeError(
      'Target value must be a non-negative safe integer'
    );
  }

  if (consumed <= target) {
    return {
      consumed,
      target,
      remaining: target - consumed,
      over: 0
    };
  }

  return {
    consumed,
    target,
    remaining: 0,
    over: consumed - target
  };
}
