/**
 * Боевая аура-рамка: сияющая обводка арены, холод → тьма по ходу боя,
 * вспомогательные эмодзи бегут по периметру.
 */

const BATTLE_AURA_RUNNER_POOL = ["✨", "💫", "⚔️", "🩸", "💥", "🔥", "🛡️", "👀", "⭐", "🌟", "💢", "🎯", "🫨"];
const BATTLE_AURA_CLASS_EMOJIS = {
  warrior: ["🍉", "⚔️", "💪"],
  rogue: ["🥷", "💩", "🌾"],
  mage: ["🪄", "✨", "🛁"],
  priest: ["🎤", "🙏", "📰"],
};
const BATTLE_AURA_EDGES = ["top", "right", "bottom", "left"];

let auraIntensity = 0;
let auraLastPlayerHp = null;
let auraLastEnemyHp = null;
let auraLastRunnerAt = 0;
let auraLastPresentAt = 0;
let auraLastCssKey = "";
let auraActive = false;
let auraLayoutKey = "";

function auraPresentGapMs() {
  if (typeof BattleFxTier !== "undefined" && BattleFxTier.auraPresentGapMs) {
    return BattleFxTier.auraPresentGapMs();
  }
  return 50;
}

function auraRunnersEnabled() {
  if (typeof BattleFxTier !== "undefined" && BattleFxTier.auraRunnersEnabled) {
    return BattleFxTier.auraRunnersEnabled();
  }
  return true;
}

function clearBattleAuraFrameLayout() {
  const frame = document.getElementById("battle-aura-frame");
  if (!frame) return;
  frame.style.removeProperty("top");
  frame.style.removeProperty("left");
  frame.style.removeProperty("width");
  frame.style.removeProperty("height");
  frame.style.removeProperty("right");
  frame.style.removeProperty("bottom");
  frame.style.removeProperty("--aura-runner-track-inset");
  auraLayoutKey = "";
}

function measureAuraRunnerTrackInsetPx(frame) {
  if (!frame) return 0;
  const probe = document.createElement("span");
  probe.className = "battle-aura-runner";
  probe.setAttribute("aria-hidden", "true");
  probe.textContent = "✨";
  probe.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;animation:none;";
  frame.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  const half = Math.ceil(Math.max(rect.width, rect.height) * 0.52);
  return Math.max(6, half);
}

/** Поле боя = весь scene viewport (#prep-field-column), не только центральная арена. */
function resolveBattleAuraTrackHost() {
  return document.getElementById("prep-field-column")
    || document.querySelector(".prep-field-column.scene-viewport");
}

/** Совмещает ауру с периметром поля боя и подбирает inset траектории в px. */
function syncBattleAuraFrameLayout() {
  const frame = document.getElementById("battle-aura-frame");
  const host = resolveBattleAuraTrackHost();
  if (!frame || !host) return;

  const app = document.getElementById("app");
  const phase = app?.dataset?.phase;
  if (phase !== "battle" && phase !== "replay") {
    clearBattleAuraFrameLayout();
    return;
  }

  const layoutKey = "battle-field-full";
  if (auraLayoutKey !== layoutKey) {
    auraLayoutKey = layoutKey;
    frame.style.removeProperty("top");
    frame.style.removeProperty("left");
    frame.style.removeProperty("width");
    frame.style.removeProperty("height");
    frame.style.right = "";
    frame.style.bottom = "";
  }

  const insetPx = measureAuraRunnerTrackInsetPx(frame);
  const insetKey = String(insetPx);
  if (frame.dataset.runnerInsetPx !== insetKey) {
    frame.dataset.runnerInsetPx = insetKey;
    frame.style.setProperty("--aura-runner-track-inset", `${insetPx}px`);
  }
}

function resetBattleAuraFrame() {
  auraIntensity = 0;
  auraLastPlayerHp = null;
  auraLastEnemyHp = null;
  auraLastRunnerAt = 0;
  auraLastPresentAt = 0;
  auraLastCssKey = "";
  auraActive = false;
  const frame = document.getElementById("battle-aura-frame");
  const runners = document.getElementById("battle-aura-runners");
  if (frame) {
    frame.classList.add("hidden");
    frame.setAttribute("aria-hidden", "true");
    frame.style.removeProperty("--aura-progress");
    frame.style.removeProperty("--aura-intensity");
    frame.style.removeProperty("--aura-hue");
  }
  if (runners) runners.innerHTML = "";
  clearBattleAuraFrameLayout();
}

function pickAuraRunnerEmoji(state) {
  const roll = Math.random();
  if (roll < 0.35 && typeof playerClass !== "undefined") {
    const pool = BATTLE_AURA_CLASS_EMOJIS[playerClass];
    if (pool?.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  if (roll < 0.55 && typeof enemyClass !== "undefined") {
    const pool = BATTLE_AURA_CLASS_EMOJIS[enemyClass];
    if (pool?.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return BATTLE_AURA_RUNNER_POOL[Math.floor(Math.random() * BATTLE_AURA_RUNNER_POOL.length)];
}

function estimateAuraBattleDuration(state) {
  if (typeof ArenaEquipment !== "undefined" && typeof ArenaEquipment.estimateBattleDuration === "function") {
    return Math.max(12, ArenaEquipment.estimateBattleDuration(state) || 24);
  }
  const pMax = state?.player?.maxHp || 100;
  const eMax = state?.enemy?.maxHp || 100;
  return Math.max(14, (pMax + eMax) / 10);
}

function computeAuraProgress(state, elapsed) {
  const pMax = Math.max(1, state?.player?.maxHp || 1);
  const eMax = Math.max(1, state?.enemy?.maxHp || 1);
  const pHp = Math.max(0, state?.player?.hp ?? 0);
  const eHp = Math.max(0, state?.enemy?.hp ?? 0);
  const hpLost = 1 - (pHp + eHp) / (pMax + eMax);
  const est = estimateAuraBattleDuration(state);
  const timePct = Math.min(1, Math.max(0, elapsed / est));
  if (state?.finished) return 1;
  return Math.min(1, Math.max(hpLost * 0.92, timePct * 0.72));
}

function bumpAuraIntensity(state) {
  const pHp = state?.player?.hp ?? 0;
  const eHp = state?.enemy?.hp ?? 0;
  if (auraLastPlayerHp != null && auraLastEnemyHp != null) {
    const delta = Math.max(0, auraLastPlayerHp - pHp) + Math.max(0, auraLastEnemyHp - eHp);
    if (delta > 0) {
      auraIntensity = Math.min(1, auraIntensity + Math.min(0.55, delta / 28));
    }
  }
  auraLastPlayerHp = pHp;
  auraLastEnemyHp = eHp;
  auraIntensity = Math.max(0, auraIntensity * 0.9 - 0.008);
  if (state?.finished) auraIntensity = Math.min(1, auraIntensity + 0.25);
}

function spawnAuraRunner(state) {
  const host = document.getElementById("battle-aura-runners");
  if (!host || host.children.length >= 10) return;

  const edge = BATTLE_AURA_EDGES[Math.floor(Math.random() * BATTLE_AURA_EDGES.length)];
  const el = document.createElement("span");
  el.className = `battle-aura-runner battle-aura-runner--${edge}`;
  el.textContent = pickAuraRunnerEmoji(state);
  el.setAttribute("aria-hidden", "true");
  const dur = 2.4 + Math.random() * 2.2;
  el.style.animationDuration = `${dur.toFixed(2)}s`;
  el.addEventListener("animationend", () => el.remove(), { once: true });
  host.appendChild(el);
}

function syncBattleAuraFrame(state, elapsed) {
  const frame = document.getElementById("battle-aura-frame");
  if (!frame) return;

  const app = document.getElementById("app");
  const phase = app?.dataset.phase;
  const show = (phase === "battle" || phase === "replay") && state && !document.hidden;
  if (!show) {
    if (auraActive) resetBattleAuraFrame();
    return;
  }

  const now = performance.now();
  const firstPresent = !auraActive;
  auraActive = true;
  if (firstPresent) syncBattleAuraFrameLayout();
  frame.classList.remove("hidden");
  frame.setAttribute("aria-hidden", "false");

  if (!firstPresent && now - auraLastPresentAt < auraPresentGapMs()) return;
  auraLastPresentAt = now;

  bumpAuraIntensity(state);
  const progress = computeAuraProgress(state, elapsed);
  const coldHue = 195;
  const darkHue = 285 + progress * 35;
  const hue = coldHue + (darkHue - coldHue) * progress;
  const finished = state.finished ? "true" : "false";
  const cssKey = `${progress.toFixed(2)}|${auraIntensity.toFixed(2)}|${Math.round(hue)}|${finished}`;

  if (cssKey !== auraLastCssKey) {
    auraLastCssKey = cssKey;
    frame.style.setProperty("--aura-progress", progress.toFixed(3));
    frame.style.setProperty("--aura-intensity", auraIntensity.toFixed(3));
    frame.style.setProperty("--aura-hue", String(Math.round(hue)));
    frame.dataset.finished = finished;
  }

  if (!auraRunnersEnabled()) return;

  const runnerGap = state.finished ? 180 : 520 + Math.random() * 380;
  if (now - auraLastRunnerAt >= runnerGap) {
    auraLastRunnerAt = now;
    const burst = state.finished ? 3 : (auraIntensity > 0.45 ? 2 : 1);
    for (let i = 0; i < burst; i += 1) {
      window.setTimeout(() => spawnAuraRunner(state), i * 120);
    }
  }
}
