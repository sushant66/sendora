import { test, expect } from "@playwright/test";

/**
 * T067 [US5] — History listing + re-contact warning. Requires an authenticated session
 * with prior sends (run send-single/bulk first, or seed) — see quickstart.md.
 */

test.describe("US5 — sending history & re-contact warning", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/history");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("history lists each send with recipient, template, time, and outcome", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByText("Sent").first()).toBeVisible();
  });

  test("composing to an already-emailed recruiter shows the re-contact warning (FR-021)", async ({ page }) => {
    // Read the first history recipient, then compose to them again.
    const firstRecipient = await page.getByRole("row").nth(1).getByRole("cell").first().innerText();

    await page.goto("/compose");
    await page.getByRole("button", { name: /Choose one or more recruiters/ }).click();
    await page.getByRole("option", { name: new RegExp(firstRecipient.split("@")[0] ?? firstRecipient, "i") }).first().click();
    await page.keyboard.press("Escape");

    await expect(page.getByText(/already emailed/i)).toBeVisible();
  });
});
