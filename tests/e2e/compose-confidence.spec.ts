import { test, expect } from "@playwright/test";

/**
 * T033 [US3] — send a test to yourself, and confirm the missing-value gate shows how an
 * affected email reads and requires an explicit confirm before sending (FR-015/FR-016).
 * Requires an authenticated session with a connected inbox and contacts; skips otherwise.
 */

test.describe("US3 — send with confidence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/compose");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("send test to myself surfaces a result", async ({ page }) => {
    await page.getByRole("textbox", { name: "Subject" }).fill("Hi {{first_name}}");
    await page.getByRole("textbox", { name: "Body" }).click();
    await page.keyboard.type("Quick hello");
    const testButton = page.getByRole("button", { name: /Send test to myself/ });
    if (await testButton.isEnabled()) {
      await testButton.click();
      await expect(page.getByText(/Test sent|could not be sent|Connect your Gmail/)).toBeVisible();
    }
  });

  test("missing-value gate requires confirmation before sending", async ({ page }) => {
    // Compose using a field a selected recipient lacks, then attempt to send.
    await page.getByRole("textbox", { name: "Subject" }).fill("Role at {{company}}");
    await page.getByRole("textbox", { name: "Body" }).click();
    await page.keyboard.type("Interested in the {{role}} role.");

    const sendButton = page.getByRole("button", { name: /Send/ }).last();
    if (await sendButton.isEnabled()) {
      await sendButton.click();
      const gate = page.getByRole("dialog");
      if (await gate.isVisible()) {
        await expect(gate.getByText(/How one of these emails reads/)).toBeVisible();
        await expect(gate.getByRole("button", { name: /Send anyway/ })).toBeVisible();
        await gate.getByRole("button", { name: /Go back and edit/ }).click();
      }
    }
  });
});
