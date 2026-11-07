import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import UntrackedEntryFields from "./UntrackedEntryFields.svelte";

describe("UntrackedEntryFields", () => {
  it("renders the name, date and meal fields with the name error", async () => {
    render(UntrackedEntryFields, {
      name: "Boojum",
      diaryDate: "2026-07-24",
      mealSlot: "dinner",
      nameError: "Enter a name",
    });

    const input = page.getByLabelText("What did you eat?");
    await expect.element(input).toHaveValue("Boojum");
    await expect.element(input).toHaveAttribute("aria-invalid", "true");
    await expect.element(page.getByRole("alert")).toHaveTextContent("Enter a name");
    await expect.element(page.getByLabelText("Meal")).toHaveValue("dinner");
  });
});
