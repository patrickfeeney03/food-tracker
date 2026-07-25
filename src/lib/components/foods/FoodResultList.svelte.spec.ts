import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import FoodResultList, {
  type FoodResultView,
} from "./FoodResultList.svelte";

const food: FoodResultView = {
  id: "food-1",
  name: "Greek yoghurt",
  brand: "Example",
  amountUnit: "mg",
  basisAmount: 100_000,
  energyMkcalPerBasis: 90_000,
  latestUse: {
    amountUnit: "mg",
    resolvedAmount: 150_000,
    energyMkcal: 135_000,
  },
  quickAddMutationId: null,
};

describe("FoodResultList", () => {
  it("renders route-provided open and edit links", async () => {
    render(FoodResultList, {
      foods: [food],
      activeQuery: "",
      mealSlot: "breakfast",
      actions: {
        foodHref: (foodId) => `/foods/${foodId}/log`,
        editHref: (foodId) => `/foods/${foodId}/edit`,
      },
    });

    await expect.element(page.getByRole("heading", { name: "Recent foods" }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("link", {
      name: "Add Greek yoghurt to breakfast",
    })).toHaveAttribute("href", "/foods/food-1/log");
    await expect.element(page.getByRole("link", {
      name: "Edit Greek yoghurt",
    })).toHaveAttribute("href", "/foods/food-1/edit");
  });

  it("renders unavailable controls as disabled without action callbacks", async () => {
    render(FoodResultList, {
      foods: [{ ...food, quickAddMutationId: "mutation-1" }],
      activeQuery: "Greek",
      mealSlot: "lunch",
    });

    await expect.element(page.getByRole("button", {
      name: "Quick add Greek yoghurt is unavailable",
    })).toBeDisabled();
    await expect.element(page.getByText("Edit")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("allows capability-specific empty copy without changing the default", async () => {
    render(FoodResultList, {
      foods: [],
      activeQuery: "missing",
      mealSlot: "lunch",
      emptyQueryMessage: "No saved foods match this search.",
    });

    await expect.element(page.getByText("No saved foods match this search."))
      .toBeInTheDocument();
    await expect.element(page.getByText(/create “missing”/))
      .not.toBeInTheDocument();
  });
});
