/**
 * Smoke: галерея мутаций на экране выбора класса.
 * Запуск: npx playwright test tools/mutation-gallery.spec.mjs
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

test("mutation gallery — 8 silhouettes after class pick", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.applyUiLayout?.());

  await page.locator('[data-game-mode="solo"]').click();
  await page.locator('[data-class="priest"]').click();

  const gallery = page.locator("#class-mutation-gallery");
  await expect(gallery).toBeVisible({ timeout: 5000 });
  await expect(gallery.locator(".mutation-silhouette")).toHaveCount(8);
  await expect(gallery).toContainText("8 путей R16");

  if (errors.length) throw new Error(errors.join("; "));
});

test("mutation gallery — second click advances to companion", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1200);

  await page.locator('[data-game-mode="solo"]').click();
  await page.locator('[data-class="mage"]').click();
  await expect(page.locator("#class-mutation-gallery")).toBeVisible();

  await page.locator('[data-class="mage"]').click();
  await expect(page.locator("#class-step-companion")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#companion-grid .companion-card").first()).toBeVisible();
});
