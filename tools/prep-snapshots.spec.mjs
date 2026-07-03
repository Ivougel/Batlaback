/**
 * Pixel-snapshots prep (solo + lobby) — iPad Mini landscape PWA.
 * Обновить: npm run test:snapshots:update
 */
import { test, expect, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const IPAD_LANDSCAPE = {
  ...devices["iPad Mini"],
  viewport: { width: 1024, height: 768 },
  isMobile: true,
  hasTouch: true,
};

async function startPrep(page, mode) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 10000 });
  await page.evaluate((gameMode) => {
    selectGameMode(gameMode);
    if (gameMode === "td" && typeof selectTdDifficulty === "function") {
      selectTdDifficulty("normal");
    }
    selectPlayerClass("priest");
    if (typeof selectCompanion === "function") {
      selectCompanion(
        typeof defaultCompanionForClass === "function"
          ? defaultCompanionForClass("priest")
          : "s_stranger",
      );
    }
    if (gameMode === "versus") selectOpponentClass("warrior");
    else if (gameMode !== "lobby" && gameMode !== "td") selectOpponentClass("mage");
    startRunFromOverlay();
  }, mode);
  await page.waitForFunction(
    () => document.getElementById("app")?.dataset.phase === "prep",
    { timeout: 12000 },
  );
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
    window.fitCanvasDisplaySize?.();
  });
  await page.waitForTimeout(600);
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "tools/ui-structure-manifest.json"), "utf8"),
);

for (const snap of manifest.prepSnapshots) {
  test(`${snap.name} — prep field`, async ({ browser }) => {
    const context = await browser.newContext({ ...IPAD_LANDSCAPE });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    try {
      await startPrep(page, snap.mode);
      const target = page.locator(snap.target);
      await expect(target).toBeVisible({ timeout: 8000 });

      const box = await target.boundingBox();
      if (!box || box.height < 200) {
        throw new Error(`prep target too small: ${box?.height ?? 0}px`);
      }
      if (errors.length) throw new Error(errors.join("; "));

      await expect(target).toHaveScreenshot(`${snap.name}.png`, {
        mask: [
          page.locator("#prep-hero-card-timer"),
          page.locator("#prep-hud-hero-round"),
        ],
      });
    } finally {
      await context.close();
    }
  });
}
