import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

interface ExportBundle {
  format: string;
  events: unknown[];
}

test("exports demo events and imports them on a new device", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load demo stickers" }).click();
  await page.goto("/audit");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JSON" }).click()
  ]);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("The event export did not produce a downloadable file.");
  const bundle = JSON.parse(await readFile(downloadPath, "utf8")) as ExportBundle;
  expect(bundle.format).toBe("tagtriage.export");
  expect(bundle.events.length).toBeGreaterThan(0);
  const eventCount = bundle.events.length;

  const importContext = await browser.newContext();
  try {
    const importPage = await importContext.newPage();
    await importPage.goto("/audit");
    await importPage.getByLabel("Choose an export file").setInputFiles(downloadPath);
    await expect(importPage.getByText(new RegExp(`${eventCount} new events?`))).toBeVisible();
    await importPage.getByRole("button", { name: "Merge into this device" }).click();
    await expect(importPage.getByText(new RegExp(`Merged ${eventCount} new events? and 0 profiles?\\.`))).toBeVisible();

    const deviceCard = importPage.getByRole("heading", { name: "This device" }).locator("xpath=../../..");
    await expect(deviceCard).toContainText(`${eventCount} events · 0 profiles`);
  } finally {
    await importContext.close();
  }
});
