import { expect, test, type Page } from "@playwright/test";

function stickerInRoll(page: Page, heading: string, buttonName: RegExp) {
  return page.getByRole("heading", { name: heading }).locator("..").getByRole("button", { name: buttonName }).first();
}

async function loadDemoStickers(page: Page) {
  const button = page.getByRole("button", { name: "Load demo stickers" });
  await button.click();
  await expect(button).toBeHidden();
}

test("records, reloads, and closes an encounter on a Medic 12 sticker", async ({ page }) => {
  await page.goto("/");
  await loadDemoStickers(page);

  const rollHeading = "Medic 12 · LOT-A24-117";
  const sticker = stickerInRoll(page, rollHeading, /Unused \(Pre-encoded\)/);
  await expect(sticker).toBeVisible();
  const stickerLabel = await sticker.getAttribute("aria-label");
  if (!stickerLabel) throw new Error("The demo sticker is missing its accessible label.");
  const separator = stickerLabel.indexOf(": ");
  if (separator < 0) throw new Error("The demo sticker label does not include its ID.");
  const stickerId = stickerLabel.slice("Tap sticker ".length, separator);

  await sticker.click();
  await page.getByRole("button", { name: "Start encounter" }).click();
  await page.getByText("RED", { exact: true }).click();
  await page.getByLabel("Heart rate (bpm)").fill("84");
  await page.getByLabel("Systolic BP (mmHg)").fill("120");
  await page.getByLabel("Diastolic BP (mmHg)").fill("80");
  await page.getByRole("button", { name: "Record vitals" }).click();

  const timeline = page.getByRole("heading", { name: "Encounter timeline" }).locator("xpath=../../..");
  await expect(timeline).toContainText("Triage set to RED");
  await expect(timeline).toContainText("Vitals: BP 120/80");
  await expect(timeline).toContainText("HR 84");

  await page.reload();
  await page.getByRole("button", { name: `Tap sticker ${stickerId}: Encounter (Open)` }).click();
  const reloadedTimeline = page.getByRole("heading", { name: "Encounter timeline" }).locator("xpath=../../..");
  await expect(reloadedTimeline).toContainText("Triage set to RED");
  await expect(reloadedTimeline).toContainText("Vitals: BP 120/80");
  await expect(reloadedTimeline).toContainText("HR 84");

  await page.getByRole("button", { name: "Close and retire sticker" }).click();
  await expect(page.getByRole("heading", { name: "Encounter closed" })).toBeVisible();
  await expect(reloadedTimeline).toContainText(/Encounter closed \(/);
});

test("does not start an encounter from the recalled Medic 7 batch", async ({ page }) => {
  await page.goto("/");
  await loadDemoStickers(page);

  const sticker = stickerInRoll(page, "Medic 7 · LOT-X23-900", /Unused \(Recalled\)/);
  await expect(sticker).toBeVisible();
  await sticker.click();

  await expect(page.getByText("Recalled batch", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start encounter" })).toHaveCount(0);
});
