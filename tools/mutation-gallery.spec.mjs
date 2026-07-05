/**
 * Smoke: галерея мутаций и саммари на экране выбора.
 * Запуск: npx playwright test tools/mutation-gallery.spec.mjs
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

async function pickHeroAndCompanion(page) {
  await page.locator('[data-game-mode="solo"]').click();
  await page.locator('#player-class-grid [data-class="priest"]').click();
  await expect(page.locator("#class-mutation-gallery")).toBeVisible({ timeout: 5000 });
  await page.locator('#player-class-grid [data-class="priest"]').click();
  await expect(page.locator("#class-step-companion")).toBeVisible({ timeout: 5000 });
  await page.locator('[data-companion="s_light"]').click();
  await page.locator('[data-companion="s_light"]').click();
}

test("mutation gallery — 8 silhouettes after hero pick", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.applyUiLayout?.());

  await page.locator('[data-game-mode="solo"]').click();
  await page.locator('#player-class-grid [data-class="priest"]').click();

  const gallery = page.locator("#class-mutation-gallery");
  await expect(gallery).toBeVisible({ timeout: 5000 });
  await expect(gallery.locator(".mutation-silhouette")).toHaveCount(8);
  await expect(gallery).toContainText("8 путей развития");

  if (errors.length) throw new Error(errors.join("; "));
});

test("mutation intent yes advances to companion step", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1200);

  await page.locator('[data-game-mode="solo"]').click();
  await page.locator('#player-class-grid [data-class="warrior"]').click();
  await page.locator('.mutation-silhouette[data-mutation-id="w_berserk"]').click();
  await page.locator(".mutation-intent-popup-yes").click();

  await expect(page.locator("#class-step-companion")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#class-modal-subtitle")).toContainText("Воин-мартовичок");
  await expect(page.locator("#class-modal-subtitle")).toContainText("с каким спутником пойдёте");
});

test("companion reclick advances to summary", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1200);

  await pickHeroAndCompanion(page);

  await expect(page.locator("#class-step-summary")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#class-summary-lead")).toContainText("Жрец-мыковичок");
  await expect(page.locator("#class-summary-lead")).toContainText("Свет");
  await expect(page.locator("#btn-class-summary-start")).toBeVisible();
});
