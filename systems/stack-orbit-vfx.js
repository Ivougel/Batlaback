/**
 * Орбита стаков вокруг аватара + снаряды при трате (gainStack / fireStack events).
 */

const STACK_ORBIT_BUFF_TYPES = ["spikes", "block", "empower", "regen", "luck", "heat", "mana"];
let stackOrbitFrame = 0;
const stackProjectileTimers = [];

function stackOrbitEmoji(stackType) {
  if (stackType === "poison") return "☠️";
  if (stackType === "cold") return "❄️";
  if (typeof getStackMeta === "function") return getStackMeta(stackType).icon;
  return "✦";
}

function resetStackOrbitVfx() {
  stackOrbitFrame = 0;
  while (stackProjectileTimers.length) {
    clearTimeout(stackProjectileTimers.pop());
  }
  document.querySelectorAll(".avatar-stack-orbit-ring").forEach((el) => {
    el.innerHTML = "";
    el.hidden = true;
    delete el.dataset.orbitSig;
  });
}

function getAvatarStackOrbitRing(team) {
  const slot = document.getElementById(team === "player" ? "player-avatar-slot" : "enemy-avatar-slot");
  const stage = slot?.querySelector(".avatar-hero-stage");
  if (!stage) return null;
  let ring = stage.querySelector(".avatar-stack-orbit-ring");
  if (!ring) {
    ring = document.createElement("div");
    ring.className = "avatar-stack-orbit-ring";
    ring.setAttribute("aria-hidden", "true");
    stage.appendChild(ring);
  }
  return ring;
}

function collectSideOrbitStacks(side) {
  const emojis = [];
  if (!side) return emojis;
  STACK_ORBIT_BUFF_TYPES.forEach((type) => {
    const count = typeof getSideStack === "function" ? getSideStack(side, type) : 0;
    if (count <= 0) return;
    const emoji = stackOrbitEmoji(type);
    const n = Math.min(count, 10);
    for (let i = 0; i < n; i++) emojis.push({ emoji, type });
  });
  const poison = side.poisonStacks || 0;
  for (let i = 0; i < Math.min(poison, 8); i++) {
    emojis.push({ emoji: "☠️", type: "poison" });
  }
  const cold = side.coldStacks || 0;
  for (let i = 0; i < Math.min(cold, 6); i++) {
    emojis.push({ emoji: "❄️", type: "cold" });
  }
  return emojis;
}

function syncStackOrbitFromBattle(battleState) {
  if (!battleState) return;
  stackOrbitFrame += 1;
  if (stackOrbitFrame % 4 !== 0) return;

  ["player", "enemy"].forEach((team) => {
    const ring = getAvatarStackOrbitRing(team);
    if (!ring) return;
    const side = team === "player" ? battleState.player : battleState.enemy;
    const all = collectSideOrbitStacks(side);
    if (!all.length) {
      ring.innerHTML = "";
      ring.hidden = true;
      delete ring.dataset.orbitSig;
      return;
    }
    const sig = all.map((e) => e.type).join(",") + ":" + all.length;
    if (ring.dataset.orbitSig === sig) return;
    ring.dataset.orbitSig = sig;
    ring.hidden = false;
    ring.innerHTML = "";
    const r = 38 + Math.min(all.length, 8) * 2;
    all.forEach((entry, i) => {
      const span = document.createElement("span");
      span.className = "avatar-stack-orbit-particle";
      const duration = 1.8 + (i % 3) * 0.17;
      span.style.animationDuration = `${duration}s`;
      span.style.setProperty("--orbit-r", `${r}px`);
      span.style.setProperty("--orbit-a", `${(360 / all.length) * i}deg`);
      span.textContent = entry.emoji;
      ring.appendChild(span);
    });
  });
}

function getAvatarOrbitAnchor(team) {
  if (typeof getAvatarHeroStageRect === "function") {
    const rect = getAvatarHeroStageRect(team);
    if (rect?.width > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }
  if (typeof getProfileAvatarFloatAnchor === "function") {
    const pt = getProfileAvatarFloatAnchor(team, 0);
    if (pt?.x != null && pt?.y != null) return { x: pt.x, y: pt.y };
  }
  const slot = document.getElementById(team === "player" ? "player-avatar-slot" : "enemy-avatar-slot");
  const stage = slot?.querySelector(".avatar-hero-stage");
  if (stage) {
    const rect = stage.getBoundingClientRect();
    if (rect.width > 0) {
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
  const n = Math.min(Math.max(1, count || 1), 8);
  for (let i = 0; i < n; i++) {
    const timer = setTimeout(() => {
      floatLayer.spawn(emoji, "emotion", from.x, from.y, { toVx: to.x, toVy: to.y });
    }, i * 80);
    stackProjectileTimers.push(timer);
  }
}

function handleStackOrbitEvent(ev) {
  if (!ev) return;
  if (ev.type === "fireStack") {
    const emoji = ev.emoji || stackOrbitEmoji(ev.stackType);
    launchStackProjectiles(ev.side, emoji, ev.count || 1);
    const ring = getAvatarStackOrbitRing(ev.side);
    if (ring) delete ring.dataset.orbitSig;
  } else if (ev.type === "gainStack") {
    const ring = getAvatarStackOrbitRing(ev.side);
    if (ring) delete ring.dataset.orbitSig;
  }
}

window.resetStackOrbitVfx = resetStackOrbitVfx;
window.syncStackOrbitFromBattle = syncStackOrbitFromBattle;
window.handleStackOrbitEvent = handleStackOrbitEvent;
