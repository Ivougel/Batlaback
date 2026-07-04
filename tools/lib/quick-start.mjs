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

/**
 * Быстрый старт lobby2p (2 игрока + боты).
 */
export async function quickStartLobby2p(page, opts = {}) {
  const {
    playerClass = "warrior",
    enemyClass = "mage",
    settleMs = 900,
  } = opts;

  await page.evaluate(({ playerClass, enemyClass }) => {
    const p1Companion = typeof defaultCompanionForClass === "function"
      ? defaultCompanionForClass(playerClass)
      : "s_stranger";
    const p2Companion = typeof defaultCompanionForClass === "function"
      ? defaultCompanionForClass(enemyClass)
      : "s_stranger";
    selectGameMode("lobby2p");
    selectPlayerClass(playerClass);
    selectCompanion(p1Companion);
    selectOpponentClass(enemyClass);
    selectOpponentClass(enemyClass);
    selectCompanion(p2Companion);
    startRunFromOverlay();
  }, { playerClass, enemyClass });

  await page.waitForFunction(
    () => document.body.classList.contains("screen-app-visible")
      && document.getElementById("app")?.dataset.phase === "prep"
      && document.documentElement.hasAttribute("data-lobby2p-hud")
      && document.getElementById("class-overlay")?.classList.contains("hidden"),
    { timeout: 15000 },
  );
  await page.waitForTimeout(settleMs);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
    window.syncLobby2pHudDom?.();
  });
  await page.waitForTimeout(400);
}
