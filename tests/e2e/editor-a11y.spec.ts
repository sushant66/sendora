import { test, expect } from "@playwright/test";

/**
 * T052 [US3] — Accessibility of the rich-text editor (Constitution Principle III):
 * keyboard operability, labelled controls, correctly exposed editable region.
 * Tagged @a11y so `pnpm test:a11y` runs it. Requires an authenticated session.
 */

test.describe("@a11y rich-text editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/templates");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
    await page.getByRole("button", { name: "New template" }).click();
  });

  test("toolbar controls are labelled and keyboard-operable, editable region is exposed", async ({ page }) => {
    // Editable region exposes a textbox role with an accessible name.
    const editor = page.getByRole("textbox", { name: "Body" });
    await expect(editor).toBeVisible();

    // Toolbar is a labelled toolbar with named toggle buttons.
    const toolbar = page.getByRole("toolbar", { name: /Body formatting/ });
    await expect(toolbar).toBeVisible();
    for (const name of ["Bold", "Italic", "Bulleted list", "Numbered list", "Link"]) {
      await expect(toolbar.getByRole("button", { name })).toBeVisible();
    }

    // Bold toggles via keyboard and reflects pressed state (aria-pressed).
    const bold = toolbar.getByRole("button", { name: "Bold" });
    await bold.focus();
    await page.keyboard.press("Enter");
    await expect(bold).toHaveAttribute("aria-pressed", "true");

    // Typing into the editor works and produces bold content.
    await editor.click();
    await page.keyboard.type("Hello");
    await expect(editor.locator("strong")).toHaveText("Hello");
  });
});
