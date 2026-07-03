/**
 * Pixel-snapshots class overlay (стабильный boot).
 * Обновить эталоны: npm run test:snapshots:update
 */
import { test, expect, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const SNAPSHOT_PROFILES = [
  { name: "iphone-portrait", device: devices["iPhone 14 Pro Max"] },
  { name: "iphone-landscape", device: { ...devices["iPhone 14 Pro Max"], viewport: { width: 932, height: 430 } } },
  { name: "ipad-portrait", device: devices["iPad Mini"] },
  { name: "ipad-landscape", device: { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } } },
  { name: "desktop", device: { viewport: { width: 1440, height: 1080 } } },
];

for (const profile of SNAPSHOT_PROFILES) {
  test(`${profile.name} — class overlay modal`, async ({ browser }) => {
    const context = await browser.newContext({ ...profile.device });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1600);
      await page.evaluate(() => window.applyUiLayout?.());

      const modal = page.locator("#class-overlay .class-modal");
      await expect(modal).toBeVisible({ timeout: 8000 });

      const box = await modal.boundingBox();
      if (!box || box.height < 120) {
        throw new Error(`class-modal collapsed: ${box?.height ?? 0}px`);
      }
      if (errors.length) throw new Error(errors.join("; "));

      await expect(modal).toHaveScreenshot(`${profile.name}-class-modal.png`);
    } finally {
      await context.close();
    }
  });
}
