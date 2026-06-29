/**
 * ItemFlightController — визуальный полёт предметов.
 * Вытеснение на скамейку: DETACH → IMPULSE → FLIGHT (+ magnet) → LANDING → SETTLE.
 * Не меняет состояние инвентаря.
 */

const ItemFlightPhase = {
  IMPULSE: "impulse",
  ARC: "arc",
  LANDING: "landing",
  DONE: "done",
};

const DisplacePhase = {
  DETACH: "detach",
  IMPULSE: "impulse",
  FLIGHT: "flight",
  LANDING: "landing",
  DONE: "done",
};

const ITEM_FLIGHT_STAGGER = 0.12;
const ITEM_FLIGHT_MAX_ACTIVE = 24;

/** Фазы вытеснения — единый таймлайн ≈ 770 ms (диапазон ТЗ 650–800 ms). */
const DISPLACE_TOTAL_DUR = 0.77;
const DISPLACE_LAND_START = 0.825;

let itemFlights = [];
let itemFlightIdCounter = 0;
const itemFlightDomActive = new Map();

function itemFlightUiScale() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
}

function itemFlightUiPx(n) {
  return n * itemFlightUiScale();
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

function easeInCubic(t) {
  const x = clamp01(t);
  return x * x * x;
}

function easeOutQuad(t) {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
}

function easeInQuad(t) {
  const x = clamp01(t);
  return x * x;
}

function easeOutBack(t) {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function quadraticBezier(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function sampleCubicPoint(out, x0, y0, x1, y1, x2, y2, x3, y3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  out.x = uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3;
  out.y = uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3;
  return out;
}

/** Монотонный прогресс вдоль траектории — без скачков на стыках фаз. */
function sampleDisplacePathU(u) {
  const detachEnd = 0.175;
  const impulseEnd = 0.305;
  const flightEnd = 0.875;

  if (u <= detachEnd) {
    return easeOutCubic(u / detachEnd) * 0.05;
  }
  if (u <= impulseEnd) {
    const t = (u - detachEnd) / (impulseEnd - detachEnd);
    return 0.05 + easeOutCubic(t) * 0.11;
  }
  if (u <= flightEnd) {
    const t = (u - impulseEnd) / (flightEnd - impulseEnd);
    return 0.16 + easeInOutCubic(t) * 0.79;
  }
  const t = (u - flightEnd) / (1 - flightEnd);
  return 0.95 + easeInQuad(t) * 0.05;
}

function resolveFlightProfile(itemId) {
  const def = typeof ITEM_CATALOG !== "undefined" && itemId ? ITEM_CATALOG[itemId] : null;
  const tags = def?.tags || [];

  if (tags.includes("weapon")) {
    return {
      flightWeight: 0.82,
      flightSpeed: 1.28,
      bounceStrength: 0.62,
      rotationSpeed: 1.25,
      arcHeightMul: 1.05,
      wobble: false,
    };
  }
  if (tags.includes("gem")) {
    return {
      flightWeight: 1.45,
      flightSpeed: 0.82,
      bounceStrength: 0.28,
      rotationSpeed: 0.5,
      arcHeightMul: 0.5,
      wobble: false,
    };
  }
  if (tags.includes("potion") || tags.includes("food") || tags.includes("heal")) {
    return {
      flightWeight: 0.68,
      flightSpeed: 0.92,
      bounceStrength: 0.72,
      rotationSpeed: 1.45,
      arcHeightMul: 1.38,
      wobble: false,
    };
  }
  if (tags.includes("armor") || tags.includes("shield")) {
    return {
      flightWeight: 1.25,
      flightSpeed: 0.88,
      bounceStrength: 0.32,
      rotationSpeed: 0.48,
      arcHeightMul: 0.58,
      wobble: false,
    };
  }
  return {
    flightWeight: 1,
    flightSpeed: 1,
    bounceStrength: 0.5,
    rotationSpeed: 1,
    arcHeightMul: 1,
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
    appendToLayerFx(layer);
  }
  return layer;
}

function clearItemFlightDomLayer() {
  itemFlightDomActive.forEach((el) => el.remove());
  itemFlightDomActive.clear();
  const layer = document.getElementById("item-flight-fx-layer");
  if (layer) layer.innerHTML = "";
}

function initDisplaceFlight(f) {
  const profile = resolveFlightProfile(f.itemId);
  const rand = Math.random;
  const w = profile.flightWeight;

  f.isDisplace = true;
  f.profile = profile;
  f.targetX = f.toX;
  f.targetY = f.toY;
  f.x = f.fromX;
  f.y = f.fromY;
  f.totalDur = DISPLACE_TOTAL_DUR;
  f.localTime = 0;
  f.displacePhase = DisplacePhase.DETACH;

  f.peakScale = 1.06 + rand() * 0.02;
  f.scale = 1;
  f.shadowStrength = 0;
  f.startRotation = (rand() - 0.5) * 6;
  f.rotation = f.startRotation;
  f.spinAmount = ((240 + rand() * 120) / w) * profile.rotationSpeed * (rand() > 0.5 ? 1 : -1);
  f.bounceAmp = itemFlightUiPx(3 + profile.bounceStrength * 2);
  f.detachLift = itemFlightUiPx(8);
  f.impulseUp = itemFlightUiPx(12 + rand() * 8);

  const dx = f.targetX - f.fromX;
  const dy = f.targetY - f.fromY;
  f.pathDist = Math.max(1, Math.hypot(dx, dy));
  f.pathNx = dx / f.pathDist;
  f.pathNy = dy / f.pathDist;

  f.p0x = f.fromX;
  f.p0y = f.fromY;
  f.p1x = f.fromX + f.pathNx * itemFlightUiPx(24);
  f.p1y = f.fromY - f.impulseUp - f.detachLift * 0.45;
  const arcBase = (52 + Math.min(f.pathDist * 0.05, 72)) * profile.arcHeightMul / w;
  f.p2x = (f.fromX + f.targetX) * 0.5;
  f.p2y = Math.min(f.fromY, f.targetY) - itemFlightUiPx(arcBase);
  f.p3x = f.targetX;
  f.p3y = f.targetY;
}

function initItemFlight(f) {
  if (f.isDisplace) {
    initDisplaceFlight(f);
    return;
  }

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
  f.shadowStrength = 0;

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

function tickDisplaceAnimation(f, dt) {
  f.localTime += dt;
  const u = clamp01(f.localTime / f.totalDur);

  const pathU = sampleDisplacePathU(u);
  sampleCubicPoint(f._pt, f.p0x, f.p0y, f.p1x, f.p1y, f.p2x, f.p2y, f.p3x, f.p3y, pathU);

  const liftFade = u < 0.26 ? 1 - easeOutCubic(u / 0.26) : 0;
  const extraLift = -f.detachLift * liftFade;

  let bounceY = 0;
  if (u >= DISPLACE_LAND_START) {
    const lt = (u - DISPLACE_LAND_START) / (1 - DISPLACE_LAND_START);
    bounceY = -f.bounceAmp * Math.sin(easeOutBack(lt) * Math.PI);
  }

  f.x = f._pt.x;
  f.y = f._pt.y + extraLift + bounceY;

  const scaleUp = u < 0.175 ? easeOutCubic(u / 0.175) : 1;
  const scaleDown = u > 0.55 ? easeInQuad((u - 0.55) / 0.45) * 0.35 : 0;
  let scale = 1 + (f.peakScale - 1) * scaleUp * (1 - scaleDown);
  if (u >= DISPLACE_LAND_START) {
    const lt = (u - DISPLACE_LAND_START) / (1 - DISPLACE_LAND_START);
    scale += 0.04 * f.profile.bounceStrength * Math.sin(easeOutBack(lt) * Math.PI);
  }
  if (u > 0.88) {
    scale += (1 - scale) * easeOutCubic((u - 0.88) / 0.12);
  }
  f.scale = scale;

  const spinFade = 1 - easeInQuad(clamp01((u - 0.5) / 0.5));
  f.rotation = f.startRotation + f.spinAmount * easeOutCubic(u) * spinFade;
  if (u > 0.88) {
    f.rotation *= 1 - easeOutCubic((u - 0.88) / 0.12);
  }

  f.shadowStrength = easeOutCubic(Math.min(u / 0.22, 1)) * (1 - easeOutCubic(Math.max(0, (u - 0.78) / 0.22)));

  if (u >= 1) {
    f.x = f.targetX;
    f.y = f.targetY;
    f.scale = 1;
    f.rotation = 0;
    f.shadowStrength = 0;
    f.displacePhase = DisplacePhase.DONE;
    f.finished = true;
    f.despawnTime = 0;
  }
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
  if (f.isDisplace) {
    tickDisplaceAnimation(f, dt);
    return;
  }

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

  if (snapped || forcedSnap) {
    beginLanding(f);
  }
}

function sampleItemFlightVisual(f) {
  const vis = f._vis;
  vis.x = f.x;
  vis.y = f.y;
  vis.rotation = f.rotation;
  vis.scale = f.scale || 1;
  vis.alpha = 1;
  vis.shadowStrength = f.shadowStrength || 0;
  return vis;
}

function completeItemFlight(f) {
  if (f._completeFired) return;
  f._completeFired = true;

  const el = itemFlightDomActive.get(f.id);
  if (el) {
    el.remove();
    itemFlightDomActive.delete(f.id);
  }

  try {
    f.onComplete?.(f.meta);
  } catch (err) {
    console.error("item flight onComplete failed:", err);
  }
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
    if (f.finished) return;
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

    const px = Math.round(vis.x * 2) / 2;
    const py = Math.round(vis.y * 2) / 2;

    el.style.fontSize = `${fontSize}px`;
    el.style.opacity = String(0.94 + (vis.shadowStrength || 0) * 0.06);
    el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%) rotate(${vis.rotation.toFixed(2)}deg) scale(${vis.scale.toFixed(4)})`;
    el.classList.toggle("displace-flight--airborne", f.isDisplace && !f.finished);
    el.classList.toggle("displace-flight--lifted", f.isDisplace && !f.finished && (vis.shadowStrength || 0) > 0.35);
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
    isDisplace: options.isDisplace === true,
    delay: Math.max(0, options.delay || 0),
    age: 0,
    meta: options.meta || {},
    onComplete: typeof options.onComplete === "function" ? options.onComplete : null,
    finished: false,
    despawnTime: 0,
    _vis: { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1, shadowStrength: 0 },
    _pt: { x: 0, y: 0 },
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

    if (f.finished) {
      completeItemFlight(f);
      return false;
    }

    return true;
  });

  renderItemFlights();
}

function hasActiveItemFlights(filterFn = null) {
  const isLive = (f) => !f.finished;
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
