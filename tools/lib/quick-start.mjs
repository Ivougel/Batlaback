/**
 * Быстрый старт забега для Playwright-тестов (classic / hotseat).
 */

async function runPrepStart(page, mode = "classic") {
  await page.evaluate(async (runMode) => {
    if (typeof selectGameMode === "function") {
      selectGameMode(runMode);
      selectGameMode(runMode);
    } else {
      selectedGameMode = runMode;
    }
    selectPlayerClass("warrior");
    selectPlayerClass("warrior");
    if (runMode === "hotseat") {
      if (typeof selectOpponentClass === "function") {
        selectOpponentClass("rogue");
        selectOpponentClass("rogue");
      } else {
        selectedEnemyClass = "rogue";
        if (typeof showSummaryStep === "function") showSummaryStep();
      }
    }
    await startRunFromOverlay();
  }, mode);
}

/**
 * Быстрый старт prep для указанного режима.
 * @param {import('playwright').Page} page
 * @param {{ mode?: string, settleMs?: number }} opts
 */
export async function quickStartPrep(page, opts = {}) {
  const { settleMs = 800, mode = "classic" } = opts;

  await runPrepStart(page, mode);

  await page.waitForFunction(
    () =>
      document.body.classList.contains("screen-app-visible") &&
      document.getElementById("app")?.dataset.phase === "prep" &&
      document.getElementById("class-overlay")?.classList.contains("hidden"),
    { timeout: 12000 },
  );
  await page.waitForTimeout(settleMs);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
    window.syncMobileOverlayAnchors?.();
    window.syncMobileShopFabPosition?.();
  });
  await page.waitForTimeout(400);
}
