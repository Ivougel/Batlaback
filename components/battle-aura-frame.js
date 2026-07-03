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
let auraActive = false;
let auraLayoutKey = "";

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

/** Совмещает ауру с #battle-thought-arena и подбирает inset траектории в px. */
function syncBattleAuraFrameLayout() {
  const frame = document.getElementById("battle-aura-frame");
  const arena = document.getElementById("battle-thought-arena");
  const host = document.querySelector(".prep-field-column.scene-viewport")
    || document.getElementById("prep-field-column");
  if (!frame || !host) return;

  const app = document.getElementById("app");
  const phase = app?.dataset?.phase;
  if (phase !== "battle" && phase !== "replay") {
    clearBattleAuraFrameLayout();
    return;
  }

  const arenaRect = arena?.getBoundingClientRect();
  const useArena = arena
    && arenaRect
    && arenaRect.width > 24
    && arenaRect.height > 24
    && getComputedStyle(arena).display !== "none";

  let layoutKey;
  if (useArena) {
    const hostRect = host.getBoundingClientRect();
    const top = Math.round(arenaRect.top - hostRect.top);
    const left = Math.round(arenaRect.left - hostRect.left);
    const width = Math.round(arenaRect.width);
    const height = Math.round(arenaRect.height);
    layoutKey = `${left}|${top}|${width}|${height}`;
    if (auraLayoutKey !== layoutKey) {
      auraLayoutKey = layoutKey;
      frame.style.top = `${top}px`;
      frame.style.left = `${left}px`;
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      frame.style.right = "auto";
      frame.style.bottom = "auto";
    }
  } else {
    layoutKey = "full";
    if (auraLayoutKey !== layoutKey) {
      auraLayoutKey = layoutKey;
      frame.style.removeProperty("top");
      frame.style.removeProperty("left");
      frame.style.removeProperty("width");
      frame.style.removeProperty("height");
      frame.style.right = "";
      frame.style.bottom = "";
    }
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

  auraActive = true;
  syncBattleAuraFrameLayout();
  frame.classList.remove("hidden");
  frame.setAttribute("aria-hidden", "false");

  bumpAuraIntensity(state);
  const progress = computeAuraProgress(state, elapsed);
  const coldHue = 195;
  const darkHue = 285 + progress * 35;
  const hue = coldHue + (darkHue - coldHue) * progress;

  frame.style.setProperty("--aura-progress", progress.toFixed(3));
  frame.style.setProperty("--aura-intensity", auraIntensity.toFixed(3));
  frame.style.setProperty("--aura-hue", String(Math.round(hue)));
  frame.dataset.finished = state.finished ? "true" : "false";

  const now = performance.now();
  const runnerGap = state.finished ? 180 : 520 + Math.random() * 380;
  if (now - auraLastRunnerAt >= runnerGap) {
    auraLastRunnerAt = now;
    const burst = state.finished ? 3 : (auraIntensity > 0.45 ? 2 : 1);
    for (let i = 0; i < burst; i += 1) {
      window.setTimeout(() => spawnAuraRunner(state), i * 120);
    }
  }
}
