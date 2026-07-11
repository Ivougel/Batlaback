/**
 * Плавность prep ↔ battle: layout не должен прыгать во время phase-transition.
 * Запуск: npm run test:phase-smoothness
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import { quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const PROFILES = [
  { id: "iphone-portrait", device: devices["iPhone 14 Pro Max"] },
  {
    id: "iphone-landscape",
    device: {
      ...devices["iPhone 14 Pro Max"],
      viewport: { width: 932, height: 430 },
      isMobile: true,
      hasTouch: true,
    },
  },
  {
    id: "ipad-portrait",
    device: { ...devices["iPad Mini"], viewport: { width: 768, height: 1024 } },
  },
  {
    id: "ipad-mini-pwa",
    device: { ...devices["iPad Mini"], viewport: { width: 1133, height: 744 } },
  },
  {
    id: "ipad-landscape",
    device: { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } },
  },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function sampleLayout(page) {
  return page.evaluate(() => {
    const island = document.getElementById("prep-field-island");
    const floor = document.getElementById("battle-thought-arena");
    const canvas = document.getElementById("game-canvas");
    const app = document.getElementById("app");
    const html = document.documentElement;
    const bbStackBattle = html.dataset.battleLayout === "bb-stack";
    const islandRect = island?.getBoundingClientRect();
    const floorRect = floor?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const floorH = bbStackBattle
      ? Math.round(canvasRect?.height ?? 0)
      : Math.round(floorRect?.height ?? 0);
    return {
      phase: app?.dataset.phase ?? "",
      islandW: Math.round(islandRect?.width ?? 0),
      islandH: Math.round(islandRect?.height ?? 0),
      floorH,
      appH: Math.round(parseFloat(getComputedStyle(html).getPropertyValue("--app-h")) || app?.offsetHeight || 0),
      screenTransitioning: document.body.classList.contains("screen-transitioning"),
      phaseTransitioning: document.querySelector(".game-layout")?.classList.contains("phase-transitioning"),
      deferredLocked:
        document.body.classList.contains("is-ui-dragging") ||
        document.body.classList.contains("screen-transitioning") ||
        document.querySelector(".game-layout")?.classList.contains("phase-transitioning"),
    };
  });
}

async function waitForPhase(page, phase, timeout = 10000) {
  await page.waitForFunction((expected) => document.getElementById("app")?.dataset.phase === expected, phase, {
    timeout,
  });
}

async function waitForTransitionIdle(page, timeout = 4000) {
  await page.waitForFunction(
    () => {
      const body = document.body;
      const layout = document.querySelector(".game-layout");
      return !body.classList.contains("screen-transitioning") && !layout?.classList.contains("phase-transitioning");
    },
    { timeout },
  );
}

const browser = await chromium.launch();
const failures = [];

for (const profile of PROFILES) {
  const context = await browser.newContext({ ...profile.device });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 10000 });
    await quickStartPrep(page, { settleMs: 1000 });

    const prepBaseline = await sampleLayout(page);
    assert(prepBaseline.phase === "prep", `expected prep, got ${prepBaseline.phase}`);
    assert(prepBaseline.islandH > 48, `prep island too small: ${prepBaseline.islandH}px`);

    const prepToBattle = [];
    const prepBattlePromise = page.evaluate(async () => {
      if (typeof transitionToPhase === "function") {
        await transitionToPhase("battle");
        return "transitionToPhase";
      }
      startBattle();
      return "startBattle";
    });

    for (let i = 0; i < 12; i += 1) {
      prepToBattle.push(await sampleLayout(page));
      await page.waitForTimeout(40);
    }
    await prepBattlePromise;
    await waitForPhase(page, "battle");
    for (let i = 0; i < 8; i += 1) {
      prepToBattle.push(await sampleLayout(page));
      await page.waitForTimeout(40);
    }
    await waitForTransitionIdle(page);
    const battleSettled = await sampleLayout(page);

    assert(battleSettled.phase === "battle", `expected battle, got ${battleSettled.phase}`);
    assert(battleSettled.floorH > 36, `battle floor too small: ${battleSettled.floorH}px`);

    const prepIslandSamples = prepToBattle.filter((s) => s.phase === "prep" && s.islandH > 0 && !s.phaseTransitioning);
    if (prepIslandSamples.length >= 2) {
      const baseW = prepBaseline.islandW;
      const baseH = prepBaseline.islandH;
      const maxWDelta = Math.max(...prepIslandSamples.map((s) => Math.abs(s.islandW - baseW)));
      const maxHDelta = Math.max(...prepIslandSamples.map((s) => Math.abs(s.islandH - baseH)));
      assert(maxWDelta <= 6, `prep island width jumped during prep→battle: ${maxWDelta}px`);
      assert(maxHDelta <= 6, `prep island height jumped during prep→battle: ${maxHDelta}px`);
    }

    const battleToPrep = [];
    const battlePrepPromise = page.evaluate(async () => {
      await transitionToPhase("prep");
    });

    for (let i = 0; i < 12; i += 1) {
      battleToPrep.push(await sampleLayout(page));
      await page.waitForTimeout(40);
    }
    await battlePrepPromise;
    await waitForPhase(page, "prep");
    for (let i = 0; i < 8; i += 1) {
      battleToPrep.push(await sampleLayout(page));
      await page.waitForTimeout(40);
    }
    await waitForTransitionIdle(page);
    const prepReturned = await sampleLayout(page);

    assert(prepReturned.phase === "prep", `expected prep after return, got ${prepReturned.phase}`);
    assert(prepReturned.islandH > 48, `returned prep island too small: ${prepReturned.islandH}px`);

    const battleFloorSamples = battleToPrep.filter(
      (s) => s.phase === "battle" && s.floorH > 0 && !s.phaseTransitioning,
    );
    if (battleFloorSamples.length >= 2) {
      const baseFloor = battleSettled.floorH;
      const maxFloorDelta = Math.max(...battleFloorSamples.map((s) => Math.abs(s.floorH - baseFloor)));
      assert(maxFloorDelta <= 8, `battle floor jumped during battle→prep: ${maxFloorDelta}px`);
    }

    await page.evaluate(() => startBattle());
    await waitForPhase(page, "battle");
    await page
      .waitForFunction(
        () => {
          const overlay = document.getElementById("battle-countdown-overlay");
          if (!overlay) return true;
          return overlay.classList.contains("hidden") || getComputedStyle(overlay).display === "none";
        },
        { timeout: 12000 },
      )
      .catch(() => {});
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      if (!battleState) throw new Error("no battleState for result transition");
      fastForwardBattle(battleState);
      if (battleState?.finished && typeof endBattle === "function") endBattle();
    });
    await page.waitForFunction(() => !document.getElementById("battle-result-overlay")?.classList.contains("hidden"), {
      timeout: 10000,
    });
    await page.waitForTimeout(400);

    const resultToPrepSamples = [];
    const continuePromise = page.evaluate(() => {
      document.getElementById("btn-battle-continue")?.click();
    });
    for (let i = 0; i < 20; i += 1) {
      resultToPrepSamples.push(await sampleLayout(page));
      await page.waitForTimeout(40);
    }
    await continuePromise;
    await waitForPhase(page, "prep");
    await waitForTransitionIdle(page);
    await page.waitForTimeout(400);
    const prepAfterResult = await sampleLayout(page);

    const islandHeights = resultToPrepSamples
      .filter((s) => s.phase === "prep" && s.islandH > 48 && !s.screenTransitioning)
      .map((s) => s.islandH);
    if (islandHeights.length >= 2) {
      const islandJump = Math.max(...islandHeights) - Math.min(...islandHeights);
      assert(islandJump <= 8, `result→prep island jumped: ${islandJump}px`);
    }
    assert(
      Math.abs(prepAfterResult.islandH - prepReturned.islandH) <= 8,
      `prep island after result differs from prep returned: ${prepAfterResult.islandH} vs ${prepReturned.islandH}`,
    );

    if (errors.length) throw new Error(errors.join("; "));

    console.log(
      `✓ ${profile.id}`,
      JSON.stringify({
        prepIsland: `${prepBaseline.islandW}x${prepBaseline.islandH}`,
        battleFloor: battleSettled.floorH,
        prepReturnedIsland: `${prepReturned.islandW}x${prepReturned.islandH}`,
        prepTransitionSamples: prepToBattle.length,
        battleTransitionSamples: battleToPrep.length,
      }),
    );
  } catch (e) {
    failures.push({ id: profile.id, error: e.message });
    console.error(`✗ ${profile.id}: ${e.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} phase smoothness test(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${PROFILES.length} phase smoothness profiles passed.`);
