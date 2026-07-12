import { test, expect } from "@playwright/test";

/**
 * T031 [US4] — E2E of the replace + view history + restore journey, including that
 * version numbers never reset or repeat across an archive-then-reupload-then-restore
 * cycle.
 *
 * Runs against a live app with a seeded NeonDB and an authenticated session (see
 * quickstart.md). Without a signed-in session the app redirects to /sign-in and these
 * specs are skipped. History expands via the table's built-in row-expansion chevron
 * (accessible name "Expand row"), not a menu item.
 */

const V1 = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("version one"), Buffer.alloc(50, 1)]);
const V2 = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("version two"), Buffer.alloc(50, 2)]);
const V3 = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("version three"), Buffer.alloc(50, 3)]);

async function upload(page: import("@playwright/test").Page, fileName: string, bytes: Buffer, label: string) {
  await page.getByRole("button", { name: "Upload resume" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: fileName, mimeType: "application/pdf", buffer: bytes });
  await page.getByLabel("Label").fill(label);
  await page.getByRole("button", { name: "Upload" }).click();
}

test.describe("US4 — replace a resume without losing the old one", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/resumes");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("uploading under an existing label keeps the previous version as history", async ({ page }) => {
    await upload(page, "backend-v1.pdf", V1, "Backend Engineer");
    await expect(page.getByText("backend-v1.pdf")).toBeVisible();

    await upload(page, "backend-v2.pdf", V2, "Backend Engineer");
    await expect(page.getByText("backend-v2.pdf")).toBeVisible();
    // Only one active row for the label — the new version, not two rows.
    await expect(page.getByText("backend-v1.pdf")).not.toBeVisible();

    await page.getByRole("row", { name: /Backend Engineer/ }).getByRole("button", { name: "Expand row" }).click();
    await expect(page.getByText("backend-v1.pdf")).toBeVisible();
    await expect(page.getByText("backend-v2.pdf")).toBeVisible();
  });

  test("restoring an earlier version reactivates it and archives the current one", async ({ page }) => {
    await upload(page, "devops-v1.pdf", V1, "DevOps");
    await upload(page, "devops-v2.pdf", V2, "DevOps");

    await page.getByRole("row", { name: /DevOps/ }).getByRole("button", { name: "Expand row" }).click();
    await page.getByRole("row", { name: /devops-v1\.pdf/ }).getByRole("button", { name: /actions|more/i }).click();
    await page.getByRole("menuitem", { name: "Restore" }).click();

    // v1 is active again; v2 is now the one in history.
    await expect(page.getByText("devops-v1.pdf")).toBeVisible();
    await page.getByRole("row", { name: /DevOps/ }).getByRole("button", { name: "Expand row" }).click();
    await expect(page.getByText("devops-v2.pdf")).toBeVisible();
  });

  test("version numbers never reset or repeat across an archive-then-reupload-then-restore cycle", async ({ page }) => {
    await upload(page, "data-v1.pdf", V1, "Data"); // v1
    await upload(page, "data-v2.pdf", V2, "Data"); // v2, v1 archived

    await page.getByRole("row", { name: /Data/ }).getByRole("button", { name: /actions|more/i }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click(); // archives v2, no active row left for "Data"

    await upload(page, "data-v3.pdf", V3, "Data"); // must be v3, not a reset to v1

    await page.getByRole("row", { name: /Data/ }).getByRole("button", { name: "Expand row" }).click();
    await expect(page.getByText(/version 1\b/i)).toBeVisible();
    await expect(page.getByText(/version 2\b/i)).toBeVisible();
    await expect(page.getByText(/version 3\b/i)).toBeVisible();
  });
});
