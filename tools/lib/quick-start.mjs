/**
 * Быстрый старт забега для Playwright-тестов.
 */

function prepHeroForMode(mode) {
  if (mode === "campaign") return "warrior";
  return "warrior";
}

async function runPrepStart(page, mode, playerClass, enemyClass) {
  await page.evaluate(
    async ({ mode, playerClass, enemyClass }) => {
      const hero = playerClass || "warrior";
      const enemy = enemyClass || (mode === "versus" ? "warrior" : "mage");

      selectGameMode(mode);
      if (mode === "campaign" && typeof selectCampaignTrial === "function") {
        selectCampaignTrial("build-trial");
      }
      const skipCompanion = typeof shouldSkipCompanionIntro === "function" && shouldSkipCompanionIntro();
      const useMutations = typeof shouldUseMutationSystem === "function" && shouldUseMutationSystem();
      selectPlayerClass(hero);
      if (useMutations || skipCompanion) {
        selectPlayerClass(hero);
      }
      if (!skipCompanion && typeof selectCompanion === "function") {
        const companion = typeof defaultCompanionForClass === "function"
          ? defaultCompanionForClass(hero)
          : "s_stranger";
        selectCompanion(companion);
        selectCompanion(companion);
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
