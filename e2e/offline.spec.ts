import { expect, test } from "@playwright/test";

test("serves Capture and Register pages offline after installing the service worker", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tap. Read. Treat." })).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Prepare a sticker before the call." })).toBeVisible();
});
