/**
 * Визуальный слой урона: отсчёт 3-2-1, полёт эмодзи из инвентаря, стеки над HP.
 */

const BATTLE_COUNTDOWN_SEC = 3;
const DAMAGE_FLIGHT_MIN = 0.78;
const DAMAGE_FLIGHT_MAX = 1.38;
const DAMAGE_FLIGHT_REPEAT_MULT = 1.22;
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
    state.countdown.remaining = 0;
    state.countdown.label = null;
    hideBattleCountdownOverlay();
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
  state.benefitStacks = {
    player: { byUid: {}, order: [] },
    enemy: { byUid: {}, order: [] },
  };
  state.dotStacks = {
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

function getFirstDamageArcControl(from, to, sourceTeam, targetTeam) {
  if (typeof getWeaponControlPoint === "function") {
    return getWeaponControlPoint(from, to, targetTeam);
  }
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return {
    x: midX,
    y: midY - Math.max(32, dist * 0.14),
  };
}

/** Дуга повторной атаки: от стека над HP через центр арены обратно на стек. */
function getRepeatStackArcControls(from, to, sourceTeam) {
  const center = typeof getBattlefieldCenterViewport === "function"
    ? getBattlefieldCenterViewport()
    : { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 140 };
  const towardSource = sourceTeam === "player" ? -1 : 1;
  const spread = Math.max(72, Math.abs(from.x - center.x) * 0.42, window.innerWidth * 0.06);
  const lift = Math.max(88, window.innerHeight * 0.1);
  return {
    c1: {
      x: from.x + towardSource * spread * 0.62,
      y: from.y - lift * 0.42,
    },
    c2: {
      x: center.x + towardSource * spread * 0.08,
      y: center.y - lift * 0.18,
    },
  };
}

function buildDamageFlightPath(state, targetTeam, sourceTeam, item, slotIndex, total, priorDamage) {
  const to = getDamageStackSlotViewport(targetTeam, slotIndex, total);
  const isRepeat = priorDamage > 0;

  if (isRepeat) {
    const from = getDamageStackSlotViewport(targetTeam, slotIndex, total);
    const { c1, c2 } = getRepeatStackArcControls(from, to, sourceTeam);
    const dist = Math.max(120, Math.hypot(c2.x - from.x, c2.y - from.y) + Math.hypot(to.x - c2.x, to.y - c2.y));
    const duration = (DAMAGE_FLIGHT_MIN + Math.min(1, dist / 780) * (DAMAGE_FLIGHT_MAX - DAMAGE_FLIGHT_MIN))
      * DAMAGE_FLIGHT_REPEAT_MULT;
    return {
      arcStyle: "repeat",
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      cp1X: c1.x,
      cp1Y: c1.y,
      cp2X: c2.x,
      cp2Y: c2.y,
      duration,
      spin: (flightRand(sourceTeam, item.uid, 3) - 0.5) * 420,
    };
  }

  const from = typeof getItemViewportCenter === "function"
    ? getItemViewportCenter(item, sourceTeam)
    : { x: 0, y: 0 };
  const cp = getFirstDamageArcControl(from, to, sourceTeam, targetTeam);
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const duration = DAMAGE_FLIGHT_MIN + Math.min(1, dist / 900) * (DAMAGE_FLIGHT_MAX - DAMAGE_FLIGHT_MIN);
  return {
    arcStyle: "first",
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    cpX: cp.x,
    cpY: cp.y,
    duration,
    spin: (flightRand(sourceTeam, item.uid, 3) - 0.5) * 540,
  };
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

function ensureBenefitStackEntry(store, uid, item) {
  if (store.byUid[uid]) return store.byUid[uid];
  const def = item?.itemId ? ITEM_CATALOG[item.itemId] : null;
  const entry = {
    uid,
    itemId: item?.itemId || null,
    icon: firstItemIconGrapheme(def?.icon),
    benefit: 0,
    healBenefit: 0,
    blockBenefit: 0,
    otherBenefit: 0,
    bounceUntil: 0,
  };
  store.byUid[uid] = entry;
  store.order.push(uid);
  return entry;
}

function ensureDotStackEntry(store, uid, item, dotKind) {
  if (store.byUid[uid]) return store.byUid[uid];
  const def = item?.itemId ? ITEM_CATALOG[item.itemId] : null;
  const entry = {
    uid,
    itemId: item?.itemId || null,
    icon: firstItemIconGrapheme(def?.icon),
    dotKind: dotKind || "poison",
    dotDamage: 0,
    bounceUntil: 0,
  };
  store.byUid[uid] = entry;
  store.order.push(uid);
  return entry;
}

function recordDotDamageDealt(state, sourceTeam, item, amount, dotKind = "poison") {
  const value = Math.max(0, Number(amount) || 0);
  if (!state || !sourceTeam || !item?.uid || value <= 0) return;
  if (isBattleCountdownActive(state)) return;

  initBattleDamageTracker(state);
  const victimTeam = sourceTeam === "player" ? "enemy" : "player";
  const store = state.dotStacks[victimTeam];
  const entry = ensureDotStackEntry(store, item.uid, item, dotKind);
  entry.dotDamage += value;
  entry.sourceTeam = sourceTeam;
  entry.bounceUntil = (state.elapsed || 0) + DAMAGE_STACK_BOUNCE_SEC;
  syncDotStackDisplay(victimTeam, state);
}

function recordIncomingDamage(state, targetTeam, sourceTeam, item, damage) {
  const amount = Math.max(0, Number(damage) || 0);
  if (!state || !targetTeam || !item?.uid || amount <= 0) return;
  if (isBattleCountdownActive(state)) return;

  initBattleDamageTracker(state);
  const store = state.damageStacks[targetTeam];
  const entry = ensureStackEntry(store, item.uid, item);
  const priorDamage = entry.damage;
  entry.damage += amount;
  entry.bounceUntil = (state.elapsed || 0) + DAMAGE_STACK_BOUNCE_SEC;
  stackBounceTimers.set(`${targetTeam}:${item.uid}`, entry.bounceUntil);

  const slotIndex = store.order.indexOf(item.uid);
  const path = buildDamageFlightPath(
    state,
    targetTeam,
    sourceTeam,
    item,
    slotIndex,
    store.order.length,
    priorDamage,
  );

  state._damageFlightUid += 1;

  if (state.damageFlights.length >= DAMAGE_FLIGHT_MAX_ACTIVE) state.damageFlights.shift();
  state.damageFlights.push({
    id: `dmgfx-${state._damageFlightUid}`,
    itemUid: item.uid,
    targetTeam,
    sourceTeam,
    icon: entry.icon,
    damage: amount,
    age: 0,
    landed: false,
    scale: damageFlightScale(amount),
    ...path,
  });
  syncDamageStackDisplay(targetTeam, state);
}

function formatStackItemName(entry) {
  if (entry?.itemId && ITEM_CATALOG[entry.itemId]) return ITEM_CATALOG[entry.itemId].name;
  return "Предмет";
}

function formatDamageStackTooltipMeta(entry) {
  const amount = Math.round(entry.damage || 0);
  return {
    title: formatStackItemName(entry),
    desc: `Входящий урон: −${amount} HP`,
  };
}

function formatBenefitStackTooltipMeta(entry) {
  const title = formatStackItemName(entry);
  const lines = [];
  if (entry.healBenefit > 0) lines.push(`Лечение: +${Math.round(entry.healBenefit)} HP`);
  if (entry.blockBenefit > 0) lines.push(`Блок: +${Math.round(entry.blockBenefit)}`);
  if (entry.otherBenefit > 0) lines.push(`Положительный эффект: +${Math.round(entry.otherBenefit)}`);
  if (!lines.length) lines.push(`Положительный эффект: +${Math.round(entry.benefit || 0)}`);
  return { title, desc: lines.join("\n") };
}

function formatDotStackTooltipMeta(entry) {
  const amount = Math.round(entry.dotDamage || 0);
  const label = entry.dotKind === "fire" ? "DoT огонь" : "DoT яд";
  const sourceLabel = entry.sourceTeam === "player"
    ? "от вас"
    : entry.sourceTeam === "enemy"
      ? "от противника"
      : "";
  return {
    title: formatStackItemName(entry),
    desc: sourceLabel
      ? `${label} ${sourceLabel}: ${amount} HP`
      : `${label}: ${amount} HP`,
  };
}

function applyStackTooltipMeta(el, meta) {
  if (!el || !meta) return;
  el.dataset.stackTitle = meta.title;
  el.dataset.stackDesc = meta.desc;
  el.setAttribute("aria-label", `${meta.title}. ${meta.desc}`);
  el.setAttribute("tabindex", "0");
}

function recordBenefitEffect(state, team, item, amount, benefitKind = "other") {
  const value = Math.max(0, Number(amount) || 0);
  if (!state || !team || !item?.uid || value <= 0) return;
  if (isBattleCountdownActive(state)) return;

  initBattleDamageTracker(state);
  const store = state.benefitStacks[team];
  const entry = ensureBenefitStackEntry(store, item.uid, item);
  entry.benefit += value;
  if (benefitKind === "heal") entry.healBenefit += value;
  else if (benefitKind === "block") entry.blockBenefit += value;
  else entry.otherBenefit += value;
  entry.bounceUntil = (state.elapsed || 0) + DAMAGE_STACK_BOUNCE_SEC;
  syncBenefitStackDisplay(team, state);
}

function getDamageStackSlotViewport(team, slotIndex, total) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const floatLayer = slot?.querySelector(".avatar-effects-float");
  const stacksEl = floatLayer?.querySelector(".avatar-damage-stacks")
    || slot?.querySelector(".avatar-damage-stacks");
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

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function sampleDamageFlight(fx, t) {
  const eased = fx.arcStyle === "repeat"
    ? easeInOutCubic(Math.min(1, Math.max(0, t)))
    : easeOutCubic(Math.min(1, Math.max(0, t)));

  if (fx.arcStyle === "repeat" && typeof cubicBezier === "function") {
    return cubicBezier(
      { x: fx.fromX, y: fx.fromY },
      { x: fx.cp1X, y: fx.cp1Y },
      { x: fx.cp2X, y: fx.cp2Y },
      { x: fx.toX, y: fx.toY },
      eased,
    );
  }

  if (typeof quadraticBezier === "function") {
    return quadraticBezier(
      { x: fx.fromX, y: fx.fromY },
      { x: fx.cpX, y: fx.cpY },
      { x: fx.toX, y: fx.toY },
      eased,
    );
  }
  return {
    x: fx.fromX + (fx.toX - fx.fromX) * eased,
    y: fx.fromY + (fx.toY - fx.fromY) * eased,
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
    const spin = fx.spin * (fx.arcStyle === "repeat"
      ? Math.sin(t * Math.PI) * 0.65
      : t);
    const alpha = t < 0.08 ? t / 0.08 : t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.1) : 1;
    const flightScale = fx.scale * (fx.arcStyle === "repeat" ? 1 + Math.sin(t * Math.PI) * 0.12 : 1);

    let el = damageFlightActive.get(fx.id);
    if (!el) {
      el = acquireDamageFlightEl();
      el.className = `battle-damage-flight battle-damage-flight-${fx.targetTeam} battle-damage-flight-${fx.arcStyle || "first"}`;
      el.dataset.fxId = fx.id;
      el.textContent = fx.icon;
      layer.appendChild(el);
      damageFlightActive.set(fx.id, el);
    }

    const uiScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
    const size = 22 * flightScale * uiScale;
    el.style.fontSize = `${size}px`;
    el.style.opacity = String(alpha);
    el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%) rotate(${spin}deg) scale(${flightScale})`;
  });

  damageFlightActive.forEach((el, id) => {
    if (active.has(id)) return;
    releaseDamageFlightEl(el);
    damageFlightActive.delete(id);
  });
}

function ensureDamageStacksEl(shell) {
  const floatLayer = shell.querySelector(".avatar-effects-float")
    || shell.querySelector(".avatar-hero-footer")
    || shell;
  let stacks = floatLayer.querySelector(".avatar-damage-stacks");
  if (!stacks) {
    stacks = document.createElement("div");
    stacks.className = "avatar-damage-stacks";
    stacks.setAttribute("aria-hidden", "true");
    floatLayer.insertBefore(stacks, floatLayer.firstChild);
  }
  return stacks;
}

function ensureBenefitStacksEl(shell) {
  const buffZone = shell.querySelector(".avatar-status-zone-buffs")
    || shell.querySelector(".avatar-hero-footer");
  if (!buffZone) return null;
  let stacks = buffZone.querySelector(".avatar-benefit-stacks");
  if (!stacks) {
    stacks = document.createElement("div");
    stacks.className = "avatar-benefit-stacks";
    stacks.setAttribute("aria-hidden", "true");
    buffZone.appendChild(stacks);
  }
  return stacks;
}

function ensureDotStacksEl(shell) {
  const debuffZone = shell.querySelector(".avatar-status-zone-debuffs")
    || shell.querySelector(".avatar-hero-footer");
  if (!debuffZone) return null;
  let stacks = debuffZone.querySelector(".avatar-dot-stacks");
  if (!stacks) {
    stacks = document.createElement("div");
    stacks.className = "avatar-dot-stacks";
    stacks.setAttribute("aria-hidden", "true");
    const debuffRow = debuffZone.querySelector(".avatar-hero-debuff-row");
    if (debuffRow) debuffRow.insertAdjacentElement("afterend", stacks);
    else debuffZone.appendChild(stacks);
  }
  return stacks;
}

function syncDotStackDisplay(team, state) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const shell = slot?.querySelector(".avatar-hero-shell");
  if (!shell) return;

  const stacksEl = ensureDotStacksEl(shell);
  if (!stacksEl) return;

  const store = state?.dotStacks?.[team];
  const now = state?.elapsed || 0;
  if (!store?.order?.length) {
    stacksEl.innerHTML = "";
    stacksEl.hidden = true;
    return;
  }

  stacksEl.hidden = false;
  const activeUids = new Set(store.order.filter((uid) => store.byUid[uid]?.dotDamage > 0));

  stacksEl.querySelectorAll(".avatar-dot-stack").forEach((el) => {
    if (!activeUids.has(el.dataset.stackUid)) el.remove();
  });

  store.order.forEach((uid, slotIndex) => {
    const entry = store.byUid[uid];
    if (!entry || entry.dotDamage <= 0) return;

    let el = stacksEl.querySelector(`[data-stack-uid="${CSS.escape(uid)}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = `avatar-dot-stack avatar-dot-stack-${entry.dotKind || "poison"}`;
      el.dataset.stackUid = uid;
      el.dataset.slot = String(slotIndex);
      el.innerHTML = `<span class="avatar-dot-stack-icon"></span><span class="avatar-dot-stack-value"></span>`;
      stacksEl.appendChild(el);
    }

    el.className = `avatar-dot-stack avatar-dot-stack-${entry.dotKind || "poison"}`;
    el.dataset.slot = String(slotIndex);
    const iconEl = el.querySelector(".avatar-dot-stack-icon");
    const valEl = el.querySelector(".avatar-dot-stack-value");
    if (iconEl) iconEl.textContent = entry.icon;
    if (valEl) valEl.textContent = String(Math.round(entry.dotDamage));

    const bouncing = entry.bounceUntil > now;
    el.classList.toggle("avatar-dot-stack-bounce", bouncing);
    el.classList.add("avatar-dot-stack-pulse");
    applyStackTooltipMeta(el, formatDotStackTooltipMeta(entry));
  });
}

function syncBenefitStackDisplay(team, state) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const shell = slot?.querySelector(".avatar-hero-shell");
  if (!shell) return;

  const stacksEl = ensureBenefitStacksEl(shell);
  if (!stacksEl) return;

  const store = state?.benefitStacks?.[team];
  const now = state?.elapsed || 0;
  if (!store?.order?.length) {
    stacksEl.innerHTML = "";
    stacksEl.hidden = true;
    return;
  }

  stacksEl.hidden = false;
  const activeUids = new Set(store.order.filter((uid) => store.byUid[uid]?.benefit > 0));

  stacksEl.querySelectorAll(".avatar-benefit-stack").forEach((el) => {
    if (!activeUids.has(el.dataset.stackUid)) el.remove();
  });

  store.order.forEach((uid, slotIndex) => {
    const entry = store.byUid[uid];
    if (!entry || entry.benefit <= 0) return;

    let el = stacksEl.querySelector(`[data-stack-uid="${CSS.escape(uid)}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "avatar-benefit-stack";
      el.dataset.stackUid = uid;
      el.dataset.slot = String(slotIndex);
      el.innerHTML = `<span class="avatar-benefit-stack-icon"></span><span class="avatar-benefit-stack-value"></span>`;
      stacksEl.appendChild(el);
    }

    el.dataset.slot = String(slotIndex);
    const iconEl = el.querySelector(".avatar-benefit-stack-icon");
    const valEl = el.querySelector(".avatar-benefit-stack-value");
    if (iconEl) iconEl.textContent = entry.icon;
    if (valEl) valEl.textContent = `+${Math.round(entry.benefit || 0)}`;

    const bouncing = entry.bounceUntil > now;
    el.classList.toggle("avatar-benefit-stack-bounce", bouncing);
    applyStackTooltipMeta(el, formatBenefitStackTooltipMeta(entry));
  });
}

function syncDamageStackDisplay(team) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const stacksEl = slot?.querySelector(".avatar-damage-stacks");
  if (stacksEl) {
    stacksEl.innerHTML = "";
    stacksEl.hidden = true;
  }
}

function formatIncomingDpsTooltip(dps) {
  if (!dps || dps < 0.05) {
    return "Входящий урон: нет активного давления (окно 5 с)";
  }
  return `Входящий урон: ${dps.toFixed(1)} HP/с (скользящее окно ${BATTLE_ANALYZER_WINDOW_SEC} с)`;
}

function syncIncomingDpsTooltip(team, state) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const shell = slot?.querySelector(".avatar-hero-shell");
  if (!shell || !state) return;

  const sideState = team === "player"
    ? state.commentary?.playerState
    : state.commentary?.enemyState;
  const dps = sideState?.metrics?.incomingDps ?? 0;
  const metrics = sideState?.metrics;
  const tip = formatIncomingDpsTooltip(dps);

  const hpLabel = shell.querySelector(".avatar-hero-hp-label");
  const hpBar = shell.querySelector(".avatar-hero-hp-bar");
  const stacksEl = shell.querySelector(".avatar-damage-stacks");
  const healTip = metrics?.projectedHeal2s > 0.5
    ? `${tip}\nОжидаемое лечение за 2 с: +${Math.round(metrics.projectedHeal2s)} HP`
    : tip;
  if (hpLabel) hpLabel.title = healTip;
  if (hpBar) hpBar.title = healTip;
  if (stacksEl) stacksEl.title = tip;
}

function syncAllDamageSummaryDisplays(state) {
  if (!state) return;
  syncDamageStackDisplay("player");
  syncDamageStackDisplay("enemy");
  syncBenefitStackDisplay("player", state);
  syncBenefitStackDisplay("enemy", state);
  syncDotStackDisplay("player", state);
  syncDotStackDisplay("enemy", state);
  syncIncomingDpsTooltip("player", state);
  syncIncomingDpsTooltip("enemy", state);
}

function hideBattleCountdownOverlay() {
  const overlay = document.getElementById("battle-countdown-overlay");
  if (!overlay) return;
  overlay.hidden = true;
  overlay.style.display = "none";
  overlay.classList.remove("battle-countdown-overlay-visible");
  const digit = overlay.querySelector(".battle-countdown-digit");
  if (digit) {
    digit.textContent = "";
    digit.classList.remove("battle-countdown-pop");
  }
}

function ensureCountdownOverlay() {
  let el = document.getElementById("battle-countdown-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "battle-countdown-overlay";
    el.className = "battle-countdown-overlay";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<span class="battle-countdown-digit"></span>`;
    el.style.display = "none";
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

function renderBattleCountdown(state) {
  if (!state?.countdown?.active || !state.countdown.label) {
    hideBattleCountdownOverlay();
    return;
  }
  const overlay = ensureCountdownOverlay();
  overlay.hidden = false;
  overlay.style.display = "flex";
  overlay.classList.add("battle-countdown-overlay-visible");
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
    state.benefitStacks = {
      player: createDamageStackStore(),
      enemy: createDamageStackStore(),
    };
    state.dotStacks = {
      player: createDamageStackStore(),
      enemy: createDamageStackStore(),
    };
    state.damageFlights = [];
    state.countdown = { active: false, remaining: 0, label: null };
  }
  clearDamageFlightLayer();
  stackBounceTimers.clear();
  hideBattleCountdownOverlay();
  ["player", "enemy"].forEach((team) => {
    const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
    const stacks = slot?.querySelector(".avatar-damage-stacks");
    if (stacks) {
      stacks.innerHTML = "";
      stacks.hidden = true;
    }
    const benefits = slot?.querySelector(".avatar-benefit-stacks");
    if (benefits) {
      benefits.innerHTML = "";
      benefits.hidden = true;
    }
    const dots = slot?.querySelector(".avatar-dot-stacks");
    if (dots) {
      dots.innerHTML = "";
      dots.hidden = true;
    }
  });
}

function isAggregatedWeaponDamage(text, color, kind) {
  if (kind !== "damage" || color === "#8b949e") return false;
  if (color === "#f85149") return true;
  const t = String(text);
  return t.startsWith("🔥") || t.startsWith("✨");
}
