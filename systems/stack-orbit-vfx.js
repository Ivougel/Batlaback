/**
 * Орбита стаков вокруг аватар-эмодзи героя + снаряды при трате (fireStack events).
 */

const STACK_ORBIT_BUFF_TYPES = ["spikes", "block", "empower", "regen", "luck", "heat", "mana"];
const stackProjectileTimers = [];
const stackFireThrottleAt = { player: 0, enemy: 0 };
let stackOrbitLastSyncAt = 0;

function isStackOrbitLightProfile() {
  if (typeof BattleFxTier !== "undefined") return BattleFxTier.isLightBattleFx();
  const tier = document.documentElement?.dataset?.uiTier;
  if (tier === "phone" || tier === "tablet") return true;
  if (tier === "desktop") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function stackOrbitSyncGapMs() {
  if (typeof BattleFxTier !== "undefined") return BattleFxTier.stackOrbitGapMs();
  return isStackOrbitLightProfile() ? 170 : 70;
}

function stackOrbitParticleCap() {
  return isStackOrbitLightProfile() ? 8 : 20;
}

function stackOrbitParticleDurationSec(particleIndex) {
  if (typeof getEmojiOrbitParticleDurationSec === "function") {
    return getEmojiOrbitParticleDurationSec(particleIndex);
  }
  return 4.5 + (particleIndex % 3) * 0.18;
}

function stackOrbitEmoji(stackType) {
  if (stackType === "cold") return "❄️";
  if (typeof getStackMeta === "function") return getStackMeta(stackType).icon;
  return "✦";
}

function getThoughtSlotEl(team) {
  return document.getElementById(team === "player" ? "player-thought-slot" : "enemy-thought-slot");
}

function isVisibleMount(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

/** Контейнер аватар-эмодзи: thought-slot → battle-thought-arena → fallback hero-stage */
function getStackOrbitMount(team) {
  const thoughtSlot = getThoughtSlotEl(team);
  if (isVisibleMount(thoughtSlot)) return thoughtSlot;

  const arena = document.getElementById("battle-thought-arena");
  if (isVisibleMount(arena)) return arena;

  const slot = document.getElementById(team === "player" ? "player-avatar-slot" : "enemy-avatar-slot");
  return slot?.querySelector(".avatar-hero-stage") || null;
}

function getMainThoughtBodyEl(team) {
  const mount = getStackOrbitMount(team);
  if (!mount) return null;
  return mount.querySelector(
    `.battle-thought-body--${team}:not([data-glyph-index]), .battle-thought-body--${team}[data-glyph-index="0"]`,
  ) || mount.querySelector(`.battle-thought-body--${team}`);
}

function getThoughtEmojiSizePx(team) {
  const body = getMainThoughtBodyEl(team);
  const bodyRect = body?.getBoundingClientRect();
  if (bodyRect && bodyRect.width > 4) return bodyRect.width;

  if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.getThoughtSlotCenter) {
    const center = BattleHeroAnchor.getThoughtSlotCenter(team);
    if (center?.size > 4) return center.size;
  }

  const slot = getThoughtSlotEl(team);
  const slotRect = slot?.getBoundingClientRect();
  if (slotRect && slotRect.width > 4) return slotRect.width;

  return 72;
}

function positionOrbitRing(ring, team) {
  const mount = ring?.parentElement;
  if (!mount) return;

  const body = getMainThoughtBodyEl(team);
  if (!body) {
    ring.style.left = "50%";
    ring.style.top = "50%";
    ring.style.transform = "translate(-50%, -50%)";
    delete ring.dataset.orbitPosKey;
    return;
  }

  const mountRect = mount.getBoundingClientRect();
  const bodyRect = body.getBoundingClientRect();
  if (mountRect.width <= 0 || bodyRect.width <= 0) return;

  const cx = bodyRect.left + bodyRect.width / 2 - mountRect.left;
  const cy = bodyRect.top + bodyRect.height / 2 - mountRect.top;
  const posKey = `${Math.round(cx)}|${Math.round(cy)}`;
  if (ring.dataset.orbitPosKey === posKey) return;
  ring.dataset.orbitPosKey = posKey;
  delete ring.dataset.orbitSig;
  ring.style.left = `${cx}px`;
  ring.style.top = `${cy}px`;
  ring.style.transform = "translate(-50%, -50%)";
}

function resetStackOrbitVfx() {
  stackOrbitLastSyncAt = 0;
  stackFireThrottleAt.player = 0;
  stackFireThrottleAt.enemy = 0;
  while (stackProjectileTimers.length) {
    clearTimeout(stackProjectileTimers.pop());
  }
  document.querySelectorAll(".avatar-stack-orbit-ring").forEach((el) => {
    el.innerHTML = "";
    el.hidden = true;
    delete el.dataset.orbitSig;
    delete el.dataset.orbitSizeKey;
  });
}

function getAvatarStackOrbitRing(team) {
  const mount = getStackOrbitMount(team);
  if (!mount) return null;

  const legacyStage = document
    .getElementById(team === "player" ? "player-avatar-slot" : "enemy-avatar-slot")
    ?.querySelector(".avatar-hero-stage");
  legacyStage?.querySelector(".avatar-stack-orbit-ring")?.remove();

  let ring = mount.querySelector(":scope > .avatar-stack-orbit-ring");
  if (!ring) {
    ring = document.createElement("div");
    ring.className = "avatar-stack-orbit-ring";
    ring.setAttribute("aria-hidden", "true");
    mount.insertBefore(ring, mount.firstChild);
  }
  return ring;
}

function collectSideOrbitStacks(side) {
  const emojis = [];
  if (!side) return emojis;
  const light = isStackOrbitLightProfile();
  const perTypeCap = light ? 3 : 8;
  STACK_ORBIT_BUFF_TYPES.forEach((type) => {
    const count = typeof getSideStack === "function" ? getSideStack(side, type) : 0;
    if (count <= 0) return;
    const emoji = stackOrbitEmoji(type);
    const n = Math.min(count, perTypeCap);
    for (let i = 0; i < n; i++) emojis.push({ emoji, type });
  });
  const cold = side.coldStacks || 0;
  for (let i = 0; i < Math.min(cold, light ? 2 : 4); i++) {
    emojis.push({ emoji: "❄️", type: "cold" });
  }
  return emojis.slice(0, stackOrbitParticleCap());
}

function sideHasOrbitStacks(side) {
  if (!side) return false;
  if ((side.coldStacks || 0) > 0) return true;
  return STACK_ORBIT_BUFF_TYPES.some((type) => {
    const count = typeof getSideStack === "function" ? getSideStack(side, type) : 0;
    return count > 0;
  });
}

function clearStackOrbitRings() {
  document.querySelectorAll(".avatar-stack-orbit-ring").forEach((ring) => {
    if (ring.hidden && !ring.innerHTML) return;
    ring.innerHTML = "";
    ring.hidden = true;
    delete ring.dataset.orbitSig;
    delete ring.dataset.orbitSizeKey;
  });
}

function isPrepHeroStackOrbitDisabled() {
  return document.documentElement.dataset.battlePrepHeroLayer === "true";
}

function syncStackOrbitFromBattle(battleState, opts = {}) {
  if (!battleState || battleState.finished) return;
  if (isPrepHeroStackOrbitDisabled()) {
    clearStackOrbitRings();
    return;
  }
  const now = performance.now();
  const force = opts.force === true;
  if (!force && now - stackOrbitLastSyncAt < stackOrbitSyncGapMs()) return;
  if (!sideHasOrbitStacks(battleState.player) && !sideHasOrbitStacks(battleState.enemy)) {
    if (stackOrbitLastSyncAt > 0) clearStackOrbitRings();
    stackOrbitLastSyncAt = now;
    return;
  }
  stackOrbitLastSyncAt = now;

  const speedSig = typeof getEmojiOrbitDurationSec === "function"
    ? String(getEmojiOrbitDurationSec())
    : "default";

  ["player", "enemy"].forEach((team) => {
    const ring = getAvatarStackOrbitRing(team);
    if (!ring) return;
    positionOrbitRing(ring, team);

    const side = team === "player" ? battleState.player : battleState.enemy;
    const all = collectSideOrbitStacks(side);
    if (!all.length) {
      ring.innerHTML = "";
      ring.hidden = true;
      delete ring.dataset.orbitSig;
      delete ring.dataset.orbitSizeKey;
      return;
    }

    const sig = `${speedSig}|${all.map((e) => e.type).join(",")}:${all.length}`;
    const emojiPx = getThoughtEmojiSizePx(team);
    const orbitR = emojiPx * 0.54 + Math.min(all.length, 6) * (isStackOrbitLightProfile() ? 1.5 : 2);
    const particlePx = Math.max(11, Math.round(emojiPx * 0.13));
    const sizeKey = `${orbitR}|${particlePx}`;

    if (ring.dataset.orbitSig === sig) {
      if (ring.dataset.orbitSizeKey === sizeKey) return;
      ring.dataset.orbitSizeKey = sizeKey;
      ring.querySelectorAll(".avatar-stack-orbit-particle").forEach((span, i) => {
        span.style.setProperty("--orbit-r", `${orbitR}px`);
        span.style.fontSize = `${particlePx}px`;
        span.style.animationDuration = `${stackOrbitParticleDurationSec(i)}s`;
      });
      return;
    }

    ring.dataset.orbitSig = sig;
    ring.dataset.orbitSizeKey = sizeKey;
    ring.hidden = false;
    ring.innerHTML = "";
    all.forEach((entry, i) => {
      const span = document.createElement("span");
      span.className = "avatar-stack-orbit-particle";
      span.dataset.orbitIndex = String(i);
      span.dataset.orbitCount = String(all.length);
      span.style.animationDuration = `${stackOrbitParticleDurationSec(i)}s`;
      span.style.fontSize = `${particlePx}px`;
      span.style.setProperty("--orbit-r", `${orbitR}px`);
      span.style.setProperty("--orbit-a", `${(360 / all.length) * i}deg`);
      span.textContent = entry.emoji;
      ring.appendChild(span);
    });
  });
}

function getAvatarOrbitAnchor(team) {
  const body = getMainThoughtBodyEl(team);
  if (body) {
    const rect = body.getBoundingClientRect();
    if (rect.width > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }

  if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.getThoughtSlotCenter) {
    const center = BattleHeroAnchor.getThoughtSlotCenter(team);
    if (center?.x != null && center?.y != null) return { x: center.x, y: center.y };
  }

  if (typeof getAvatarHeroStageRect === "function") {
    const rect = getAvatarHeroStageRect(team);
    if (rect?.width > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }

  return null;
}

function launchStackProjectiles(fromTeam, emoji, count) {
  if (typeof floatLayer === "undefined" || !floatLayer.spawn) return;
  const toTeam = fromTeam === "player" ? "enemy" : "player";
  const from = getAvatarOrbitAnchor(fromTeam);
  const to = getAvatarOrbitAnchor(toTeam);
  if (!from || !to) return;
  const maxProj = isStackOrbitLightProfile() ? 2 : 4;
  const n = Math.min(Math.max(1, count || 1), maxProj);
  for (let i = 0; i < n; i++) {
    const delay = i * (isStackOrbitLightProfile() ? 120 : 80);
    const timer = setTimeout(() => {
      floatLayer.spawn(emoji, "emotion", from.x, from.y, { toVx: to.x, toVy: to.y });
    }, delay);
    stackProjectileTimers.push(timer);
  }
}

function handleStackOrbitEvent(ev) {
  if (!ev || ev.type !== "fireStack") return;
  if (ev.stackType === "poison") return;
  const now = performance.now();
  const minGap = isStackOrbitLightProfile() ? 220 : 120;
  if (now - (stackFireThrottleAt[ev.side] || 0) < minGap) {
    const ring = getAvatarStackOrbitRing(ev.side);
    if (ring) delete ring.dataset.orbitSig;
    return;
  }
  stackFireThrottleAt[ev.side] = now;
  const emoji = ev.emoji || stackOrbitEmoji(ev.stackType);
  launchStackProjectiles(ev.side, emoji, ev.count || 1);
  const ring = getAvatarStackOrbitRing(ev.side);
  if (ring) delete ring.dataset.orbitSig;
}

window.resetStackOrbitVfx = resetStackOrbitVfx;
window.syncStackOrbitFromBattle = syncStackOrbitFromBattle;
window.handleStackOrbitEvent = handleStackOrbitEvent;
