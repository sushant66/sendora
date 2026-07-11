import { test, expect } from "@playwright/test";

/**
 * T020 [US1] — E2E of the import journey.
 *
 * Runs against a live app with a seeded NeonDB and an authenticated session (see
 * quickstart.md). Playwright's storageState should carry a signed-in session; without
 * it the app redirects to /sign-in and these specs are skipped.
 */

const CSV = [
  "name,email,company,role",
  "Ada Lovelace,ada@analytical.io,Analytical Engines,Lead Recruiter",
  "Alan Turing,alan@bletchley.uk,Bletchley,Talent",
  "Broken Row,not-an-email,,",
].join("\n");

test.describe("US1 — import recruiter contacts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contacts/import");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("paste → map → import reports imported / invalid without dropping rows", async ({ page }) => {
    await page.getByRole("radio", { name: "Paste rows" }).click();
    await page.getByRole("textbox").fill(CSV);
    await page.getByRole("button", { name: "Preview rows" }).click();

    // Column mapping auto-detected; 3 rows detected (1 invalid).
    await expect(page.getByText(/3 rows detected/)).toBeVisible();

    await page.getByRole("button", { name: /Import 3 rows/ }).click();

    // Summary reports the valid imports and surfaces the invalid row (never silently dropped).
    await expect(page.getByText(/Imported 2 contacts/)).toBeVisible();
    await expect(page.getByText(/Invalid rows skipped \(1\)/)).toBeVisible();
    await expect(page.getByText(/Row 3: missing\/invalid email/)).toBeVisible();

    // Valid rows are now visible in the contacts list.
    await page.getByRole("link", { name: "View contacts" }).click();
    await expect(page.getByText("ada@analytical.io")).toBeVisible();
    await expect(page.getByText("alan@bletchley.uk")).toBeVisible();
  });

  test("re-importing the same rows reports them as duplicates", async ({ page }) => {
    await page.getByRole("radio", { name: "Paste rows" }).click();
    await page.getByRole("textbox").fill(CSV);
    await page.getByRole("button", { name: "Preview rows" }).click();
    await page.getByRole("button", { name: /Import 3 rows/ }).click();
    await expect(page.getByText(/Duplicates skipped/)).toBeVisible();
  });
});
