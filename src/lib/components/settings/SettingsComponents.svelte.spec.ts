import { createRawSnippet } from "svelte";
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import SettingsRow from "./SettingsRow.svelte";
import SettingsSection from "./SettingsSection.svelte";

describe("SettingsSection", () => {
  it("associates its heading with the section and renders its rows", async () => {
    render(SettingsSection, {
      headingId: "goals-heading",
      title: "Goals",
      children: createRawSnippet(() => ({
        render: () => "<p>Section content</p>",
      })),
    });

    const heading = page.getByRole("heading", { level: 2, name: "Goals" });
    await expect.element(heading).toHaveAttribute("id", "goals-heading");
    await expect.element(page.getByText("Section content")).toBeInTheDocument();

    const section = document.querySelector("section");
    expect(section?.getAttribute("aria-labelledby")).toBe("goals-heading");
  });
});

describe("SettingsRow", () => {
  it("renders a linked description row with a separator and keyboard focus", async () => {
    render(SettingsRow, {
      label: "Goal history",
      description: "Effective-dated changes",
      route: "/settings/goals/history",
      separatorBefore: true,
    });

    const link = page.getByRole("link", { name: /Goal history/ });
    await expect.element(link).toHaveAttribute("href", "/settings/goals/history");

    const linkElement = document.querySelector("a");
    linkElement?.focus();
    expect(document.activeElement).toBe(linkElement);
    expect(document.querySelector('[aria-hidden="true"].border-t')).not.toBeNull();
  });

  it("renders a static value row without making it interactive", async () => {
    render(SettingsRow, {
      label: "Account",
      value: "Patrick · patrick@example.com",
    });

    await expect.element(page.getByText("Patrick · patrick@example.com")).toBeInTheDocument();
    expect(document.querySelector("a")).toBeNull();
    expect(document.querySelector("p.truncate")).not.toBeNull();
    expect(document.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});
