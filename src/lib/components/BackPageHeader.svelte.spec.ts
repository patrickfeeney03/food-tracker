import { page } from "vitest/browser";
import { resolve } from "$app/paths";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import BackPageHeader from "./BackPageHeader.svelte";

describe("BackPageHeader", () => {
  it("renders the page title, description, and accessible back navigation", async () => {
    render(BackPageHeader, {
      href: resolve("/settings"),
      backLabel: "Back to settings",
      title: "Daily targets",
      description: "Changes apply from the selected date.",
    });

    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Daily targets");
    await expect.element(page.getByText("Changes apply from the selected date.")).toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Back to settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });
});
