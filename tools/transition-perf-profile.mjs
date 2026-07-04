/**
 * FPS и jank по фазам: prep idle, battle, result overlay, result→prep.
 * Запуск: npm run profile:transitions
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;
const SAMPLE_MS = 5000;

const PROFILES = [
  {
    id: "ipad-mini-pwa",
    device: { ...devices["iPad Mini"], viewport: { width: 1133, height: 744 } },
  },
  {
    id: "iphone-portrait",
    device: devices["iPhone 14 Pro Max"],
  },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarizeFrameTimes(frames) {
  if (!frames.length) {
    return { samples: 0, fps: 0, p95: 0, jank16Pct: 0, jank33Pct: 0 };
  }
  const sorted = [...frames].sort((a, b) => a - b);
  const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
  const jank16 = frames.filter((f) => f > 16.7).length;
  const jank33 = frames.filter((f) => f > 33.3).length;
  return {
    samples: frames.length,
    fps: Math.round(1000 / avg),
    p95: +percentile(sorted, 95).toFixed(2),
    jank16Pct: +((jank16 / frames.length) * 100).toFixed(1),
    jank33Pct: +((jank33 / frames.length) * 100).toFixed(1),
  };
}

async function installSampler(page) {
  await page.evaluate(() => {
    if (window.__transitionPerf) return;
    window.__transitionPerf = { frameMs: [], sampling: false };
    const perf = window.__transitionPerf;
    const origRaf = window.requestAnimationFrame.bind(window);
    let last = performance.now();
    function sampleFrame(ts) {
      const dt = ts - last;
      last = ts;
      if (perf.sampling) perf.frameMs.push(dt);
      origRaf(sampleFrame);
    }
    origRaf(sampleFrame);
  });
}

async function samplePhase(page, label) {
  await page.evaluate(() => {
    const perf = window.__transitionPerf;
    perf.frameMs = [];
    perf.sampling = true;
  });
  await page.waitForTimeout(SAMPLE_MS);
  return page.evaluate(({ label, sampleMs }) => {
    const perf = window.__transitionPerf;
    perf.sampling = false;
    const app = document.getElementById("app");
    const island = document.getElementById("prep-field-island");
    const islandRect = island?.getBoundingClientRect();
    return {
      label,
      phase: app?.dataset.phase ?? "?",
      uiTier: document.documentElement.dataset.uiTier ?? "?",
      battleFxLight: document.documentElement.dataset.battleFxLight ?? "?",
      resultOpen: !document.getElementById("battle-result-overlay")?.classList.contains("hidden"),
      screenTransitioning: document.body.classList.contains("screen-transitioning"),
      islandH: Math.round(islandRect?.height ?? 0),
      frameMs: perf.frameMs.slice(-Math.ceil((sampleMs / 1000) * 70)),
    };
  }, { label, sampleMs: SAMPLE_MS });
}

async function profileOne(browser, profile) {
  const context = await browser.newContext({ ...profile.device });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 10000 });
  await installSampler(page);
  await quickStartPrep(page, { settleMs: 900 });

  const prep = await samplePhase(page, "prep-idle");

  await page.evaluate(() => startBattle());
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle", { timeout: 12000 });
  await page.waitForFunction(() => {
    const overlay = document.getElementById("battle-countdown-overlay");
    if (!overlay) return true;
    return overlay.classList.contains("hidden") || getComputedStyle(overlay).display === "none";
  }, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  const battle = await samplePhase(page, "battle-idle");

  await page.evaluate(() => {
    if (!battleState) throw new Error("no battleState");
    fastForwardBattle(battleState);
    if (battleState?.finished && typeof endBattle === "function") endBattle();
  });
  await page.waitForFunction(
    () => !document.getElementById("battle-result-overlay")?.classList.contains("hidden"),
    { timeout: 10000 },
  );
  await page.waitForTimeout(600);
  const result = await samplePhase(page, "result-idle");

  const transitionSamples = [];
  const continuePromise = page.evaluate(() => {
    document.getElementById("btn-battle-continue")?.click();
  });
  for (let i = 0; i < 20; i += 1) {
    transitionSamples.push(await page.evaluate(() => ({
      phase: document.getElementById("app")?.dataset.phase ?? "",
      resultOpen: !document.getElementById("battle-result-overlay")?.classList.contains("hidden"),
      resultToPrep: document.body.classList.contains("result-to-prep-transition"),
      screenTransitioning: document.body.classList.contains("screen-transitioning"),
      islandH: Math.round(document.getElementById("prep-field-island")?.getBoundingClientRect()?.height ?? 0),
    })));
    await page.waitForTimeout(40);
  }
  await continuePromise;
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep", { timeout: 10000 });
  await page.waitForTimeout(800);
  const prepAfter = await samplePhase(page, "prep-after-result");

  const islandHeights = transitionSamples.map((s) => s.islandH).filter((h) => h > 0);
  const islandJump = islandHeights.length >= 2
    ? Math.max(...islandHeights) - Math.min(...islandHeights)
    : 0;

  await context.close();

  return {
    profile: profile.id,
    prep: { ...prep, frames: summarizeFrameTimes(prep.frameMs) },
    battle: { ...battle, frames: summarizeFrameTimes(battle.frameMs) },
    result: { ...result, frames: summarizeFrameTimes(result.frameMs) },
    prepAfter: { ...prepAfter, frames: summarizeFrameTimes(prepAfter.frameMs) },
    transition: {
      islandJumpPx: islandJump,
      battleFlashFrames: transitionSamples.filter(
        (s) => s.phase === "battle" && !s.resultOpen && !s.resultToPrep,
      ).length,
      overlappingFrames: transitionSamples.filter(
        (s) => s.resultToPrep && s.screenTransitioning,
      ).length,
    },
  };
}

function printReport(rows) {
  console.log("\n=== Transition perf profile ===\n");
  for (const r of rows) {
    console.log(`--- ${r.profile} ---`);
    for (const key of ["prep", "battle", "result", "prepAfter"]) {
      const s = r[key];
      console.log(
        `  ${s.label}: fps=${s.frames.fps} p95=${s.frames.p95}ms `
        + `jank16=${s.frames.jank16Pct}% jank33=${s.frames.jank33Pct}% `
        + `(tier=${s.uiTier}, lightFx=${s.battleFxLight})`,
      );
    }
    console.log(
      `  result→prep: islandJump=${r.transition.islandJumpPx}px `
      + `battleFlash=${r.transition.battleFlashFrames} overlap=${r.transition.overlappingFrames}`,
    );
    console.log("");
  }
}

const browser = await chromium.launch();
const rows = [];
for (const profile of PROFILES) {
  process.stdout.write(`Profiling ${profile.id}...`);
  rows.push(await profileOne(browser, profile));
  console.log(" done");
}
await browser.close();

printReport(rows);

const outPath = path.join(root, "tools", "transition-perf-report.json");
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
console.log(`JSON: ${outPath}`);
