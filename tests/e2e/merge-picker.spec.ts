import { test, expect } from "@playwright/test";

/**
 * T023 [US2] — insert merge fields via the "/" slash menu in the template editor and compose,
 * and via the subject "Insert field" affordance. Requires an authenticated session; skips
 * cleanly when unauthenticated.
 */

test.describe("US2 — merge field picker", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/templates");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("slash menu inserts an atomic chip in the template body", async ({ page }) => {
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template name" }).fill("Picker test");
    await page.getByRole("textbox", { name: "Subject" }).fill("Hi there");

    const body = page.getByRole("textbox", { name: "Body" });
    await body.click();
    await page.keyboard.type("Hi ");
    await page.keyboard.type("/");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.getByRole("option", { name: /First name/ }).click();

    // The inserted field is a chip (a single focusable unit), not raw text.
    await expect(page.locator(".sendora-merge-chip")).toHaveCount(1);
  });

  test("subject Insert field affordance inserts a token", async ({ page }) => {
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("button", { name: /Insert field/ }).click();
    await page.getByRole("menuitem", { name: /Company/ }).click();
    await expect(page.getByRole("textbox", { name: "Subject" })).toHaveValue(/\{\{company\}\}/);
  });
});
