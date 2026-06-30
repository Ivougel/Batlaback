/**
 * ArenaEquipment — экипировка манекена в боевой арене эмоджи.
 * Предметы «висят» в своей половине арены; оружие периодически бьёт по противнику.
 */

const ArenaEquipment = (() => {
  const SIZE_RATIO = 0.105;
  const SPRING_K = 9;
  const AIR_DRAG = 0.992;
  const MAX_DT = 0.032;
  const SYNC_INTERVAL_MS = 450;
  const BURST_SPACING_SEC = 6.5;
  const MIN_BURSTS = 2;
  const MAX_BURSTS = 14;

  const PHASE_DUR = {
    lunge: 0.22,
    hit: 0.11,
    return: 0.26,
  };

  function resolveBodyAttackStyle(def) {
    if (typeof ArenaAttackStyles !== "undefined" && ArenaAttackStyles.resolveStyleId) {
      return ArenaAttackStyles.resolveStyleId(def);
    }
    return "slash";
  }

  /** Синяя зона на макете: «манекен» атаки, нижняя inner-половина арены */
  const ATTACK_ZONE_ANCHOR = {
    head: { y: 0.58, xBias: 0.52 },
    chest: { y: 0.64, xBias: 0.50 },
    leftHand: { y: 0.70, xBias: 0.62 },
    rightHand: { y: 0.70, xBias: 0.78 },
    gloves: { y: 0.76, xBias: 0.52 },
    boots: { y: 0.82, xBias: 0.52 },
    ring1: { y: 0.74, xBias: 0.40 },
    ring2: { y: 0.74, xBias: 0.62 },
    amulet: { y: 0.66, xBias: 0.36 },
  };

  /** Боковая зона под HP — компактная раскладка слотов */
  const SIDE_ATTACK_ZONE_ANCHOR = {
    head: { y: 0.18, xBias: 0.5 },
    chest: { y: 0.32, xBias: 0.5 },
    leftHand: { y: 0.52, xBias: 0.28 },
    rightHand: { y: 0.52, xBias: 0.72 },
    gloves: { y: 0.68, xBias: 0.38 },
    boots: { y: 0.82, xBias: 0.5 },
    ring1: { y: 0.62, xBias: 0.18 },
    ring2: { y: 0.62, xBias: 0.82 },
    amulet: { y: 0.42, xBias: 0.5 },
  };

  const SLOT_ANCHOR = {
    head: { y: 0.14, xBias: 0.5 },
    chest: { y: 0.3, xBias: 0.5 },
    leftHand: { y: 0.46, xBias: 0.68 },
    rightHand: { y: 0.46, xBias: 0.82 },
    gloves: { y: 0.58, xBias: 0.5 },
    boots: { y: 0.76, xBias: 0.5 },
    ring1: { y: 0.64, xBias: 0.38 },
    ring2: { y: 0.64, xBias: 0.62 },
    amulet: { y: 0.38, xBias: 0.35 },
  };

  /** Три «синие» точки на планшете: верх / середина / над героем (доля battle-scene-ui). */
  const TABLET_WEAPON_LANES = {
    player: [
      { x: 0.20, y: 0.11 },
      { x: 0.27, y: 0.22 },
      { x: 0.34, y: 0.34 },
    ],
    enemy: [
      { x: 0.80, y: 0.11 },
      { x: 0.73, y: 0.22 },
      { x: 0.66, y: 0.34 },
    ],
  };

  /** @type {Map<string, object[]>} */
  const bodiesBySide = new Map();
  let rafId = null;
  let lastTs = 0;
  /** @type {object|null} */
  let activeBattle = null;
  let lastSyncAt = 0;
  let battleDurationEst = 60;
  let paused = false;

  function getLayerEl(side = null) {
    if (usesSideAttackZones()) {
      const id = side === "enemy" ? "enemy-arena-equip-layer" : "player-arena-equip-layer";
      return document.getElementById(id);
    }
    return document.getElementById("arena-equipment-layer");
  }

  function getSideArenaEl(side) {
    return document.getElementById(side === "enemy" ? "enemy-attack-arena" : "player-attack-arena");
  }

  function getArenaEl() {
    if (usesSideAttackZones()) return null;
    return document.getElementById("battle-thought-arena");
  }

  function getSideArenaSize(side) {
    const arena = usesSideAttackZones() ? getSideArenaEl(side) : getArenaEl();
    if (!arena) return { w: 0, h: 0 };
    return { w: arena.clientWidth, h: arena.clientHeight };
  }

  function hasAnyEquipLayer() {
    if (usesSideAttackZones()) {
      return !!(getLayerEl("player") && getLayerEl("enemy"));
    }
    return !!getLayerEl();
  }

  function viewportMin() {
    const vv = window.visualViewport;
    return Math.min(vv?.width ?? window.innerWidth, vv?.height ?? window.innerHeight);
  }

  function equipDiameterPx() {
    return viewportMin() * SIZE_RATIO;
  }

  function equipRadiusPx() {
    return equipDiameterPx() * 0.5;
  }

  function isArenaActive() {
    return document.documentElement.dataset.battleArenaLayout === "true";
  }

  function isBattlePaused() {
    return typeof isEmotionBattlePaused === "function"
      ? isEmotionBattlePaused()
      : !!(typeof battlePaused !== "undefined" && battlePaused);
  }

  function isWeaponDef(def) {
    if (!def) return false;
    if (def.tags?.includes("weapon")) return true;
    const slot = def.slot;
    return slot === "twoHand" || slot === "rightHand";
  }

  function easeOutCubic(t) {
    const u = 1 - t;
    return 1 - u * u * u;
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function estimateBattleDuration(battleState) {
    const maxDur = typeof MAX_BATTLE_DURATION !== "undefined" ? MAX_BATTLE_DURATION : 120;
    const elapsed = battleState.elapsed || 0;
    const playerHp = Math.max(1, battleState.player?.hp || 1);
    const enemyHp = Math.max(1, battleState.enemy?.hp || 1);
    const playerDps = battleState.commentary?.playerState?.metrics?.outgoingDps || 0;
    const enemyDps = battleState.commentary?.enemyState?.metrics?.outgoingDps || 0;

    if (playerDps < 0.4 && enemyDps < 0.4) {
      const pMax = battleState.player?.maxHp || 100;
      const eMax = battleState.enemy?.maxHp || 100;
      return Math.min(maxDur, Math.max(18, (pMax + eMax) / 14));
    }

    const toKillEnemy = enemyHp / Math.max(0.5, playerDps);
    const toKillPlayer = playerHp / Math.max(0.5, enemyDps);
    const remaining = Math.min(toKillEnemy, toKillPlayer);
    return Math.min(maxDur, Math.max(10, elapsed + remaining));
  }

  function computeBurstPlan(battleState) {
    const elapsed = battleState.elapsed || 0;
    const est = estimateBattleDuration(battleState);
    battleDurationEst = est;
    const totalBursts = Math.max(
      MIN_BURSTS,
      Math.min(MAX_BURSTS, Math.round(est / BURST_SPACING_SEC)),
    );
    const remaining = Math.max(4, est - elapsed);
    const interval = remaining / totalBursts;
    return { totalBursts, interval, est };
  }

  function zoneBounds(side, w, h, r) {
    const pad = r + 6;
    if (usesSideAttackZones()) {
      return { xMin: pad, xMax: w - pad, yMin: pad, yMax: h - pad };
    }
    const mid = w * 0.5;
    const gap = w * 0.04;
    if (side === "player") {
      return { xMin: pad, xMax: mid - gap, yMin: pad, yMax: h - pad };
    }
    return { xMin: mid + gap, xMax: w - pad, yMin: pad, yMax: h - pad };
  }

  function isFlankAttackLayout() {
    const root = document.documentElement;
    return root.dataset.battleHeroPlacement === "flank-arena"
      && root.dataset.battleArenaLayout === "true";
  }

  function usesSideAttackZones() {
    return isFlankAttackLayout();
  }

  function usesTabletWeaponLanes() {
    const root = document.documentElement;
    if (!usesSideAttackZones()) return false;
    if (root.dataset.prepLayout === "mobile") return false;
    if (root.dataset.tabletSideFit === "true") return true;
    if (root.dataset.tabletPrepHero === "true") return true;
    if (root.dataset.uiTier === "tablet") return true;
    return false;
  }

  function getSceneUiRect() {
    const el = document.getElementById("battle-scene-ui")
      || document.getElementById("prep-field-column");
    const rect = el?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return rect;
  }

  function getTabletWeaponHomeViewport(side, weaponIndex) {
    const rect = getSceneUiRect();
    if (!rect) return null;
    const lanes = TABLET_WEAPON_LANES[side];
    if (!lanes?.length) return null;
    const lane = lanes[weaponIndex % lanes.length];
    return {
      x: rect.left + rect.width * lane.x,
      y: rect.top + rect.height * lane.y,
    };
  }

  function mountTabletWeapon(body) {
    const fxLayer = ensureEquipFxLayer();
    if (body.el.parentElement !== fxLayer) fxLayer.appendChild(body.el);
    body.fxMounted = true;
    body.homeViewport = true;
    body.el.classList.add("arena-equip-body--tablet-lane");
  }

  function slotAnchorTable() {
    if (usesSideAttackZones()) return SIDE_ATTACK_ZONE_ANCHOR;
    return isFlankAttackLayout() ? ATTACK_ZONE_ANCHOR : SLOT_ANCHOR;
  }

  function homeForSlot(side, slotId, w, h, r) {
    const zone = zoneBounds(side, w, h, r);
    const anchor = slotAnchorTable()[slotId] || { y: 0.5, xBias: 0.5 };
    const zoneW = zone.xMax - zone.xMin;
    const zoneH = zone.yMax - zone.yMin;
    let xBias = anchor.xBias;
    if (side === "enemy") xBias = 1 - xBias;
    return {
      x: zone.xMin + zoneW * xBias,
      y: zone.yMin + zoneH * anchor.y,
    };
  }

  function homeForEntry(side, entry, weaponIndex, w, h, r) {
    return homeCoords(side, entry.slotId, isWeaponDef(entry.def), weaponIndex, w, h, r);
  }

  function homeCoords(side, slotId, isWeapon, weaponIndex, w, h, r) {
    if (isWeapon && usesTabletWeaponLanes()) {
      const vp = getTabletWeaponHomeViewport(side, weaponIndex);
      if (vp) return { x: vp.x, y: vp.y, viewport: true };
    }
    const local = homeForSlot(side, slotId, w, h, r);
    return { x: local.x, y: local.y, viewport: false };
  }

  function applyHomeToBody(body, home) {
    const wasViewport = !!body.homeViewport;
    body.homeViewport = !!home.viewport;
    body.homeX = home.x;
    body.homeY = home.y;
    if (!body.attack) {
      body.x = home.x;
      body.y = home.y;
      body.renderX = home.x;
      body.renderY = home.y;
    }
    if (body.homeViewport) {
      mountTabletWeapon(body);
    } else if (wasViewport && body.fxMounted) {
      const layer = getLayerEl(body.side);
      if (layer) layer.appendChild(body.el);
      body.fxMounted = false;
      body.el.classList.remove(
        "arena-equip-body--tablet-lane",
        "arena-equip-body--fx-flight",
      );
      body.el.style.position = "";
      body.el.style.left = "";
      body.el.style.top = "";
      body.el.style.zIndex = "";
    }
  }

  function localToViewport(layer, x, y) {
    const lr = layer?.getBoundingClientRect();
    if (!lr) return { x, y };
    return { x: lr.left + x, y: lr.top + y };
  }

  function foeStrikeTargetViewport(side) {
    const foe = side === "player" ? "enemy" : "player";
    const foeSlot = document.getElementById(foe === "player" ? "player-thought-slot" : "enemy-thought-slot");
    const sr = foeSlot?.getBoundingClientRect();
    if (!sr || sr.width <= 0) return null;
    const vmin = viewportMin();
    return {
      x: sr.left + sr.width / 2 + (Math.random() - 0.5) * vmin * 0.05,
      y: sr.top + sr.height / 2 + (Math.random() - 0.5) * vmin * 0.04,
    };
  }

  function foeStrikeTarget(body, w, h) {
    const side = body.side;
    const foe = side === "player" ? "enemy" : "player";
    const layer = getLayerEl(side);
    const foeSlot = document.getElementById(foe === "player" ? "player-thought-slot" : "enemy-thought-slot");

    if (usesSideAttackZones() && layer && foeSlot) {
      const lr = layer.getBoundingClientRect();
      const sr = foeSlot.getBoundingClientRect();
      if (lr.width > 0 && sr.width > 0) {
        const vmin = viewportMin();
        return {
          x: sr.left + sr.width / 2 - lr.left + (Math.random() - 0.5) * vmin * 0.05,
          y: sr.top + sr.height / 2 - lr.top + (Math.random() - 0.5) * vmin * 0.04,
        };
      }
    }

    if (typeof ThoughtArena !== "undefined" && ThoughtArena.getCompanionAnchorPx) {
      const pt = ThoughtArena.getCompanionAnchorPx(foe, w, h);
      const vmin = viewportMin();
      return {
        x: pt.x + (Math.random() - 0.5) * vmin * 0.05,
        y: pt.y + (Math.random() - 0.5) * vmin * 0.04,
      };
    }
    const r = equipRadiusPx();
    const zone = zoneBounds(foe, w, h, r);
    const cx = (zone.xMin + zone.xMax) * 0.5;
    const cy = (zone.yMin + zone.yMax) * 0.5;
    return {
      x: cx + (Math.random() - 0.5) * (zone.xMax - zone.xMin) * 0.35,
      y: cy + (Math.random() - 0.5) * (zone.yMax - zone.yMin) * 0.3,
    };
  }

  function ensureEquipFxLayer() {
    let layer = document.getElementById("arena-equip-fx-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "arena-equip-fx-layer";
      layer.className = "arena-equip-fx-layer";
      layer.setAttribute("aria-hidden", "true");
      if (typeof appendToLayerFx === "function") {
        appendToLayerFx(layer);
      } else {
        document.getElementById("layer-fx")?.appendChild(layer);
      }
    }
    return layer;
  }

  function mountAttackFx(body) {
    if (body.homeViewport) {
      body.el.classList.add("arena-equip-body--fx-flight");
      return true;
    }
    if (!usesSideAttackZones()) return false;
    const fxLayer = ensureEquipFxLayer();
    if (body.el.parentElement !== fxLayer) fxLayer.appendChild(body.el);
    body.fxMounted = true;
    body.el.classList.add("arena-equip-body--fx-flight");
    return true;
  }

  function unmountAttackFx(body) {
    if (!body.fxMounted) return;
    if (body.homeViewport) {
      body.el.classList.remove("arena-equip-body--fx-flight");
      body.el.style.zIndex = "";
      return;
    }
    const layer = getLayerEl(body.side);
    if (layer) layer.appendChild(body.el);
    body.fxMounted = false;
    body.el.classList.remove("arena-equip-body--fx-flight");
    body.el.style.position = "";
    body.el.style.left = "";
    body.el.style.top = "";
    body.el.style.zIndex = "";
  }

  function styleBodyEl(body) {
    const d = equipDiameterPx();
    body.el.style.width = `${d}px`;
    body.el.style.height = `${d}px`;
    body.el.style.fontSize = `${d * 0.62}px`;
    body.radius = equipRadiusPx();
  }

  function applyVisual(body) {
    const scale = body.displayScale ?? 1;
    const rot = body.rotation ?? 0;
    const x = body.renderX ?? body.x;
    const y = body.renderY ?? body.y;

    if (body.fxMounted) {
      body.el.style.position = "fixed";
      body.el.style.left = `${x}px`;
      body.el.style.top = `${y}px`;
      body.el.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`;
      body.el.style.opacity = String(body.opacity ?? 1);
      return;
    }

    body.el.style.position = "";
    body.el.style.left = "";
    body.el.style.top = "";
    body.el.style.transform = `translate(${x - body.radius}px, ${y - body.radius}px) scale(${scale}) rotate(${rot}deg)`;
    body.el.style.opacity = String(body.opacity ?? 1);
  }

  function createBody(side, entry, home, weaponIndex) {
    const layer = getLayerEl(side);
    if (!layer) return null;

    const el = document.createElement("div");
    el.className = "arena-equip-body";
    el.classList.add(`arena-equip-body--${side}`);
    if (usesSideAttackZones()) el.classList.add("arena-equip-body--hero-card");
    if (isWeaponDef(entry.def)) el.classList.add("arena-equip-body--weapon");
    el.dataset.attackStyle = resolveBodyAttackStyle(entry.def);
    el.textContent = entry.def.icon || "?";
    el.title = entry.def.name || "";
    layer.appendChild(el);

    const vmin = viewportMin();
    const body = {
      el,
      side,
      uid: entry.uid,
      itemId: entry.itemId,
      slotId: entry.slotId,
      isWeapon: isWeaponDef(entry.def),
      attackStyle: resolveBodyAttackStyle(entry.def),
      glyph: entry.def.icon,
      x: home.x,
      y: home.y,
      homeX: home.x,
      homeY: home.y,
      renderX: home.x,
      renderY: home.y,
      homeViewport: false,
      fxMounted: false,
      vx: 0,
      vy: 0,
      radius: equipRadiusPx(),
      rotation: (Math.random() - 0.5) * 12,
      rotVel: (Math.random() - 0.5) * 8,
      displayScale: 1,
      opacity: 1,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 0.7 + Math.random() * 0.5,
      wobbleSpeed: 0.9 + Math.random() * 0.6,
      attack: null,
      burstsTotal: 0,
      burstsDone: 0,
      burstInterval: 7,
      nextAttackAt: 0,
      weaponIndex,
    };
    styleBodyEl(body);
    applyHomeToBody(body, home);
    applyVisual(body);
    return body;
  }

  function getAllBodies() {
    const all = [];
    bodiesBySide.forEach((list) => all.push(...list));
    return all;
  }

  function clampToArena(body, w, h) {
    const r = body.radius;
    body.x = Math.max(r, Math.min(w - r, body.x));
    body.y = Math.max(r, Math.min(h - r, body.y));
  }

  function resolveCollisions(bodies, w, h) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.attack || b.attack) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist >= minDist) continue;
        if (dist < 0.001) dist = 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) * 0.5;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
      }
    }
    bodies.forEach((body) => {
      if (!body.attack) clampToArena(body, w, h);
    });
  }

  function startAttack(body, w, h, elapsed) {
    const layer = getLayerEl(body.side);
    let fromX = body.renderX ?? body.x;
    let fromY = body.renderY ?? body.y;
    let target = foeStrikeTarget(body, w, h);
    let useViewport = false;
    let homeVpX = fromX;
    let homeVpY = fromY;

    if (usesSideAttackZones() && layer) {
      const vpTarget = foeStrikeTargetViewport(body.side);
      if (vpTarget && mountAttackFx(body)) {
        if (body.homeViewport) {
          fromX = body.renderX ?? body.homeX;
          fromY = body.renderY ?? body.homeY;
          homeVpX = body.homeX;
          homeVpY = body.homeY;
        } else {
          const vpFrom = localToViewport(layer, fromX, fromY);
          const vpHome = localToViewport(layer, body.homeX, body.homeY);
          fromX = vpFrom.x;
          fromY = vpFrom.y;
          homeVpX = vpHome.x;
          homeVpY = vpHome.y;
        }
        target = vpTarget;
        useViewport = true;
      }
    }

    const hitsTotal = 2 + Math.floor(Math.random() * 3);
    const styleId = body.attackStyle || resolveBodyAttackStyle({ id: body.itemId });
    const atkBase = {
      fromX,
      fromY,
      targetX: target.x,
      targetY: target.y,
      strikeX: target.x,
      strikeY: target.y,
      useViewport,
      homeVpX,
      homeVpY,
      styleId,
    };

    if (typeof ArenaAttackStyles !== "undefined" && ArenaAttackStyles.createAttack) {
      body.attack = ArenaAttackStyles.createAttack(body, atkBase);
    } else {
      body.attack = {
        phase: "lunge",
        phaseT: 0,
        hitsTotal,
        hitsDone: 0,
        fromX,
        fromY,
        targetX: target.x,
        targetY: target.y,
        strikeX: target.x,
        strikeY: target.y,
        useViewport,
        homeVpX,
        homeVpY,
      };
    }
    body.el.classList.add("is-attacking");
    body.el.dataset.attackStyle = styleId;
    body.el.classList.add(`arena-equip-attack--${styleId}`);
    body.burstsDone += 1;
    body.nextAttackAt = elapsed + body.burstInterval * (0.85 + Math.random() * 0.3);
  }

  function stepAttack(body, dt) {
    const atk = body.attack;
    if (!atk) return;

    if (typeof ArenaAttackStyles !== "undefined" && ArenaAttackStyles.stepAttack && atk.styleId) {
      const vmin = viewportMin();
      const done = ArenaAttackStyles.stepAttack(body, atk, dt, vmin);
      if (done) {
        body.attack = null;
        body.el.classList.remove("is-attacking");
        body.el.classList.remove(`arena-equip-attack--${atk.styleId}`);
        unmountAttackFx(body);
      }
      return;
    }

    atk.phaseT += dt;
    const vmin = viewportMin();

    if (atk.phase === "lunge") {
      const t = easeOutCubic(Math.min(1, atk.phaseT / PHASE_DUR.lunge));
      body.renderX = atk.fromX + (atk.targetX - atk.fromX) * t;
      body.renderY = atk.fromY + (atk.targetY - atk.fromY) * t;
      body.displayScale = 1 + t * 0.12;
      body.rotation += dt * 120 * (body.side === "player" ? 1 : -1);
      if (atk.phaseT >= PHASE_DUR.lunge) {
        atk.phase = "hit";
        atk.phaseT = 0;
        atk.strikeX = body.renderX;
        atk.strikeY = body.renderY;
      }
    } else if (atk.phase === "hit") {
      const shake = Math.sin(atk.phaseT * 48) * vmin * 0.004;
      body.renderX = atk.strikeX + shake;
      body.renderY = atk.strikeY + Math.cos(atk.phaseT * 40) * vmin * 0.003;
      body.displayScale = 1.1 + Math.sin(atk.phaseT * 50) * 0.06;
      if (atk.phaseT >= PHASE_DUR.hit) {
        atk.hitsDone += 1;
        atk.phaseT = 0;
        if (atk.hitsDone >= atk.hitsTotal) {
          atk.phase = "return";
          atk.fromX = body.renderX;
          atk.fromY = body.renderY;
        }
      }
    } else if (atk.phase === "return") {
      const t = easeInOutQuad(Math.min(1, atk.phaseT / PHASE_DUR.return));
      const homeX = atk.useViewport ? atk.homeVpX : body.homeX;
      const homeY = atk.useViewport ? atk.homeVpY : body.homeY;
      body.renderX = atk.fromX + (homeX - atk.fromX) * t;
      body.renderY = atk.fromY + (homeY - atk.fromY) * t;
      body.displayScale = 1.1 - t * 0.1;
      body.rotation *= 1 - dt * 3;
      if (atk.phaseT >= PHASE_DUR.return) {
        body.x = body.homeX;
        body.y = body.homeY;
        body.renderX = body.homeX;
        body.renderY = body.homeY;
        body.displayScale = 1;
        body.attack = null;
        body.el.classList.remove("is-attacking");
        unmountAttackFx(body);
      }
    }
  }

  function stepIdle(body, dt) {
    const vmin = viewportMin();
    body.wobblePhase += dt * body.wobbleSpeed;

    const wobbleX = Math.sin(body.wobblePhase) * body.wobbleAmp * vmin * 0.0025;
    const wobbleY = Math.cos(body.wobblePhase * 0.85) * body.wobbleAmp * vmin * 0.002;

    const ax = (body.homeX - body.x) * SPRING_K;
    const ay = (body.homeY - body.y) * SPRING_K;
    body.vx = (body.vx + ax * dt) * AIR_DRAG;
    body.vy = (body.vy + ay * dt) * AIR_DRAG;
    body.x += body.vx * dt;
    body.y += body.vy * dt;

    body.renderX = body.x + wobbleX;
    body.renderY = body.y + wobbleY;
    body.rotation += body.rotVel * dt;
    body.rotVel *= Math.pow(0.92, dt * 60);

  }

  function stepPhysics(ts) {
    if (paused) return;
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > MAX_DT) dt = MAX_DT;
    if (dt <= 0) return;

    const elapsed = activeBattle?.elapsed || 0;
    const all = getAllBodies();
    if (!all.length) return;

    const sizeBySide = {
      player: getSideArenaSize("player"),
      enemy: getSideArenaSize("enemy"),
    };

    let anyActive = false;

    all.forEach((body) => {
      const { w, h } = sizeBySide[body.side] || { w: 0, h: 0 };
      if (body.homeViewport) {
        if (!getSceneUiRect()) return;
      } else if (w < 8 || h < 8) {
        return;
      }
      anyActive = true;

      if (body.isWeapon && !body.attack && body.burstsDone < body.burstsTotal && elapsed >= body.nextAttackAt) {
        startAttack(body, w, h, elapsed);
      }
      if (body.attack) {
        stepAttack(body, dt);
      } else {
        stepIdle(body, dt);
      }
      applyVisual(body);
    });

    ["player", "enemy"].forEach((side) => {
      const { w, h } = sizeBySide[side];
      if (w < 8 || h < 8) return;
      const idleBodies = (bodiesBySide.get(side) || []).filter((b) => !b.attack && !b.homeViewport);
      resolveCollisions(idleBodies, w, h);
      idleBodies.forEach(applyVisual);
    });

    if (anyActive) scheduleFrame();
  }

  function scheduleFrame() {
    if (rafId != null) return;
    rafId = requestAnimationFrame((ts) => {
      rafId = null;
      stepPhysics(ts);
    });
  }

  function syncSide(side, entries, battleState, elapsed, burstPlan) {
    const { w, h } = getSideArenaSize(side);
    const tabletWeapons = usesTabletWeaponLanes();
    const hasWeapon = entries.some((e) => isWeaponDef(e.def));
    if (w < 8 || h < 8) {
      if (!tabletWeapons || !hasWeapon || !getSceneUiRect()) return;
    }
    const r = equipRadiusPx();

    const existing = bodiesBySide.get(side) || [];
    const byUid = new Map(existing.map((b) => [b.uid, b]));
    const nextBodies = [];
    let weaponIndex = 0;

    entries.forEach((entry) => {
      const isWeapon = isWeaponDef(entry.def);
      const home = homeForEntry(side, entry, weaponIndex, w, h, r);
      let body = byUid.get(entry.uid);
      if (body) {
        body.slotId = entry.slotId;
        body.itemId = entry.itemId;
        body.isWeapon = isWeapon;
        body.attackStyle = resolveBodyAttackStyle(entry.def);
        if (body.glyph !== entry.def.icon) {
          body.glyph = entry.def.icon;
          body.el.textContent = entry.def.icon || "?";
        }
        body.el.classList.toggle("arena-equip-body--weapon", body.isWeapon);
        body.el.dataset.attackStyle = body.attackStyle;
        styleBodyEl(body);
        applyHomeToBody(body, home);
      } else {
        body = createBody(side, entry, home, weaponIndex);
      }
      if (!body) return;

      if (body.isWeapon) {
        body.burstsTotal = burstPlan.totalBursts;
        body.burstInterval = burstPlan.interval;
        if (body.nextAttackAt === 0) {
          body.nextAttackAt = elapsed + 1.1 + weaponIndex * 0.42 + Math.random() * 0.35;
        }
        weaponIndex += 1;
      }

      nextBodies.push(body);
      byUid.delete(entry.uid);
    });

    byUid.forEach((body) => body.el.remove());
    bodiesBySide.set(side, nextBodies);
  }

  function syncBattle(battleState, elapsed) {
    paused = isBattlePaused();

    if (!isArenaActive() || !battleState || battleState.finished) {
      clearAll();
      return;
    }

    if (!hasAnyEquipLayer()) return;

    if (activeBattle !== battleState) {
      clearAll();
      activeBattle = battleState;
      lastSyncAt = 0;
    }

    const now = Date.now();
    if (now - lastSyncAt < SYNC_INTERVAL_MS && bodiesBySide.size > 0) {
      if (!paused) scheduleFrame();
      return;
    }
    lastSyncAt = now;

    const burstPlan = computeBurstPlan(battleState);
    const listFn = typeof listDollEquippedItems === "function"
      ? listDollEquippedItems
      : () => [];

    ["player", "enemy"].forEach((side) => {
      const items = battleState[side]?.items || [];
      syncSide(side, listFn(items), battleState, elapsed, burstPlan);
    });

    if (getAllBodies().length) scheduleFrame();
  }

  function clearAll() {
    bodiesBySide.forEach((list) => {
      list.forEach((body) => {
        unmountAttackFx(body);
        body.el.remove();
      });
    });
    bodiesBySide.clear();
    activeBattle = null;
    lastSyncAt = 0;
    lastTs = 0;
    const fxLayer = document.getElementById("arena-equip-fx-layer");
    if (fxLayer) fxLayer.innerHTML = "";
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function onResize() {
    const r = equipRadiusPx();
    bodiesBySide.forEach((list, side) => {
      const { w, h } = getSideArenaSize(side);
      if (w < 8 || h < 8) return;
      let weaponIndex = 0;
      list.forEach((body) => {
        const home = homeCoords(side, body.slotId, body.isWeapon, weaponIndex, w, h, r);
        applyHomeToBody(body, home);
        if (body.isWeapon) weaponIndex += 1;
        styleBodyEl(body);
        applyVisual(body);
      });
    });
  }

  function observeResizeTargets() {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(onResize);
    const centerArena = document.getElementById("battle-thought-arena");
    if (centerArena) observer.observe(centerArena);
    ["player-attack-arena", "enemy-attack-arena", "battle-scene-ui"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }
  document.addEventListener("DOMContentLoaded", observeResizeTargets);
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);

  return {
    syncBattle,
    clearAll,
    estimateBattleDuration,
    onResize,
  };
})();
