import { test, expect } from "@playwright/test";

/**
 * T009 [US1] — E2E of the upload journey.
 *
 * Runs against a live app with a seeded NeonDB and an authenticated session (see
 * quickstart.md). Without a signed-in session the app redirects to /sign-in and these
 * specs are skipped.
 */

const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 1)]);

test.describe("US1 — save a labeled resume", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/resumes");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("uploads a PDF with a label and it appears saved", async ({ page }) => {
    await page.getByRole("button", { name: "Upload resume" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "backend.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
    await page.getByLabel("Label").fill("Backend Engineer");
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText("Backend Engineer")).toBeVisible();
  });

  test("rejects a second upload with the same active label", async ({ page }) => {
    await page.getByRole("button", { name: "Upload resume" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "backend2.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
    await page.getByLabel("Label").fill("Backend Engineer");
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText(/already have.*Backend Engineer/i)).toBeVisible();
  });

  test("rejects a non-PDF file", async ({ page }) => {
    await page.getByRole("button", { name: "Upload resume" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await page.getByLabel("Label").fill("Notes");
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText(/must be a PDF/i)).toBeVisible();
  });

  test("rejects an upload with no label", async ({ page }) => {
    await page.getByRole("button", { name: "Upload resume" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "backend3.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByText(/label is required/i)).toBeVisible();
  });
});
