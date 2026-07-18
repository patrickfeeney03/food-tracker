import { createRawSnippet } from "svelte";
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import FeedbackBanner from "./FeedbackBanner.svelte";

describe("FeedbackBanner", () => {
  it("announces successful feedback as a status", async () => {
    render(FeedbackBanner, { message: "Target period saved." });

    await expect.element(page.getByRole("status")).toHaveTextContent("Target period saved.");
  });

  it("announces dangerous feedback as an alert", async () => {
    render(FeedbackBanner, {
      message: "Targets could not be saved.",
      tone: "danger",
    });

    await expect.element(page.getByRole("alert")).toHaveTextContent("Targets could not be saved.");
  });

  it("renders an optional feedback action", async () => {
    render(FeedbackBanner, {
      message: "Shortcut added.",
      action: createRawSnippet(() => ({
        render: () => '<button type="button">Undo</button>',
      })),
    });

    await expect.element(page.getByRole("status")).toHaveTextContent("Shortcut added.");
    await expect.element(page.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });
});
