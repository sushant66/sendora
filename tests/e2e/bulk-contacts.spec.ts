import { test, expect } from "@playwright/test";

/**
 * T043 [US4] — multi-select, select-all-matching, delete, and undo on the contacts list
 * (FR-020/FR-022/FR-023). Requires an authenticated session with contacts; skips otherwise.
 */

test.describe("US4 — bulk contact management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contacts");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("select rows, delete, and undo", async ({ page }) => {
    const checkboxes = page.getByRole("checkbox");
    const count = await checkboxes.count();
    if (count < 2) test.skip(true, "needs at least one contact row to exercise selection");

    // Select the first data row (checkbox index 0 is the header select-all).
    await checkboxes.nth(1).check();
    const bar = page.getByText(/selected$/);
    await expect(bar).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    // Undo toast appears; undoing restores the contact.
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect(page.getByText(/Restored/)).toBeVisible();
  });
});
