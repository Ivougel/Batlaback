/**
 * Профилирование FPS и стоимости кадра в prep / battle.
 * Запуск: npm run profile:battle
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { quickStartPrep } from "./lib/quick-start.mjs";
import { assertBattleBudget, assertTierFlags } from "./lib/perf-budgets.mjs";

const ASSERT_MODE = process.argv.includes("--assert");

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const SAMPLE_MS = 8000;
const WARMUP_MS = 2500;

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
    id: "ipad-landscape",
    device: {
      ...devices["iPad Mini"],
      viewport: { width: 1024, height: 768 },
      isMobile: true,
      hasTouch: true,
    },
  },
  {
    id: "desktop",
    device: {
      viewport: { width: 1440, height: 900 },
      isMobile: false,
      hasTouch: false,
      userAgent: devices["Desktop Chrome"].userAgent,
    },
  },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarizeFrameTimes(frames) {
  if (!frames.length) {
    return { samples: 0, fps: 0, avgMs: 0, p50: 0, p95: 0, p99: 0, jank16: 0, jank33: 0 };
  }
  const sorted = [...frames].sort((a, b) => a - b);
  const sum = frames.reduce((a, b) => a + b, 0);
  const avg = sum / frames.length;
  const jank16 = frames.filter((f) => f > 16.7).length;
  const jank33 = frames.filter((f) => f > 33.3).length;
  return {
    samples: frames.length,
    fps: Math.round(1000 / avg),
    avgMs: +avg.toFixed(2),
    p50: +percentile(sorted, 50).toFixed(2),
    p95: +percentile(sorted, 95).toFixed(2),
    p99: +percentile(sorted, 99).toFixed(2),
    jank16,
    jank33,
    jank16Pct: +((jank16 / frames.length) * 100).toFixed(1),
    jank33Pct: +((jank33 / frames.length) * 100).toFixed(1),
  };
}

function summarizeCallbackTimes(samples) {
  if (!samples.length) {
    return { samples: 0, avgMs: 0, p50: 0, p95: 0, p99: 0, maxMs: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    samples: samples.length,
    avgMs: +(sum / samples.length).toFixed(2),
    p50: +percentile(sorted, 50).toFixed(2),
    p95: +percentile(sorted, 95).toFixed(2),
    p99: +percentile(sorted, 99).toFixed(2),
    maxMs: +sorted[sorted.length - 1].toFixed(2),
  };
}

function deltaMetrics(after, before) {
  const keys = [
    "LayoutCount",
    "RecalcStyleCount",
    "LayoutDuration",
    "RecalcStyleDuration",
    "ScriptDuration",
    "TaskDuration",
    "JSHeapUsedSize",
  ];
  const out = {};
  for (const key of keys) {
    const delta = (after[key] ?? 0) - (before[key] ?? 0);
    if (key.endsWith("Duration")) out[key] = +delta.toFixed(3);
    else if (key === "JSHeapUsedSize") out[key] = Math.round(delta / 1024);
    else out[key] = Math.round(delta);
  }
  return out;
}

async function installProfiler(page) {
  await page.evaluate(() => {
    if (window.__battlePerf) return;
    window.__battlePerf = {
      frameMs: [],
      rafCbMs: [],
      hooks: {
        applyUiLayout: 0,
        scheduleCanvasFit: 0,
        syncBattleHudAnchors: 0,
        syncFxCanvasGeometry: 0,
        syncStackOrbitFromBattle: 0,
        syncHeroEmotionSlotAnchors: 0,
      },
      sampling: false,
    };

    const perf = window.__battlePerf;
    const wrapCount = (name, fn) => {
      if (typeof fn !== "function") return fn;
      return function wrapped(...args) {
        if (perf.sampling) perf.hooks[name] += 1;
        return fn.apply(this, args);
      };
    };

    window.applyUiLayout = wrapCount("applyUiLayout", window.applyUiLayout);
    window.scheduleCanvasFit = wrapCount("scheduleCanvasFit", window.scheduleCanvasFit);
    window.syncBattleHudAnchors = wrapCount("syncBattleHudAnchors", window.syncBattleHudAnchors);
    window.syncFxCanvasGeometry = wrapCount("syncFxCanvasGeometry", window.syncFxCanvasGeometry);
    if (typeof syncStackOrbitFromBattle === "function") {
      window.syncStackOrbitFromBattle = wrapCount(
        "syncStackOrbitFromBattle",
        syncStackOrbitFromBattle,
      );
    }
    if (typeof syncHeroEmotionSlotAnchors === "function") {
      window.syncHeroEmotionSlotAnchors = wrapCount(
        "syncHeroEmotionSlotAnchors",
        syncHeroEmotionSlotAnchors,
      );
    }

    const origRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => origRaf((ts) => {
      const t0 = performance.now();
      cb(ts);
      if (perf.sampling) perf.rafCbMs.push(performance.now() - t0);
    });

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

async function quickStart(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 10000 });
  await installProfiler(page);
  await quickStartPrep(page, { settleMs: 1000 });
}

async function startBattleAndWait(page) {
  await page.evaluate(() => startBattle());
  await page.waitForFunction(
    () => document.getElementById("app")?.dataset.phase === "battle",
    { timeout: 8000 },
  );
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    if (typeof setBattleSpeed === "function") setBattleSpeed(1);
  });
  await page.waitForFunction(() => {
    const overlay = document.getElementById("battle-countdown-overlay");
    if (!overlay) return true;
    return overlay.classList.contains("hidden") || getComputedStyle(overlay).display === "none";
  }, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function readChromeMetrics(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const out = {};
  for (const m of metrics) out[m.name] = m.value;
  return out;
}

async function samplePhase(page, phaseLabel) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");

  await page.evaluate(() => {
    const perf = window.__battlePerf;
    perf.frameMs = [];
    perf.rafCbMs = [];
    for (const key of Object.keys(perf.hooks)) perf.hooks[key] = 0;
    perf.sampling = true;
  });

  const metricsBefore = await readChromeMetrics(cdp);
  await page.waitForTimeout(SAMPLE_MS);
  const metricsAfter = await readChromeMetrics(cdp);

  const snapshot = await page.evaluate(({ sampleMs }) => {
    const perf = window.__battlePerf;
    perf.sampling = false;
    const app = document.getElementById("app");
    return {
      phase: app?.dataset.phase ?? "?",
      battleProfile: document.documentElement.dataset.battleProfile ?? "?",
      uiTier: document.documentElement.dataset.uiTier ?? "?",
      frameMs: perf.frameMs.slice(-Math.ceil((sampleMs / 1000) * 70)),
      rafCbMs: perf.rafCbMs.slice(-Math.ceil((sampleMs / 1000) * 70)),
      hooks: { ...perf.hooks },
    };
  }, { sampleMs: SAMPLE_MS });

  return {
    label: phaseLabel,
    ...snapshot,
    chromeMetrics: deltaMetrics(metricsAfter, metricsBefore),
  };
}

function formatRow(cols, widths) {
  return cols.map((c, i) => String(c).padEnd(widths[i])).join("  ");
}

function printReport(results) {
  const headers = ["profile", "phase", "fps", "p95ms", "jank>16", "raf p95", "layout", "script s"];
  const widths = [18, 8, 5, 7, 9, 8, 7, 9];
  console.log("\n=== Battle perf profile ===\n");
  console.log(formatRow(headers, widths));
  console.log(formatRow(headers.map(() => "—".repeat(6)), widths));

  for (const r of results) {
    const frames = summarizeFrameTimes(r.frameMs);
    const raf = summarizeCallbackTimes(r.rafCbMs);
    console.log(formatRow([
      r.profile,
      r.label,
      frames.fps,
      frames.p95,
      `${frames.jank16Pct}%`,
      raf.p95,
      r.chromeMetrics.LayoutCount,
      r.chromeMetrics.ScriptDuration,
    ], widths));
  }

  console.log("\n--- Hook calls (during sample) ---\n");
  for (const r of results) {
    const h = r.hooks;
    console.log(
      `${r.profile} / ${r.label}: layout=${h.applyUiLayout} canvasFit=${h.scheduleCanvasFit} `
      + `hud=${h.syncBattleHudAnchors} fx=${h.syncFxCanvasGeometry} orbit=${h.syncStackOrbitFromBattle} `
      + `emotionAnchors=${h.syncHeroEmotionSlotAnchors}`,
    );
  }

  console.log("\n--- Detail ---\n");
  for (const r of results) {
    const frames = summarizeFrameTimes(r.frameMs);
    const raf = summarizeCallbackTimes(r.rafCbMs);
    console.log(`${r.profile} / ${r.label} [${r.battleProfile}, tier=${r.uiTier}]`);
    console.log(`  frames: avg=${frames.avgMs}ms p50=${frames.p50} p95=${frames.p95} p99=${frames.p99} jank33=${frames.jank33Pct}%`);
    console.log(`  raf cb: avg=${raf.avgMs}ms p95=${raf.p95} max=${raf.maxMs}`);
    console.log(`  chrome: layout=${r.chromeMetrics.LayoutCount} recalc=${r.chromeMetrics.RecalcStyleCount} heap+${r.chromeMetrics.JSHeapUsedSize}KB`);
    console.log("");
  }
}

async function profileOne(browser, profile) {
  const context = await browser.newContext({ ...profile.device });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await quickStart(page);
  await page.waitForTimeout(WARMUP_MS);

  if (ASSERT_MODE) {
    const tierFailures = await assertTierFlags(page);
    if (tierFailures.length) {
      await context.close();
      throw new Error(`Tier flags: ${tierFailures.join("; ")}`);
    }
  }

  const prep = await samplePhase(page, "prep");
  prep.profile = profile.id;

  await startBattleAndWait(page);
  await page.waitForTimeout(WARMUP_MS);
  const battle = await samplePhase(page, "battle");
  battle.profile = profile.id;

  if (errors.length) {
    prep.jsErrors = errors;
    battle.jsErrors = errors;
  }

  await context.close();
  return [prep, battle];
}

const browser = await chromium.launch();
const all = [];
for (const profile of PROFILES) {
  process.stdout.write(`Profiling ${profile.id}...`);
  const rows = await profileOne(browser, profile);
  all.push(...rows);
  console.log(" done");
}
await browser.close();

printReport(all);

const outPath = path.join(root, "tools", "battle-perf-report.json");
fs.writeFileSync(outPath, JSON.stringify(all.map((r) => ({
  profile: r.profile,
  label: r.label,
  battleProfile: r.battleProfile,
  uiTier: r.uiTier,
  frames: summarizeFrameTimes(r.frameMs),
  rafCallback: summarizeCallbackTimes(r.rafCbMs),
  hooks: r.hooks,
  chromeMetrics: r.chromeMetrics,
})), null, 2));
console.log(`\nJSON: ${outPath}`);

if (ASSERT_MODE) {
  const failures = [];
  for (const r of all) {
    failures.push(...assertBattleBudget(r.profile, r.label, summarizeFrameTimes(r.frameMs)));
  }
  if (failures.length) {
    console.error("\n✗ Perf budget failures:\n");
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log("\n✓ All battle perf budgets passed.");
}
