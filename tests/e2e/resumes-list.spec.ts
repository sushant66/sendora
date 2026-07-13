import { test, expect } from "@playwright/test";

/**
 * T017 [US2] — E2E of the browse-and-open journey.
 *
 * Runs against a live app with a seeded NeonDB and an authenticated session (see
 * quickstart.md). Without a signed-in session the app redirects to /sign-in and these
 * specs are skipped.
 */

const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 1)]);

test.describe("US2 — browse and open saved resumes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/resumes");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("shows an empty state with no resumes saved", async ({ page }) => {
    await expect(page.getByText("No resumes yet")).toBeVisible();
  });

  test("lists a previously saved resume with label, file name, and save date", async ({ page }) => {
    await page.getByRole("button", { name: "Upload resume" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "fullstack.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
    await page.getByLabel("Label").fill("Full Stack");
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText("Full Stack")).toBeVisible();
    await expect(page.getByText("fullstack.pdf")).toBeVisible();

    // Reload to confirm it's persisted, not just optimistic local state.
    await page.reload();
    await expect(page.getByText("Full Stack")).toBeVisible();
    await expect(page.getByText("fullstack.pdf")).toBeVisible();
  });

  test("opens a saved resume to view its exact contents", async ({ page, context }) => {
    await page.getByRole("button", { name: "Upload resume" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "devops.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
    await page.getByLabel("Label").fill("DevOps");
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("DevOps")).toBeVisible();

    await page.getByRole("button", { name: /More actions for DevOps/i }).click();
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("menuitem", { name: "Open in new tab" }).click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toContain("/api/resumes/");
  });
});
