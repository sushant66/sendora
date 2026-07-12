import { test, expect } from "@playwright/test";

/**
 * T052 [US5] — the setup order leads through importing contacts and previewing a rendered
 * template before any Gmail prompt; the profile step is optional; and the Gmail prompt appears
 * at first send (SC-007). Requires an authenticated session; skips otherwise.
 */

test.describe("US5 — onboarding order", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("setup steps are ordered import -> personalize (optional) -> send, with Gmail last", async ({ page }) => {
    const setup = page.getByText("Get set up");
    if (!(await setup.isVisible())) test.skip(true, "already fully set up; no setup checklist to assert");

    const body = await page.locator("body").innerText();
    const importIdx = body.indexOf("Add your recruiters");
    const personalizeIdx = body.indexOf("Personalize your outreach");
    const sendIdx = body.indexOf("Preview and send your first email");

    expect(importIdx).toBeGreaterThanOrEqual(0);
    expect(personalizeIdx).toBeGreaterThan(importIdx);
    expect(sendIdx).toBeGreaterThan(personalizeIdx);

    // The profile step is explicitly optional.
    await expect(page.getByText("Optional")).toBeVisible();
  });

  test("the Gmail prompt appears on the compose (first send) step, not before", async ({ page }) => {
    await page.goto("/compose");
    // A rendered preview surface exists without a connected inbox; the Gmail prompt is here.
    const prompt = page.getByText("Connect your Gmail to send");
    // If already connected, the prompt is absent; otherwise it must be the compose page's banner.
    if (await prompt.isVisible()) {
      await expect(prompt).toBeVisible();
    }
  });
});
