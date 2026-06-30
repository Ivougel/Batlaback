/**
 * Pixel-snapshots боевой сцены (flank-arena) после quick start.
 * Обновить эталоны: npm run test:snapshots:update
 */
import { test, expect, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html?vexp=0`;

const BATTLE_SNAPSHOT_PROFILES = [
  { name: "iphone-portrait", device: devices["iPhone 14 Pro Max"] },
  {
    name: "ipad-landscape",
    device: { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } },
  },
  { name: "desktop", device: { viewport: { width: 1440, height: 1080 } } },
];

async function enterBattle(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 10000 });
  await page.evaluate(() => {
    selectGameMode("solo");
    selectPlayerClass("warrior");
    selectOpponentClass("mage");
    startRunFromOverlay();
  });
  await page.waitForFunction(
    () => document.getElementById("app")?.dataset.phase === "prep",
    { timeout: 8000 },
  );
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
  });
  await page.evaluate(() => startBattle());
  await page.waitForFunction(
    () => document.getElementById("app")?.dataset.phase === "battle",
    { timeout: 10000 },
  );
  await page.waitForFunction(
    () => !document.getElementById("battle-countdown-overlay")
      ?.classList.contains("battle-countdown-overlay-visible"),
    { timeout: 12000 },
  );
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
    if (typeof toggleBattlePause === "function" && typeof isBattlePaused === "function" && !isBattlePaused()) {
      toggleBattlePause();
    }
  });
  await page.waitForTimeout(400);
}

for (const profile of BATTLE_SNAPSHOT_PROFILES) {
  test(`${profile.name} — battle arena`, async ({ browser }) => {
    const context = await browser.newContext({ ...profile.device });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    try {
      await enterBattle(page);

      const arena = page.locator("#app[data-phase=\"battle\"] .prep-field-column");
      await expect(arena).toBeVisible({ timeout: 8000 });

      const box = await arena.boundingBox();
      if (!box || box.height < 80) {
        throw new Error(`battle arena too small: ${box?.height ?? 0}px`);
      }
      if (errors.length) throw new Error(errors.join("; "));

      await expect(arena).toHaveScreenshot(`${profile.name}-battle-arena.png`, {
        mask: [
          page.locator("#layer-fx"),
          page.locator(".battle-countdown-overlay"),
        ],
      });
    } finally {
      await context.close();
    }
  });
}
