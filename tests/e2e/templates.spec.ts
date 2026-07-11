import { test, expect } from "@playwright/test";

/**
 * T053 [US3] — Create / edit / reuse a custom template. Requires an authenticated session
 * with seeded starter templates (see quickstart.md).
 */

test.describe("US3 — custom templates", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/templates");
    if (page.url().includes("/sign-in")) test.skip(true, "requires an authenticated session (see quickstart.md)");
  });

  test("create with merge fields, block unsupported tokens, edit, and reuse in compose", async ({ page }) => {
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("textbox", { name: "Template name" }).fill("My Outreach");

    // Unsupported merge token is blocked with a warning (FR-011).
    await page.getByRole("textbox", { name: "Subject" }).fill("Hi {{salary}}");
    await page.getByRole("textbox", { name: "Body" }).click();
    await page.keyboard.type("Hi there");
    await page.getByRole("button", { name: "Create template" }).click();
    await expect(page.getByText(/Unsupported merge fields/)).toBeVisible();

    // Fix to a supported token and save.
    await page.getByRole("textbox", { name: "Subject" }).fill("Hi {{first_name}}");
    await page.getByRole("button", { name: "Create template" }).click();
    await expect(page.getByText("My Outreach")).toBeVisible();

    // Reopen, edit, save.
    await page.getByRole("button", { name: "Actions for My Outreach" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Template name" }).fill("My Outreach v2");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("My Outreach v2")).toBeVisible();

    // It is selectable in compose.
    await page.goto("/compose");
    await page.getByRole("button", { name: /Start from a template/ }).click();
    await expect(page.getByRole("option", { name: /My Outreach v2/ })).toBeVisible();
  });
});
