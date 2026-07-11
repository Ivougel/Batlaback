/**
 * Быстрый старт забега для Playwright-тестов (classic only).
 */

async function runPrepStart(page) {
  await page.evaluate(async () => {
    selectPlayerClass("warrior");
    selectPlayerClass("warrior");
    await startRunFromOverlay();
  });
}

/**
 * Быстрый старт classic prep.
 */
export async function quickStartPrep(page, opts = {}) {
  const { settleMs = 800 } = opts;

  await runPrepStart(page);

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
