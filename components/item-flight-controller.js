/**
 * ItemFlightController — физический полёт предметов (только визуал).
 * IMPULSE → ARC (+ magnet) → LANDING. Не меняет состояние инвентаря.
 */

const ItemFlightPhase = {
  IMPULSE: "impulse",
  ARC: "arc",
  LANDING: "landing",
  DONE: "done",
};

const ITEM_FLIGHT_STAGGER = 0.12;
const ITEM_FLIGHT_MAX_ACTIVE = 24;
const ITEM_FLIGHT_MAX_AGE = 2.2;

let itemFlights = [];
let itemFlightIdCounter = 0;
const itemFlightDomActive = new Map();

function itemFlightUiScale() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
}

function itemFlightUiPx(n) {
  return n * itemFlightUiScale();
}

function easeOutCubic(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

function easeInCubic(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x;
}

function easeOutQuad(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) * (1 - x);
}

function easeInQuad(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x;
}

function quadraticBezier(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function resolveFlightProfile(itemId) {
  const def = typeof ITEM_CATALOG !== "undefined" && itemId ? ITEM_CATALOG[itemId] : null;
  const tags = def?.tags || [];

  if (tags.includes("weapon")) {
    return {
      flightWeight: 0.82,
      flightSpeed: 1.28,
      bounceStrength: 0.72,
      rotationSpeed: 1.35,
      wobble: false,
    };
  }
  if (tags.includes("gem")) {
    return {
      flightWeight: 1.45,
      flightSpeed: 0.82,
      bounceStrength: 0.32,
      rotationSpeed: 0.55,
      wobble: false,
    };
  }
  if (tags.includes("potion") || tags.includes("food") || tags.includes("heal")) {
    return {
      flightWeight: 0.68,
      flightSpeed: 0.92,
      bounceStrength: 0.58,
      rotationSpeed: 0.85,
      wobble: true,
    };
  }
  if (tags.includes("armor") || tags.includes("shield")) {
    return {
      flightWeight: 1.25,
      flightSpeed: 0.88,
      bounceStrength: 0.42,
      rotationSpeed: 0.65,
      wobble: false,
    };
  }
  return {
    flightWeight: 1,
    flightSpeed: 1,
    bounceStrength: 0.5,
    rotationSpeed: 1,
    wobble: false,
  };
}

function computeMagnetForce(distPx) {
  const r40 = itemFlightUiPx(40);
  const r20 = itemFlightUiPx(20);
  const r5 = itemFlightUiPx(5);
  if (distPx >= r40) return 0;
  if (distPx <= r5) return itemFlightUiPx(4800);
  if (distPx <= r20) {
    const t = 1 - (distPx - r5) / (r20 - r5);
    return itemFlightUiPx(900 + easeInCubic(t) * 2800);
  }
  const t = 1 - (distPx - r20) / (r40 - r20);
  return itemFlightUiPx(180 + easeInCubic(t) * 720);
}

function ensureItemFlightLayer() {
  let layer = document.getElementById("item-flight-fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "item-flight-fx-layer";
    layer.className = "item-flight-fx-layer item-movement-fx-layer displace-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

function clearItemFlightDomLayer() {
  itemFlightDomActive.forEach((el) => el.remove());
  itemFlightDomActive.clear();
  const layer = document.getElementById("item-flight-fx-layer");
  if (layer) layer.innerHTML = "";
}

function initItemFlight(f) {
  const profile = resolveFlightProfile(f.itemId);
  const rand = Math.random;

  f.profile = profile;
  f.x = f.fromX;
  f.y = f.fromY;
  f.targetX = f.toX;
  f.targetY = f.toY;
  f.rotation = (rand() - 0.5) * 18;
  f.targetRotation = 0;
  f.scale = 1;
  f.magnetActive = false;

  const dx = f.targetX - f.fromX;
  const dy = f.targetY - f.fromY;
  f.initialDist = Math.max(1, Math.hypot(dx, dy));
  f.pathNx = dx / f.initialDist;
  f.pathNy = dy / f.initialDist;

  f.impulseDuration = (0.1 + rand() * 0.05) / profile.flightSpeed;
  f.arcDuration = (0.35 + rand() * 0.15) / profile.flightSpeed;
  f.landingDuration = 0.15;
  f.phase = ItemFlightPhase.IMPULSE;
  f.phaseTime = 0;
  f.localTime = 0;
  f.landingYOffset = 0;
  f.wobblePhase = rand() * Math.PI * 2;

  const verticalImpulse = itemFlightUiPx(80 + rand() * 40);
  const horizontalRandom = (rand() - 0.5) * itemFlightUiPx(40);

  f.gravity = itemFlightUiPx(1180 + rand() * 180) * profile.flightWeight;
  const rotBase = 180 + rand() * 180;
  f.angularVelocity = rotBase * profile.rotationSpeed * (rand() > 0.5 ? 1 : -1);

  const launchHoriz = itemFlightUiPx(90 * profile.flightSpeed);
  f.velocityX = f.pathNx * launchHoriz * 0.35 + horizontalRandom / f.impulseDuration;
  f.velocityY = -verticalImpulse / (f.impulseDuration * 0.85);

  const midX = (f.fromX + f.targetX) * 0.5;
  const midY = (f.fromY + f.targetY) * 0.5;
  f.controlX = midX + (rand() - 0.5) * itemFlightUiPx(36);
  f.controlY = Math.min(f.fromY, f.targetY, midY) - itemFlightUiPx(48 + rand() * 36);
}

function beginLanding(f) {
  f.phase = ItemFlightPhase.LANDING;
  f.phaseTime = 0;
  f.x = f.targetX;
  f.y = f.targetY;
  f.velocityX = 0;
  f.velocityY = 0;
  f.landingYOffset = 0;
}

function tickItemFlightPhysics(f, dt) {
  f.localTime += dt;
  f.phaseTime += dt;

  if (f.phase === ItemFlightPhase.LANDING) {
    const t = Math.min(1, f.phaseTime / f.landingDuration);
    const upPhase = t < 0.42 ? easeOutQuad(t / 0.42) : 1;
    const downPhase = t < 0.42 ? 0 : easeInQuad((t - 0.42) / 0.58);
    const bounceWave = Math.sin(upPhase * Math.PI * 0.92) * (1 - downPhase * 0.15);

    f.landingYOffset = -itemFlightUiPx(5) * bounceWave;
    f.scale = 1 + 0.15 * bounceWave * f.profile.bounceStrength;
    f.rotation += (f.targetRotation - f.rotation) * Math.min(1, dt * 14);
    f.angularVelocity *= Math.max(0, 1 - dt * 10);

    f.x = f.targetX;
    f.y = f.targetY + f.landingYOffset;

    if (t >= 1) {
      f.rotation = 0;
      f.scale = 1;
      f.phase = ItemFlightPhase.DONE;
      f.finished = true;
      f.despawnTime = 0;
    }
    return;
  }

  if (f.phase === ItemFlightPhase.IMPULSE && f.phaseTime >= f.impulseDuration) {
    f.phase = ItemFlightPhase.ARC;
    f.phaseTime = 0;
  }

  const toX = f.targetX - f.x;
  const toY = f.targetY - f.y;
  const dist = Math.hypot(toX, toY);
  const speed = Math.hypot(f.velocityX, f.velocityY);
  const pathProgress = 1 - dist / f.initialDist;

  const arcProgress = f.phase === ItemFlightPhase.IMPULSE
    ? f.phaseTime / f.impulseDuration * 0.12
    : Math.min(1, f.phaseTime / f.arcDuration);

  const guideT = easeOutCubic(arcProgress);
  const guide = quadraticBezier(
    { x: f.fromX, y: f.fromY },
    { x: f.controlX, y: f.controlY },
    { x: f.targetX, y: f.targetY },
    guideT,
  );

  const steerX = guide.x - f.x;
  const steerY = guide.y - f.y;
  const steerMul = f.phase === ItemFlightPhase.IMPULSE ? 3.2 : 5.4;
  f.velocityX += steerX * steerMul * dt;
  f.velocityY += steerY * steerMul * dt;

  if (dist < itemFlightUiPx(40) || pathProgress > 0.8) {
    f.magnetActive = true;
  }

  if (f.magnetActive) {
    const magnet = computeMagnetForce(dist);
    if (dist > 0.5) {
      f.velocityX += (toX / dist) * magnet * dt;
      f.velocityY += (toY / dist) * magnet * dt;
    }
    f.velocityY += f.gravity * dt * 0.28;
    const rotDamp = Math.min(1, dist / itemFlightUiPx(40));
    f.angularVelocity *= 0.9 + rotDamp * 0.08;
  } else {
    f.velocityY += f.gravity * dt;
    if (f.phase === ItemFlightPhase.ARC && arcProgress > 0.55) {
      f.angularVelocity *= Math.max(0, 1 - dt * 2.8);
    }
  }

  if (f.profile.wobble) {
    f.velocityX += Math.sin(f.localTime * 9 + f.wobblePhase) * itemFlightUiPx(22) * dt;
    f.velocityY += Math.cos(f.localTime * 7 + f.wobblePhase) * itemFlightUiPx(8) * dt;
  }

  f.x += f.velocityX * dt;
  f.y += f.velocityY * dt;
  f.rotation += f.angularVelocity * dt;

  const arcExpired = f.phase === ItemFlightPhase.ARC && f.phaseTime >= f.arcDuration;
  const snapped = dist < itemFlightUiPx(5) && speed < itemFlightUiPx(95);
  const forcedSnap = arcExpired && dist < itemFlightUiPx(18);
  const timeoutSnap = f.localTime > 0.82 && dist < itemFlightUiPx(24);

  if (snapped || forcedSnap || timeoutSnap) {
    beginLanding(f);
  }
}

function sampleItemFlightVisual(f) {
  return {
    x: f.x,
    y: f.y,
    rotation: f.rotation,
    scale: f.scale || 1,
    alpha: 1,
  };
}

function renderItemFlights() {
  if (!itemFlights.length) {
    if (itemFlightDomActive.size) clearItemFlightDomLayer();
    return;
  }

  const layer = ensureItemFlightLayer();
  const active = new Set();
  const fontSize = 52 * itemFlightUiScale();

  itemFlights.forEach((f) => {
    active.add(f.id);
    const vis = sampleItemFlightVisual(f);
    let el = itemFlightDomActive.get(f.id);
    if (!el) {
      el = document.createElement("div");
      el.className = "item-flight displace-flight item-movement-flight";
      el.textContent = f.emoji || "📦";
      layer.appendChild(el);
      itemFlightDomActive.set(f.id, el);
    }
    el.style.fontSize = `${fontSize}px`;
    el.style.opacity = String(vis.alpha);
    el.style.transform = `translate3d(${vis.x}px, ${vis.y}px, 0) translate(-50%, -50%) rotate(${vis.rotation}deg) scale(${vis.scale})`;
  });

  itemFlightDomActive.forEach((el, id) => {
    if (active.has(id)) return;
    el.remove();
    itemFlightDomActive.delete(id);
  });
}

/**
 * @param {object} options
 * @param {number} options.fromX
 * @param {number} options.fromY
 * @param {number} options.toX
 * @param {number} options.toY
 * @param {string} [options.emoji]
 * @param {string} [options.itemId]
 * @param {number} [options.delay]
 * @param {object} [options.meta]
 * @param {Function} [options.onComplete]
 */
function queueItemFlight(options) {
  if (!options) return null;
  if (itemFlights.length >= ITEM_FLIGHT_MAX_ACTIVE) itemFlights.shift();

  const flight = {
    id: ++itemFlightIdCounter,
    fromX: options.fromX,
    fromY: options.fromY,
    toX: options.toX,
    toY: options.toY,
    emoji: options.emoji || "📦",
    itemId: options.itemId || options.meta?.item?.itemId || null,
    delay: Math.max(0, options.delay || 0),
    age: 0,
    meta: options.meta || {},
    onComplete: typeof options.onComplete === "function" ? options.onComplete : null,
    finished: false,
    despawnTime: 0,
  };

  initItemFlight(flight);
  itemFlights.push(flight);
  renderItemFlights();
  return flight.id;
}

function tickItemFlights(dt) {
  if (!itemFlights.length) return;

  itemFlights = itemFlights.filter((f) => {
    f.age += dt;
    if (f.age < f.delay) return true;

    tickItemFlightPhysics(f, dt);

    if (f.localTime >= ITEM_FLIGHT_MAX_AGE && f.phase !== ItemFlightPhase.LANDING && f.phase !== ItemFlightPhase.DONE) {
      beginLanding(f);
    }

    if (!f.finished) return true;

    if (!f._completeFired) {
      f._completeFired = true;
      try {
        f.onComplete?.(f.meta);
      } catch (err) {
        console.error("item flight onComplete failed:", err);
      }
    }

    f.despawnTime += dt;
    return f.despawnTime < 0.08;
  });

  renderItemFlights();
}

function hasActiveItemFlights(filterFn = null) {
  const isLive = (f) => !f.finished || f.despawnTime < 0.08;
  if (!filterFn) return itemFlights.some(isLive);
  return itemFlights.some((f) => isLive(f) && filterFn(f));
}

function clearItemFlights(filterFn = null) {
  if (!filterFn) {
    itemFlights = [];
    clearItemFlightDomLayer();
    return;
  }
  itemFlights = itemFlights.filter((f) => !filterFn(f));
  renderItemFlights();
}

/** Совместимость с displace-animation.js */
const ITEM_MOVEMENT_STAGGER = ITEM_FLIGHT_STAGGER;
const ItemMovementType = { DROP: "drop", BEZIER: "bezier", THROW: "throw" };

function queueItemMovement(options) {
  return queueItemFlight({
    fromX: options.fromX,
    fromY: options.fromY,
    toX: options.toX,
    toY: options.toY,
    emoji: options.emoji,
    itemId: options.meta?.item?.itemId,
    delay: options.delay,
    meta: options.meta,
    onComplete: options.onComplete,
  });
}

function tickItemMovements(dt) {
  tickItemFlights(dt);
}

function hasActiveItemMovements(filterFn) {
  return hasActiveItemFlights(filterFn);
}

function clearItemMovements(filterFn) {
  clearItemFlights(filterFn);
}
