import { test, expect } from "@playwright/test";

/**
 * T035 [US2] — E2E single-send journey.
 *
 * Runs against a live app with a seeded NeonDB, an authenticated session, and a connected
 * email account backed by the FAKE provider (set the provider seam to the fake in the test
 * environment — see lib/email/fake-provider.ts). Skipped when unauthenticated.
 */

test.describe("US2 — single templated send", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/compose");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("pick recruiter + starter template, preview resolves merge fields, send", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Compose" })).toBeVisible();

    // Choose the first recruiter and a starter template.
    await page.getByRole("button", { name: /Choose a recruiter/ }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /Start from a template/ }).click();
    await page.getByRole("option").first().click();

    // The live preview resolves merge fields (no literal {{token}} anywhere) — SC-004.
    const preview = page.locator(".sendora-email-body");
    await expect(preview).toBeVisible();
    await expect(preview).not.toContainText("{{");

    // Send and confirm success.
    await page.getByRole("button", { name: "Send email" }).click();
    await expect(page.getByText("Email sent")).toBeVisible();
  });
});

/**
 * 003-resume-attachments T007 — attaching a saved resume to a single send. Requires the
 * same session as above, plus at least one saved resume (see 002-resume-storage's
 * quickstart.md US1).
 */
test.describe("003-resume-attachments — attach a resume to a single send", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/compose");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("selecting a resume shows it in the preview and sends it attached", async ({ page }) => {
    await page.getByRole("button", { name: /Choose a recruiter/ }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /Start from a template/ }).click();
    await page.getByRole("option").first().click();

    await page.getByRole("button", { name: /No attachment/ }).click();
    await page.getByRole("option").first().click();

    await expect(page.getByText(/Attachment: /)).toBeVisible();

    await page.getByRole("button", { name: "Send email" }).click();
    await expect(page.getByText("Email sent")).toBeVisible();
  });

  test("leaving the selector on \"No attachment\" sends exactly as before", async ({ page }) => {
    await page.getByRole("button", { name: /Choose a recruiter/ }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /Start from a template/ }).click();
    await page.getByRole("option").first().click();

    await expect(page.getByText(/Attachment: /)).not.toBeVisible();
    await page.getByRole("button", { name: "Send email" }).click();
    await expect(page.getByText("Email sent")).toBeVisible();
  });
});
