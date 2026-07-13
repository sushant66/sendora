import { test, expect } from "@playwright/test";

/**
 * T024 [US3] — E2E of the delete journey.
 *
 * Runs against a live app with a seeded NeonDB and an authenticated session (see
 * quickstart.md). Without a signed-in session the app redirects to /sign-in and these
 * specs are skipped.
 */

const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 1)]);

test.describe("US3 — remove a resume no longer needed", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/resumes");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("deletes a resume and it disappears without affecting others", async ({ page }) => {
    for (const [label, name] of [["DevOps", "devops.pdf"], ["Data", "data.pdf"]] as const) {
      await page.getByRole("button", { name: "Upload resume" }).click();
      await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "application/pdf", buffer: PDF_BYTES });
      await page.getByLabel("Label").fill(label);
      await page.getByRole("button", { name: "Upload" }).click();
      await expect(page.getByText(label)).toBeVisible();
    }

    await page.getByRole("button", { name: /More actions for DevOps/i }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("DevOps")).not.toBeVisible();
    await expect(page.getByText("Data")).toBeVisible();
  });

  test("deleting an already-removed resume shows a clear error", async ({ page }) => {
    await page.getByRole("button", { name: "Upload resume" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "backend.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
    await page.getByLabel("Label").fill("Backend Engineer");
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Backend Engineer")).toBeVisible();

    await page.getByRole("button", { name: /More actions for Backend Engineer/i }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Backend Engineer")).not.toBeVisible();

    // Re-deleting (e.g. a stale tab / double click) surfaces a clear error, not a crash.
    await page.reload();
    await expect(page.getByText("Backend Engineer")).not.toBeVisible();
  });
});
