/**
 * Визуальный слой урона: отсчёт 3-2-1, полёт эмодзи из инвентаря, стеки над HP.
 */

const BATTLE_COUNTDOWN_SEC = 3;
const DAMAGE_FLIGHT_MIN = 0.42;
const DAMAGE_FLIGHT_MAX = 0.72;
const DAMAGE_FLIGHT_MAX_ACTIVE = 64;
const DAMAGE_STACK_BOUNCE_SEC = 0.38;

const damageFlightPool = [];
const damageFlightActive = new Map();
const stackBounceTimers = new Map();

function initBattleCountdown(state) {
  state.countdown = {
    active: true,
    remaining: BATTLE_COUNTDOWN_SEC,
    label: "3",
  };
}

function tickBattleCountdown(state, dt) {
  if (!state?.countdown?.active) return;
  state.countdown.remaining -= dt;
  const left = Math.ceil(Math.max(0, state.countdown.remaining));
  state.countdown.label = left > 0 ? String(left) : null;
  if (state.countdown.remaining <= 0) {
    state.countdown.active = false;
    state.countdown.label = null;
  }
}

function isBattleCountdownActive(state) {
  return !!state?.countdown?.active;
}

function initBattleDamageTracker(state) {
  if (state.damageStacks) return;
  state.damageStacks = {
    player: { byUid: {}, order: [] },
    enemy: { byUid: {}, order: [] },
  };
  state.damageFlights = [];
  state._damageFlightUid = 0;
}

function createDamageStackStore() {
  return { byUid: {}, order: [] };
}

function firstItemIconGrapheme(icon) {
  const raw = String(icon || "⚔");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(raw)];
    if (seg[0]?.segment) return seg[0].segment;
  }
  return raw.charAt(0) || "⚔";
}

function damageFlightScale(damage) {
  const d = Math.max(1, Number(damage) || 1);
  return Math.min(2.35, 0.72 + Math.log2(d + 1) * 0.34);
}

function flightSeed(team, uid, n) {
  let h = team === "enemy" ? 9029 : 6151;
  const s = String(uid || team);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i) + n * 97) % 999983;
  return h;
}

function flightRand(team, uid, n) {
  const x = Math.sin(flightSeed(team, uid, n) * 0.0017) * 10000;
  return x - Math.floor(x);
}

function ensureStackEntry(store, uid, item) {
  if (store.byUid[uid]) return store.byUid[uid];
  const def = item?.itemId ? ITEM_CATALOG[item.itemId] : null;
  const entry = {
    uid,
    itemId: item?.itemId || null,
    icon: firstItemIconGrapheme(def?.icon),
    damage: 0,
    bounceUntil: 0,
  };
  store.byUid[uid] = entry;
  store.order.push(uid);
  return entry;
}

function recordIncomingDamage(state, targetTeam, sourceTeam, item, damage) {
  const amount = Math.max(0, Number(damage) || 0);
  if (!state || !targetTeam || !item?.uid || amount <= 0) return;
  if (isBattleCountdownActive(state)) return;

  initBattleDamageTracker(state);
  const store = state.damageStacks[targetTeam];
  const entry = ensureStackEntry(store, item.uid, item);
  entry.damage += amount;
  entry.bounceUntil = (state.elapsed || 0) + DAMAGE_STACK_BOUNCE_SEC;
  stackBounceTimers.set(`${targetTeam}:${item.uid}`, entry.bounceUntil);

  const slotIndex = store.order.indexOf(item.uid);
  const from = typeof getItemViewportCenter === "function"
    ? getItemViewportCenter(item, sourceTeam)
    : { x: 0, y: 0 };
  const to = getDamageStackSlotViewport(targetTeam, slotIndex, store.order.length);

  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const duration = DAMAGE_FLIGHT_MIN
    + Math.min(1, dist / 900) * (DAMAGE_FLIGHT_MAX - DAMAGE_FLIGHT_MIN);

  state._damageFlightUid += 1;
  const cpLift = 40 + flightRand(sourceTeam, item.uid, 1) * 120;
  const cpSide = (flightRand(sourceTeam, item.uid, 2) - 0.5) * dist * 0.35;

  if (state.damageFlights.length >= DAMAGE_FLIGHT_MAX_ACTIVE) state.damageFlights.shift();
  state.damageFlights.push({
    id: `dmgfx-${state._damageFlightUid}`,
    itemUid: item.uid,
    targetTeam,
    icon: entry.icon,
    damage: amount,
    age: 0,
    duration,
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    cpX: (from.x + to.x) / 2 + cpSide,
    cpY: Math.min(from.y, to.y) - cpLift,
    spin: (flightRand(sourceTeam, item.uid, 3) - 0.5) * 720,
    scale: damageFlightScale(amount),
    landed: false,
  });
  syncDamageStackDisplay(targetTeam, state);
}

function getDamageStackSlotViewport(team, slotIndex, total) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const footer = slot?.querySelector(".avatar-hero-footer");
  const stacksEl = footer?.querySelector(".avatar-damage-stacks");
  if (stacksEl) {
    const existing = stacksEl.querySelector(`[data-stack-uid][data-slot="${slotIndex}"]`);
    if (existing) {
      const r = existing.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.35 };
    }
    const rect = stacksEl.getBoundingClientRect();
    const n = Math.max(1, total);
    const spread = Math.min(rect.width * 0.85, n * 52);
    const x = rect.left + rect.width / 2 + (slotIndex - (n - 1) / 2) * (spread / n);
    return { x, y: rect.top + rect.height * 0.4 };
  }
  if (typeof getProfileAvatarViewportCenter === "function") {
    const c = getProfileAvatarViewportCenter(team);
    return { x: c.x + (slotIndex - 1) * 36, y: c.y + 48 };
  }
  return { x: 0, y: 0 };
}

function tickDamageFlights(state, dt) {
  if (!state?.damageFlights?.length) return;
  const now = state.elapsed || 0;
  state.damageFlights = state.damageFlights.filter((fx) => {
    fx.age += dt;
    if (!fx.landed && fx.age >= fx.duration) {
      fx.landed = true;
      const store = state.damageStacks?.[fx.targetTeam];
      const entry = store?.byUid?.[fx.itemUid];
      if (entry) entry.bounceUntil = now + DAMAGE_STACK_BOUNCE_SEC;
    }
    return fx.age < fx.duration + 0.12;
  });
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function sampleDamageFlight(fx, t) {
  const u = easeOutBack(Math.min(1, Math.max(0, t)));
  if (typeof quadraticBezier === "function") {
    return quadraticBezier(
      { x: fx.fromX, y: fx.fromY },
      { x: fx.cpX, y: fx.cpY },
      { x: fx.toX, y: fx.toY },
      u,
    );
  }
  return {
    x: fx.fromX + (fx.toX - fx.fromX) * u,
    y: fx.fromY + (fx.toY - fx.fromY) * u,
  };
}

function ensureDamageFlightLayer() {
  let layer = document.getElementById("battle-damage-fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "battle-damage-fx-layer";
    layer.className = "battle-damage-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

function clearDamageFlightLayer() {
  damageFlightActive.forEach((el) => el.remove());
  damageFlightActive.clear();
  const layer = document.getElementById("battle-damage-fx-layer");
  if (layer) layer.innerHTML = "";
}

function acquireDamageFlightEl() {
  return damageFlightPool.pop() || document.createElement("div");
}

function releaseDamageFlightEl(el) {
  if (!el) return;
  el.remove();
  if (damageFlightPool.length < DAMAGE_FLIGHT_MAX_ACTIVE) damageFlightPool.push(el);
}

function renderDamageFlights(state) {
  if (!state?.damageFlights?.length) {
    if (damageFlightActive.size > 0) clearDamageFlightLayer();
    return;
  }

  const layer = ensureDamageFlightLayer();
  const active = new Set();

  state.damageFlights.forEach((fx) => {
    active.add(fx.id);
    const store = state.damageStacks?.[fx.targetTeam];
    const slotIndex = store?.order?.indexOf(fx.itemUid) ?? 0;
    const to = getDamageStackSlotViewport(
      fx.targetTeam,
      Math.max(0, slotIndex),
      store?.order?.length || 1,
    );
    fx.toX = to.x;
    fx.toY = to.y;

    const t = fx.age / fx.duration;
    const pt = sampleDamageFlight(fx, t);
    const spin = fx.spin * t;
    const alpha = t < 0.06 ? t / 0.06 : t > 0.92 ? Math.max(0, 1 - (t - 0.92) / 0.08) : 1;

    let el = damageFlightActive.get(fx.id);
    if (!el) {
      el = acquireDamageFlightEl();
      el.className = `battle-damage-flight battle-damage-flight-${fx.targetTeam}`;
      el.dataset.fxId = fx.id;
      el.textContent = fx.icon;
      layer.appendChild(el);
      damageFlightActive.set(fx.id, el);
    }

    const uiScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
    const size = 22 * fx.scale * uiScale;
    el.style.fontSize = `${size}px`;
    el.style.opacity = String(alpha);
    el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%) rotate(${spin}deg) scale(${fx.scale})`;
  });

  damageFlightActive.forEach((el, id) => {
    if (active.has(id)) return;
    releaseDamageFlightEl(el);
    damageFlightActive.delete(id);
  });
}

function ensureDamageStacksEl(shell) {
  const footer = shell.querySelector(".avatar-hero-footer");
  if (!footer) return null;
  let stacks = footer.querySelector(".avatar-damage-stacks");
  if (!stacks) {
    stacks = document.createElement("div");
    stacks.className = "avatar-damage-stacks";
    stacks.setAttribute("aria-hidden", "true");
    footer.insertBefore(stacks, footer.firstChild);
  }
  return stacks;
}

function syncDamageStackDisplay(team, state) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const shell = slot?.querySelector(".avatar-hero-shell");
  if (!shell) return;

  const stacksEl = ensureDamageStacksEl(shell);
  if (!stacksEl) return;

  const store = state?.damageStacks?.[team];
  const now = state?.elapsed || 0;
  if (!store?.order?.length) {
    stacksEl.innerHTML = "";
    stacksEl.hidden = true;
    return;
  }

  stacksEl.hidden = false;
  const activeUids = new Set(store.order.filter((uid) => store.byUid[uid]?.damage > 0));

  stacksEl.querySelectorAll(".avatar-damage-stack").forEach((el) => {
    if (!activeUids.has(el.dataset.stackUid)) el.remove();
  });

  store.order.forEach((uid, slotIndex) => {
    const entry = store.byUid[uid];
    if (!entry || entry.damage <= 0) return;

    let el = stacksEl.querySelector(`[data-stack-uid="${CSS.escape(uid)}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "avatar-damage-stack";
      el.dataset.stackUid = uid;
      el.dataset.slot = String(slotIndex);
      el.innerHTML = `<span class="avatar-damage-stack-icon"></span><span class="avatar-damage-stack-value"></span>`;
      stacksEl.appendChild(el);
    }

    el.dataset.slot = String(slotIndex);
    const iconEl = el.querySelector(".avatar-damage-stack-icon");
    const valEl = el.querySelector(".avatar-damage-stack-value");
    if (iconEl) iconEl.textContent = entry.icon;
    if (valEl) valEl.textContent = `−${Math.round(entry.damage)}`;

    const bouncing = entry.bounceUntil > now;
    el.classList.toggle("avatar-damage-stack-bounce", bouncing);
    if (entry.itemId && ITEM_CATALOG[entry.itemId]) {
      el.title = ITEM_CATALOG[entry.itemId].name;
    }
  });
}

function syncAllDamageSummaryDisplays(state) {
  if (!state) return;
  syncDamageStackDisplay("player", state);
  syncDamageStackDisplay("enemy", state);
}

function ensureCountdownOverlay() {
  let el = document.getElementById("battle-countdown-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "battle-countdown-overlay";
    el.className = "battle-countdown-overlay";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<span class="battle-countdown-digit"></span>`;
    document.body.appendChild(el);
  }
  return el;
}

function renderBattleCountdown(state) {
  const overlay = ensureCountdownOverlay();
  if (!state?.countdown?.active || !state.countdown.label) {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  const digit = overlay.querySelector(".battle-countdown-digit");
  if (digit && digit.textContent !== state.countdown.label) {
    digit.textContent = state.countdown.label;
    digit.classList.remove("battle-countdown-pop");
    void digit.offsetWidth;
    digit.classList.add("battle-countdown-pop");
  }
}

function clearBattleDamageSummary(state) {
  if (state) {
    state.damageStacks = {
      player: createDamageStackStore(),
      enemy: createDamageStackStore(),
    };
    state.damageFlights = [];
    state.countdown = { active: false, remaining: 0, label: null };
  }
  clearDamageFlightLayer();
  stackBounceTimers.clear();
  const overlay = document.getElementById("battle-countdown-overlay");
  if (overlay) overlay.hidden = true;
  ["player", "enemy"].forEach((team) => {
    const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
    const stacks = slot?.querySelector(".avatar-damage-stacks");
    if (stacks) {
      stacks.innerHTML = "";
      stacks.hidden = true;
    }
  });
}

function isAggregatedWeaponDamage(text, color, kind) {
  if (kind !== "damage" || color === "#8b949e") return false;
  if (color === "#f85149") return true;
  const t = String(text);
  return t.startsWith("🔥") || t.startsWith("✨");
}
