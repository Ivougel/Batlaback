/**
 * Быстрый старт забега для Playwright-тестов (solo prep).
 */
export async function quickStartPrep(page, opts = {}) {
  const {
    mode = "solo",
    playerClass = "warrior",
    enemyClass = "mage",
    settleMs = 800,
  } = opts;

  await page.evaluate(({ mode, playerClass, enemyClass }) => {
    selectGameMode(mode);
    selectPlayerClass(playerClass);
    if (typeof selectCompanion === "function") {
      selectCompanion(
        typeof defaultCompanionForClass === "function"
          ? defaultCompanionForClass(playerClass)
          : "s_stranger",
      );
    }
    selectOpponentClass(enemyClass);
    startRunFromOverlay();
  }, { mode, playerClass, enemyClass });

  await page.waitForFunction(
    () => document.body.classList.contains("screen-app-visible")
      && document.getElementById("app")?.dataset.phase === "prep"
      && document.getElementById("class-overlay")?.classList.contains("hidden"),
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
