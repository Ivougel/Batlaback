/**
 * Smoke: intro classic — мутации отключены, двойной клик ведёт к summary.
 * Запуск: npx playwright test tools/mutation-gallery.spec.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

async function bootClassicClassPicker(page) {
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.syncClassOverlayAnchors?.();
  });
  await page.waitForTimeout(300);
}

test("classic mode — mutation gallery stays hidden", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1200);
  await bootClassicClassPicker(page);
  await page.locator('#class-step-player:not(.hidden) .class-card[data-class="priest"]').click();

  await expect(page.locator("#class-mutation-gallery")).toBeHidden();
  if (errors.length) throw new Error(errors.join("; "));
});

test("classic mode — double hero pick advances to summary", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1200);

  await bootClassicClassPicker(page);
  const hero = page.locator('#class-step-player:not(.hidden) .class-card[data-class="warrior"]');
  await hero.click();
  await hero.click();

  await expect(page.locator("#class-step-summary")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#class-summary-lead")).toContainText("Ваш выбор:");
  await expect(page.locator("#btn-class-summary-start")).toBeVisible();
});
