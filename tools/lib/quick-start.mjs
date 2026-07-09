/**
 * Быстрый старт забега для Playwright-тестов.
 */

function prepHeroForMode(mode) {
  if (mode === "classic" || mode === "path") return "warrior";
  return "priest";
}

async function runPrepStart(page, mode, playerClass, enemyClass) {
  await page.evaluate(
    async ({ mode, playerClass, enemyClass }) => {
      const hero = playerClass
        || ((mode === "classic" || mode === "path") ? "warrior" : "priest");
      const enemy = enemyClass || (mode === "versus" ? "warrior" : "mage");
      const skipCompanion = typeof shouldSkipCompanionIntro === "function" && shouldSkipCompanionIntro();

      selectGameMode(mode);
      if (mode === "campaign" && typeof selectCampaignTrial === "function") {
        selectCampaignTrial("build-trial");
      }
      selectPlayerClass(hero);
      if (!skipCompanion && typeof selectCompanion === "function") {
        selectCompanion(
          typeof defaultCompanionForClass === "function" ? defaultCompanionForClass(hero) : "s_stranger",
        );
      }
      if (mode === "versus") selectOpponentClass(enemy);
      else if (mode === "lobby2p") {
        selectOpponentClass(enemy);
        selectOpponentClass(enemy);
        selectCompanion(
          typeof defaultCompanionForClass === "function" ? defaultCompanionForClass(enemy) : "s_stranger",
        );
      } else if (mode !== "lobby" && mode !== "campaign") selectOpponentClass(enemy);
      await startRunFromOverlay();
    },
    { mode, playerClass, enemyClass },
  );
}

/**
 * Быстрый старт solo/classic prep.
 */
export async function quickStartPrep(page, opts = {}) {
  const { mode = "solo", playerClass, enemyClass, settleMs = 800 } = opts;

  await runPrepStart(page, mode, playerClass, enemyClass);

  await page.waitForFunction(
    () =>
      document.body.classList.contains("screen-app-visible") &&
      document.getElementById("app")?.dataset.phase === "prep" &&
      document.getElementById("class-overlay")?.classList.contains("hidden") &&
      typeof playerClass !== "undefined" &&
      playerClass !== null,
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
  const { playerClass = "warrior", enemyClass = "mage", settleMs = 900 } = opts;

  await runPrepStart(page, "lobby2p", playerClass, enemyClass);

  await page.waitForFunction(
    () =>
      document.body.classList.contains("screen-app-visible") &&
      document.getElementById("app")?.dataset.phase === "prep" &&
      document.documentElement.hasAttribute("data-lobby2p-hud") &&
      document.getElementById("class-overlay")?.classList.contains("hidden"),
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

export { prepHeroForMode };
