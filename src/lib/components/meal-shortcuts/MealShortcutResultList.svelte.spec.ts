import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import MealShortcutResultList from "./MealShortcutResultList.svelte";
import type { MealShortcutResult } from "./types";

const shortcut: MealShortcutResult = {
  id: "shortcut-1",
  name: "Chocolate",
  itemCount: 2,
  blocked: false,
  energyMkcal: 250_000,
};

describe("MealShortcutResultList", () => {
  it("opens amounts from the name and applies from plus", async () => {
    render(MealShortcutResultList, {
      shortcuts: [shortcut],
      activeQuery: "",
      selectedDate: "2026-07-18",
      mealSlot: "lunch",
      editHref: (id: string) => `/meal-shortcuts/${id}/edit`,
      applyHref: (id: string) => `/meal-shortcuts/${id}/apply`,
    });

    await expect.element(page.getByRole("link", {
      name: "Choose amounts for Chocolate",
    })).toHaveAttribute("href", "/meal-shortcuts/shortcut-1/edit");
    expect(
      page.getByRole("button", { name: "Add Chocolate to lunch" }).element()
        .closest("form"),
    ).toHaveAttribute("action", "/meal-shortcuts/shortcut-1/apply");
  });

  it("blocks apply when a food is unavailable", async () => {
    render(MealShortcutResultList, {
      shortcuts: [{ ...shortcut, blocked: true, energyMkcal: null }],
      activeQuery: "",
      selectedDate: "2026-07-18",
      mealSlot: "dinner",
      editHref: (id: string) => `/meal-shortcuts/${id}/edit`,
      applyHref: (id: string) => `/meal-shortcuts/${id}/apply`,
    });

    await expect.element(page.getByText("Contains an unavailable food"))
      .toBeInTheDocument();
    await expect.element(page.getByRole("button", {
      name: "Add Chocolate is unavailable until it is fixed",
    })).toBeDisabled();
  });
});
