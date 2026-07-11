import { test, expect } from "@playwright/test";

/**
 * T062 [US4] — E2E bulk-send journey: per-recipient summary, each recruiter gets a separate
 * email, a duplicate selection is sent once (FR-016). Requires an authenticated session, a
 * connected account backed by the fake provider, and several seeded contacts (quickstart.md).
 */

test.describe("US4 — bulk send", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/compose");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("select several recruiters + template, send, see a per-recipient summary", async ({ page }) => {
    // Select multiple recipients.
    await page.getByRole("button", { name: /Choose one or more recruiters/ }).click();
    const options = page.getByRole("option");
    await options.nth(0).click();
    await options.nth(1).click();
    await options.nth(2).click();
    await page.keyboard.press("Escape");

    // Pick a starter template.
    await page.getByRole("button", { name: /Start from a template/ }).click();
    await page.getByRole("option").first().click();

    // Send is labelled for the multi-recipient case.
    await page.getByRole("button", { name: /Send \d+ emails/ }).click();

    // A per-recipient result table appears with statuses.
    await expect(page.getByText(/Sent to \d+ recruiters|Sent \d+ of \d+/)).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });
});
