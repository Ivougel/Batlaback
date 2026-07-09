/**
 * Пороги FPS/jank для CI (npm run test:perf).
 * Значения с запасом под headless Playwright.
 */

/** @type {Record<string, { prep?: PhaseBudget, battle?: PhaseBudget }>} */
export const BATTLE_BUDGETS = {
  "iphone-portrait": {
    prep: { minFps: 50, maxJank33Pct: 5, maxP95Ms: 20 },
    battle: { minFps: 50, maxJank33Pct: 5, maxP95Ms: 20 },
  },
  "iphone-landscape": {
    prep: { minFps: 50, maxJank33Pct: 5, maxP95Ms: 20 },
    battle: { minFps: 50, maxJank33Pct: 8, maxP95Ms: 22 },
  },
  "ipad-landscape": {
    prep: { minFps: 45, maxJank33Pct: 8, maxP95Ms: 36 },
    battle: { minFps: 42, maxJank33Pct: 15, maxP95Ms: 40 },
  },
  desktop: {
    prep: { minFps: 30, maxJank33Pct: 35, maxP95Ms: 55 },
    battle: { minFps: 28, maxJank33Pct: 40, maxP95Ms: 55 },
  },
};

/** @type {Record<string, TransitionBudget>} */
export const TRANSITION_BUDGETS = {
  "iphone-portrait": {
    prep: { minFps: 50, maxJank33Pct: 2 },
    battle: { minFps: 50, maxJank33Pct: 2 },
    result: { minFps: 50, maxJank33Pct: 5 },
    prepAfter: { minFps: 50, maxJank33Pct: 2 },
    maxIslandJumpPx: 8,
    maxBattleFlashFrames: 0,
    maxOverlappingFrames: 6,
  },
  "ipad-mini-pwa": {
    prep: { minFps: 48, maxJank33Pct: 10 },
    battle: { minFps: 32, maxJank33Pct: 30 },
    result: { minFps: 30, maxJank33Pct: 32 },
    prepAfter: { minFps: 48, maxJank33Pct: 5 },
    maxIslandJumpPx: 8,
    maxBattleFlashFrames: 0,
    maxOverlappingFrames: 6,
  },
};

/**
 * @param {string} profile
 * @param {string} label prep|battle
 * @param {{ fps: number, jank33Pct: number, p95?: number }} frames
 * @returns {string[]}
 */
export function assertBattleBudget(profile, label, frames) {
  const budget = BATTLE_BUDGETS[profile]?.[label];
  if (!budget) return [];
  const failures = [];
  if (frames.fps < budget.minFps) {
    failures.push(`${profile}/${label}: fps ${frames.fps} < ${budget.minFps}`);
  }
  if (frames.jank33Pct > budget.maxJank33Pct) {
    failures.push(`${profile}/${label}: jank33 ${frames.jank33Pct}% > ${budget.maxJank33Pct}%`);
  }
  if (budget.maxP95Ms != null && frames.p95 > budget.maxP95Ms) {
    failures.push(`${profile}/${label}: p95 ${frames.p95}ms > ${budget.maxP95Ms}ms`);
  }
  return failures;
}

/**
 * @param {object} row
 * @returns {string[]}
 */
export function assertTransitionBudget(row) {
  const budget = TRANSITION_BUDGETS[row.profile];
  if (!budget) return [];
  const failures = [];
  for (const key of ["prep", "battle", "result", "prepAfter"]) {
    const phase = row[key];
    const phaseBudget = budget[key];
    if (!phase?.frames || !phaseBudget) continue;
    const { fps, jank33Pct } = phase.frames;
    if (fps < phaseBudget.minFps) {
      failures.push(`${row.profile}/${key}: fps ${fps} < ${phaseBudget.minFps}`);
    }
    if (jank33Pct > phaseBudget.maxJank33Pct) {
      failures.push(`${row.profile}/${key}: jank33 ${jank33Pct}% > ${phaseBudget.maxJank33Pct}%`);
    }
  }
  const t = row.transition || {};
  if (t.islandJumpPx > budget.maxIslandJumpPx) {
    failures.push(`${row.profile}: islandJump ${t.islandJumpPx}px > ${budget.maxIslandJumpPx}px`);
  }
  if (t.battleFlashFrames > budget.maxBattleFlashFrames) {
    failures.push(`${row.profile}: battleFlash ${t.battleFlashFrames} > ${budget.maxBattleFlashFrames}`);
  }
  if (t.overlappingFrames > budget.maxOverlappingFrames) {
    failures.push(`${row.profile}: overlap ${t.overlappingFrames} > ${budget.maxOverlappingFrames}`);
  }
  return failures;
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>}
 */
export async function assertTierFlags(page) {
  return page.evaluate(() => {
    const failures = [];
    const root = document.documentElement;
    if (!root.dataset.perfTier) failures.push("missing data-perf-tier");
    if (!root.dataset.battleFxLight) failures.push("missing data-battle-fx-light");
    if (typeof PresentationClock === "undefined") failures.push("PresentationClock not loaded");
    if (typeof BattleFxTier === "undefined" || !BattleFxTier.resolvePerfTier) {
      failures.push("BattleFxTier.resolvePerfTier missing");
    }
    const tier = root.dataset.uiTier;
    if ((tier === "phone" || tier === "tablet") && root.dataset.battleFxLight !== "true") {
      failures.push(`touch ${tier} should have battleFxLight=true`);
    }
    return failures;
  });
}
