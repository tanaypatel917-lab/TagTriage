import { expect, test, type Page } from "@playwright/test";
import { SAMPLE_PATIENT } from "../src/domain/samples";

async function loadDemoRoll(page: Page) {
  await page.getByRole("button", { name: "Load demo stickers" }).click();
  const rollSelect = page.getByLabel("Sticker roll");
  await expect(rollSelect).toBeVisible();
  const option = rollSelect.locator("option").filter({ hasText: "LOT-A24-117" });
  const value = await option.getAttribute("value");
  if (!value) throw new Error("The Medic 12 demo roll was not available.");
  await rollSelect.selectOption(value);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("rewrites, writes, and reads a personal sticker", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Fill sample patient" }).click();
  await page.getByRole("button", { name: "Use sample record" }).click();
  await page.getByRole("button", { name: "Run rewriter" }).click();
  await expect(page.getByRole("list", { name: "Ranked alerts" })).toBeVisible();

  await loadDemoRoll(page);
  await page.getByRole("checkbox", { name: /I approve writing these facts to the sticker/ }).check();
  await page.getByRole("button", { name: "Write sticker" }).click();
  await expect(page.getByText(/written and registered/)).toBeVisible();

  await page.goto("/");
  const sticker = page.getByRole("button", {
    name: new RegExp(`Tap sticker .*: ${escapeRegex(SAMPLE_PATIENT.name)} \\(Personal\\)`)
  });
  await sticker.click();

  const profile = page.getByRole("region", { name: SAMPLE_PATIENT.name });
  await expect(profile.getByRole("heading", { name: SAMPLE_PATIENT.name })).toBeVisible();
  const criticalFact = SAMPLE_PATIENT.allergies[0] ?? SAMPLE_PATIENT.bloodType;
  if (!criticalFact) throw new Error("The sample patient has no critical fact to verify.");
  await expect(profile).toContainText(new RegExp(escapeRegex(criticalFact), "i"));
});

test("shows a write failure without a success banner", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Fill sample patient" }).click();
  await loadDemoRoll(page);
  await page.getByRole("checkbox", { name: /I approve writing these facts to the sticker/ }).check();
  await page.getByRole("checkbox", { name: /Simulator: fail the next write/ }).check();
  await page.getByRole("button", { name: "Write sticker" }).click();

  await expect(page.getByText("Sticker not written", { exact: true })).toBeVisible();
  await expect(page.getByText(/written and registered/)).toHaveCount(0);
});
