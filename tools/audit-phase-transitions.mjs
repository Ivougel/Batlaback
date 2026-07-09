/**
 * Аудит дрожания при переходах: prep↔battle, battle→result, result→prep.
 * Запуск: node tools/audit-phase-transitions.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import { quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const PROFILES = [
  {
    id: "ipad-landscape-pwa",
    device: { ...devices["iPad Mini"], viewport: { width: 1133, height: 744 } },
  },
  {
    id: "iphone-portrait",
    device: devices["iPhone 14 Pro Max"],
  },
];

function sampleFrame() {
  const app = document.getElementById("app");
  const layout = document.querySelector(".game-layout");
  const resultOverlay = document.getElementById("battle-result-overlay");
  const modal = resultOverlay?.querySelector(".battle-result-modal");
  const appCs = app ? getComputedStyle(app) : null;
  const layoutCs = layout ? getComputedStyle(layout) : null;
  const modalCs = modal ? getComputedStyle(modal) : null;
  const appRect = app?.getBoundingClientRect();
  const modalRect = modal?.getBoundingClientRect();
  const island = document.getElementById("prep-field-island");
  const floor = document.getElementById("battle-thought-arena");
  const islandRect = island?.getBoundingClientRect();
  const floorRect = floor?.getBoundingClientRect();

  return {
    phase: app?.dataset.phase ?? "",
    resultOpen: resultOverlay && !resultOverlay.classList.contains("hidden"),
    resultEntering: resultOverlay?.classList.contains("overlay-entering") ?? false,
    resultExiting: resultOverlay?.classList.contains("overlay-exiting") ?? false,
    resultToPrep: document.body.classList.contains("result-to-prep-transition"),
    screenTransitioning: document.body.classList.contains("screen-transitioning"),
    phaseTransitioning: layout?.classList.contains("phase-transitioning") ?? false,
    appOpacity: parseFloat(appCs?.opacity ?? "1"),
    appTransform: appCs?.transform ?? "none",
    appVisibility: appCs?.visibility ?? "visible",
    layoutOpacity: parseFloat(layoutCs?.opacity ?? "1"),
    layoutTransform: layoutCs?.transform ?? "none",
    modalTransform: modalCs?.transform ?? "none",
    modalOpacity: parseFloat(modalCs?.opacity ?? "1"),
    modalAnimation: modalCs?.animationName ?? "none",
    appTop: Math.round(appRect?.top ?? 0),
    modalTop: Math.round(modalRect?.top ?? 0),
    islandH: Math.round(islandRect?.height ?? 0),
    floorH: Math.round(floorRect?.height ?? 0),
    canvasH: document.getElementById("game-canvas")?.offsetHeight ?? 0,
  };
}

function maxDelta(samples, key) {
  const vals = samples.map((s) => s[key]).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (vals.length < 2) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

function countChanges(samples, key) {
  let changes = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i][key] !== samples[i - 1][key]) changes += 1;
  }
  return changes;
}

async function collectSamples(page, ms, interval = 32) {
  const n = Math.ceil(ms / interval);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(await page.evaluate(sampleFrame));
    await page.waitForTimeout(interval);
  }
  return out;
}

const browser = await chromium.launch();
const report = [];

for (const profile of PROFILES) {
  const context = await browser.newContext({ ...profile.device });
  const page = await context.newPage();
  const entry = { profile: profile.id, issues: [], metrics: {} };

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 10000 });
    await quickStartPrep(page, { settleMs: 800 });

    // prep → battle
    const prepBattlePromise = page.evaluate(async () => {
      if (typeof fastForwardBattle === "function") {
        /* noop — battle starts normally */
      }
      startBattle();
    });
    const prepBattleSamples = await collectSamples(page, 600);
    await prepBattlePromise;
    await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle", { timeout: 8000 });
    await page.waitForTimeout(400);
    const battleSettled = await page.evaluate(sampleFrame);

    entry.metrics.prepToBattle = {
      layoutOpacityDelta: maxDelta(prepBattleSamples, "layoutOpacity"),
      layoutTransformChanges: countChanges(prepBattleSamples, "layoutTransform"),
      appOpacityDelta: maxDelta(prepBattleSamples, "appOpacity"),
      islandHDelta: maxDelta(
        prepBattleSamples.filter((s) => s.phase === "prep"),
        "islandH",
      ),
      floorHAfter: battleSettled.floorH,
    };

    if (entry.metrics.prepToBattle.layoutOpacityDelta > 0.5) {
      entry.issues.push(
        `prep→battle: layout opacity swing ${entry.metrics.prepToBattle.layoutOpacityDelta.toFixed(2)}`,
      );
    }
    if (entry.metrics.prepToBattle.islandHDelta > 8) {
      entry.issues.push(`prep→battle: island height jump ${entry.metrics.prepToBattle.islandHDelta}px`);
    }

    // Fast-forward battle to end
    await page.evaluate(async () => {
      if (!battleState) throw new Error("no battleState");
      fastForwardBattle(battleState);
      if (battleState?.finished && typeof endBattle === "function") endBattle();
    });

    await page.waitForFunction(
      () => {
        const o = document.getElementById("battle-result-overlay");
        return o && !o.classList.contains("hidden");
      },
      { timeout: 8000 },
    );

    const battleResultSamples = await collectSamples(page, 900);
    const resultMid = battleResultSamples[Math.floor(battleResultSamples.length / 2)];

    entry.metrics.battleToResult = {
      phaseDuringResult: resultMid.phase,
      appOpacityDelta: maxDelta(battleResultSamples, "appOpacity"),
      appTransformChanges: countChanges(battleResultSamples, "appTransform"),
      modalTransformChanges: countChanges(battleResultSamples, "modalTransform"),
      modalAnimationChanges: countChanges(battleResultSamples, "modalAnimation"),
      modalTopDelta: maxDelta(battleResultSamples, "modalTop"),
      appVisibility: resultMid.appVisibility,
      layoutOpacityDuringResult: resultMid.layoutOpacity,
    };

    if (resultMid.phase === "battle") {
      entry.issues.push("battle→result: phase остаётся battle при открытом overlay (game loop + layout под капотом)");
    }
    if (entry.metrics.battleToResult.modalTransformChanges > 4) {
      entry.issues.push(
        `battle→result: modal transform скачет (${entry.metrics.battleToResult.modalTransformChanges} смен) — двойная анимация?`,
      );
    }
    if (entry.metrics.battleToResult.modalAnimationChanges > 2) {
      entry.issues.push(
        `battle→result: modal animation сменилась ${entry.metrics.battleToResult.modalAnimationChanges}× (st-result-modal-enter → result-modal-in?)`,
      );
    }
    if (entry.metrics.battleToResult.appOpacityDelta > 0.3 && resultMid.appVisibility === "visible") {
      entry.issues.push(
        `battle→result: #app opacity drift ${entry.metrics.battleToResult.appOpacityDelta.toFixed(2)} while visible`,
      );
    }

    // result → prep (как btn-battle-continue)
    const continuePromise = page.evaluate(async () => {
      const btn = document.getElementById("btn-battle-continue");
      btn?.click();
    });
    const resultPrepSamples = await collectSamples(page, 900);
    await continuePromise;
    await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep", { timeout: 8000 });
    await page.waitForTimeout(400);
    const prepReturned = await page.evaluate(sampleFrame);

    entry.metrics.resultToPrep = {
      appOpacityDelta: maxDelta(resultPrepSamples, "appOpacity"),
      appTransformChanges: countChanges(resultPrepSamples, "appTransform"),
      layoutOpacityDelta: maxDelta(resultPrepSamples, "layoutOpacity"),
      layoutTransformChanges: countChanges(resultPrepSamples, "layoutTransform"),
      islandHDelta: maxDelta(
        resultPrepSamples.filter((s) => s.phase === "prep"),
        "islandH",
      ),
      canvasHAfter: prepReturned.canvasH,
      canvasHBeforeBattle: battleSettled.canvasH,
      overlappingTransitions: resultPrepSamples.filter(
        (s) => s.resultExiting && (s.phaseTransitioning || s.screenTransitioning),
      ).length,
      battleFlashFrames: resultPrepSamples.filter(
        (s) => s.phase === "battle" && !s.resultOpen && !s.resultToPrep && s.appVisibility === "visible",
      ).length,
      resultToPrepFrames: resultPrepSamples.filter((s) => s.resultToPrep).length,
    };

    if (entry.metrics.resultToPrep.battleFlashFrames > 0) {
      entry.issues.push(
        `result→prep: кадр battle без overlay (${entry.metrics.resultToPrep.battleFlashFrames} frames)`,
      );
    }

    if (entry.metrics.resultToPrep.overlappingTransitions > 0) {
      entry.issues.push(
        `result→prep: overlay-exit и phase-transition одновременно (${entry.metrics.resultToPrep.overlappingTransitions} кадров)`,
      );
    }
    if (entry.metrics.resultToPrep.appTransformChanges > 3) {
      entry.issues.push(`result→prep: #app transform скачет ${entry.metrics.resultToPrep.appTransformChanges}×`);
    }
    if (entry.metrics.resultToPrep.islandHDelta > 10) {
      entry.issues.push(`result→prep: prep island height jump ${entry.metrics.resultToPrep.islandHDelta}px`);
    }

    console.log(`\n=== ${profile.id} ===`);
    console.log(JSON.stringify(entry.metrics, null, 2));
    if (entry.issues.length) {
      console.log("ISSUES:");
      entry.issues.forEach((i) => {
        console.log(`  • ${i}`);
      });
    } else {
      console.log("No automated jitter signals detected.");
    }
  } catch (e) {
    entry.issues.push(`ERROR: ${e.message}`);
    console.error(`✗ ${profile.id}: ${e.message}`);
  } finally {
    report.push(entry);
    await context.close();
  }
}

await browser.close();

const totalIssues = report.reduce((n, r) => n + r.issues.length, 0);
console.log(`\n--- Audit complete: ${totalIssues} issue(s) across ${report.length} profiles ---`);
