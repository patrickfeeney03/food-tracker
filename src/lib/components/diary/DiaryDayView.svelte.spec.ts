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
    await expect.element(page.getByRole("region", { name: "Breakfast" }))
      .toHaveAttribute("id", "breakfast");
    await expect.element(page.getByRole("region", { name: "Snacks" }))
      .toHaveAttribute("id", "snacks");
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

  it("shows untracked entries without nutrition and notes they are not counted", async () => {
    const diary = diaryViewData();
    diary.meals.dinner = {
      entries: [{
        id: "entry-2",
        foodName: "Boojum",
        amountUnit: "mg",
        resolvedAmount: 1_000,
        energyMkcal: 0,
        untracked: true,
      }],
      totals: { energyMkcal: 0 },
    };
    render(DiaryDayView, {
      diary,
      shortcutEligibility,
      actions: { entryHref: (entryId) => `/diary/${entryId}/edit` },
    });

    const dinner = page.getByRole("region", { name: "Dinner" });
    await expect.element(dinner.getByRole("link", { name: /Boojum/ }))
      .toHaveTextContent("Untracked");
    await expect.element(dinner.getByText(/kcal/)).not.toBeInTheDocument();
    await expect.element(dinner.getByText(/1 g/)).not.toBeInTheDocument();
    await expect.element(page.getByText("1 untracked item not counted"))
      .toBeInTheDocument();
    await expect.element(
      page.getByRole("region", { name: "Breakfast" }).getByText("120 kcal", { exact: true }),
    ).toBeInTheDocument();
  });

  it("pluralises the untracked note and shows it without a goal", async () => {
    const diary = diaryViewData();
    diary.balances = null;
    diary.meals.snacks = {
      entries: ["a", "b"].map((id) => ({
        id,
        foodName: `Item ${id}`,
        amountUnit: "mg" as const,
        resolvedAmount: 1_000,
        energyMkcal: 0,
        untracked: true,
      })),
      totals: { energyMkcal: 0 },
    };
    render(DiaryDayView, { diary, shortcutEligibility });

    await expect.element(page.getByText("2 untracked items not counted"))
      .toBeInTheDocument();
  });

  it("omits the untracked note when every entry is tracked", async () => {
    render(DiaryDayView, { diary: diaryViewData(), shortcutEligibility });

    await expect.element(page.getByText(/untracked/)).not.toBeInTheDocument();
  });
});
