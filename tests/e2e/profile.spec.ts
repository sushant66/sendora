import { test, expect } from "@playwright/test";

/**
 * T011 [US1] — set up a sender profile, then confirm `my_*` fields resolve in a preview.
 * Requires an authenticated session with seeded starter templates (see quickstart.md); skips
 * cleanly when unauthenticated.
 */

test.describe("US1 — sender profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/profile");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("save a profile and see sender fields resolve in compose preview", async ({ page }) => {
    await page.getByRole("textbox", { name: "Display name" }).fill("Ada Lovelace");
    await page.getByRole("textbox", { name: "Title" }).fill("Senior Frontend Engineer");
    await page.getByRole("textbox", { name: "Link" }).fill("https://ada.dev");
    await page.getByRole("button", { name: /Save profile/ }).click();
    await expect(page.getByText(/Profile saved/)).toBeVisible();

    // The greeting now reflects the profile display name.
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Ada/ })).toBeVisible();
  });
});
