import { mealSlots, type MealSlot } from "$lib/nutrition/constants";
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import DiaryDayView, {
  type DiaryDayViewData,
} from "./DiaryDayView.svelte";

function diaryViewData(): DiaryDayViewData {
  const meals = Object.fromEntries(
    mealSlots.map((slot) => [
      slot,
      {
        entries: slot === "breakfast"
          ? [{
              id: "entry-1",
              foodName: "Porridge",
              amountUnit: "mg" as const,
              resolvedAmount: 100_000,
              energyMkcal: 120_000,
            }]
          : [],
        totals: {
          energyMkcal: slot === "breakfast" ? 120_000 : 0,
        },
      },
    ]),
  ) as DiaryDayViewData["meals"];

  return {
    balances: {
      energyMkcal: {
        consumed: 120_000,
        target: 2_000_000,
        remaining: 1_880_000,
        over: 0,
      },
      proteinMg: {
        consumed: 5_000,
        target: 100_000,
        remaining: 95_000,
        over: 0,
      },
      carbsMg: {
        consumed: 20_000,
        target: 200_000,
        remaining: 180_000,
        over: 0,
      },
      fatMg: {
        consumed: 2_000,
        target: 70_000,
        remaining: 68_000,
        over: 0,
      },
    },
    meals,
  };
}

const shortcutEligibility = Object.fromEntries(
  mealSlots.map((slot) => [slot, slot === "breakfast"]),
) as Record<MealSlot, boolean>;

describe("DiaryDayView", () => {
  it("renders the familiar diary summary with route-provided actions", async () => {
    render(DiaryDayView, {
      diary: diaryViewData(),
      shortcutEligibility,
      actions: {
        entryHref: (entryId) => `/diary/${entryId}/edit`,
        addFoodHref: (slot) => `/foods?mealSlot=${slot}`,
        saveShortcutHref: (slot) => `/meal-shortcuts/new?mealSlot=${slot}`,
      },
    });

    await expect.element(page.getByRole("heading", { name: "Daily energy" }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("link", {
      name: /Porridge/,
    })).toHaveAttribute("href", "/diary/entry-1/edit");
    await expect.element(page.getByRole("link", {
      name: "Save as meal shortcut",
    })).toHaveAttribute("href", "/meal-shortcuts/new?mealSlot=breakfast");
  });

  it("keeps unsupported actions visible but disabled when callbacks are omitted", async () => {
    render(DiaryDayView, {
      diary: diaryViewData(),
      shortcutEligibility,
    });

    await expect.element(page.getByText("Porridge")).toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: /Porridge/ }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText("Save as meal shortcut"))
      .toHaveAttribute("aria-disabled", "true");
  });
});
