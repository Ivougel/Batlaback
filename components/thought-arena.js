/**
 * ThoughtArena — общий контейнер боевых эмоджи (mobile + tablet battle).
 * Составные строки (⚔️🛡️) разбиваются на отдельные тела со своей физикой.
 */

const ThoughtArena = (() => {
  const SIZE_RATIO = 0.15;
  const CLUSTER_SIZE_RATIO = 0.12;
  const MAX_DT = 0.028;
  const CLUSTER_SPACING_RATIO = 0.58;
  const CLUSTER_MAX_SPREAD_RATIO = 1.35;
  /** Доля диаметра тела, занимаемая глифом (без legacy-усадки 0.72). */
  const THOUGHT_GLYPH_FONT_RATIO = 0.90;
  /** Глобальный множитель амплитуды тряски/дрожи эмодзи-мыслей (1 = эталон). */
  const THOUGHT_SHAKE_DYNAMICS = 0.58;
  const GLYPH_DANCE_STAGGER_S = 0.58;
  const DANCE_TIME_SCALE = 0.72;

  /** Параметры «мысленного пузыря» — мягкая пружина, критическое демпфирование, левитация. */
  const PHYS = {
    anchored: {
      springK: 10.5,
      dampC: 8.6,
      buoyancy: 10,
      gravity: 9,
      turbAmp: 0.16,
      turbFreqScale: 0.26,
      wallRest: 0.18,
      wallFric: 0.92,
      angSpring: 3.2,
      angDamp: 6.8,
      subSteps: 3,
      renderSmooth: 22,
      rotRenderSmooth: 18,
      scaleSmooth: 2.4,
    },
    arena: {
      restitution: 0.56,
      wallFriction: 0.88,
      airLinear: 2.4,
      airQuad: 0.0016,
      gravity: 34,
      buoyancy: 26,
      clusterSpring: 14,
      clusterDamp: 2.8,
      spawnSpeedMin: 0.028,
      spawnSpeedMax: 0.052,
      subSteps: 3,
    },
  };

  /** Legacy: центр арены (боевой пол — красные точки на макете) */
  const COMPANION_ANCHOR_NORM = {
    player: { x: 0.20, y: 0.58 },
    enemy: { x: 0.80, y: 0.58 },
  };

  /** Компактнее, когда эмодзи сидит на портрете */
  const HERO_CARD_SIZE_RATIO = 0.055;
  const HERO_CARD_CLUSTER_SIZE_RATIO = 0.048;
  const CLUSTER_ROOT_CLASS = "battle-thought-cluster";
  const GLYPH_MOUNT_CLASS = "battle-thought-glyph-mount";

  /** @type {Map<string, { eventKey: string, members: object[] }>} */
  const clusters = new Map();
  /** @type {Record<string, object[]>} */
  const equipReactions = { player: [], enemy: [] };
  let rafId = null;
  let thoughtWaitTimer = null;
  let lastTs = 0;
  let lastThoughtStepAt = 0;

  function thoughtStepGapMs() {
    if (typeof BattleFxTier !== "undefined") return BattleFxTier.thoughtStepGapMs();
    return isAnchoredFlankArena() ? 40 : 0;
  }

  function prefersReducedThoughtMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }

  function thoughtPhysicsProfile() {
    const light = typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx();
    const flank = isAnchoredFlankArena();
    const anchored = { ...PHYS.anchored };
    const arena = { ...PHYS.arena };
    if (light || flank) {
      anchored.subSteps = Math.min(anchored.subSteps, 2);
      anchored.renderSmooth = 20;
      anchored.rotRenderSmooth = 16;
      anchored.springK *= 0.95;
      anchored.dampC *= 1.08;
      arena.subSteps = 2;
    }
    if (prefersReducedThoughtMotion()) {
      anchored.turbAmp = 0;
      anchored.springK *= 1.35;
      anchored.dampC *= 1.5;
      arena.turbAmp = 0;
    }
    return { anchored, arena };
  }

  function resolveDanceStyle(animation) {
    const key = String(animation || "wobble").toLowerCase();
    if (key === "shake") return "wobble";
    return key;
  }

  /** Плавные «танцы» мыслей — низкая частота, без резких рывков. */
  const THOUGHT_DANCE = {
    nod: (t, phase) => ({
      ox: 0,
      oy: Math.sin(t * 1.35 + phase) * 2.4,
      rot: Math.sin(t * 0.75 + phase) * 1.8,
      scale: 1,
    }),
    wobble: (t, phase) => ({
      ox: Math.sin(t * 1.15 + phase * 1.2) * 2.0,
      oy: Math.cos(t * 0.95 + phase * 0.9) * 1.6,
      rot: Math.sin(t * 1.05 + phase) * 3.2,
      scale: 1,
    }),
    bounce: (t, phase) => {
      const s = Math.sin(t * 1.55 + phase * 0.75);
      return {
        ox: Math.sin(t * 0.7 + phase) * 0.9,
        oy: -Math.abs(s) * 3.2,
        rot: s * 1.6,
        scale: 1 + Math.max(0, s) * 0.04,
      };
    },
    grow: (t, phase) => ({
      ox: 0,
      oy: Math.sin(t * 0.85 + phase) * 1.1,
      rot: 0,
      scale: 1 + Math.max(0, Math.sin(t * 1.15 + phase * 0.55)) * 0.08,
    }),
    fly: (t, phase) => ({
      ox: Math.sin(t * 0.8 + phase * 1.1) * 2.8,
      oy: -Math.abs(Math.sin(t * 1.05 + phase)) * 2.4,
      rot: Math.sin(t * 0.9 + phase) * 3.8,
      scale: 1 + Math.sin(t * 1.25 + phase) * 0.025,
    }),
    dance: (t, phase) => ({
      ox: Math.sin(t * 0.75 + phase * 1.45) * 3.0,
      oy: Math.cos(t * 0.68 + phase * 0.85) * 2.2,
      rot: Math.sin(t * 0.62 + phase * 1.15) * 4.8,
      scale: 1 + Math.sin(t * 0.95 + phase) * 0.03,
    }),
    particles: (t, phase) => ({
      ox: Math.sin(t * 1.35 + phase) * 1.1,
      oy: Math.cos(t * 1.15 + phase) * 1.2,
      rot: Math.sin(t * 1.25 + phase) * 2.4,
      scale: 1 + Math.sin(t * 1.2 + phase) * 0.02,
    }),
  };

  function sampleThoughtDance(body) {
    const style = resolveDanceStyle(body.danceStyle);
    const fn = THOUGHT_DANCE[style] || THOUGHT_DANCE.wobble;
    const t = body.danceTime ?? 0;
    const phase = body.dancePhaseOffset ?? 0;
    const raw = fn(t, phase);
    const vmin = viewportMin();
    const amp = vmin * 0.00092 * THOUGHT_SHAKE_DYNAMICS;
    return {
      ox: (raw.ox ?? 0) * amp,
      oy: (raw.oy ?? 0) * amp,
      rot: raw.rot ?? 0,
      scaleMult: raw.scale ?? 1,
    };
  }

  function turbulenceForce(t, seed, amp, freqScale = 1) {
    if (amp <= 0) return { fx: 0, fy: 0 };
    const f = freqScale;
    return {
      fx: Math.sin(t * 1.65 * f + seed) * amp * 0.5 + Math.sin(t * 0.41 * f + seed * 2.3) * amp * 0.3,
      fy: Math.cos(t * 1.22 * f + seed * 1.4) * amp * 0.42 + Math.sin(t * 0.36 * f + seed * 0.8) * amp * 0.28,
    };
  }

  function expSmoothingAlpha(dt, rate) {
    return 1 - Math.exp(-Math.max(0, dt) * rate);
  }

  function applyAirDrag(body, dt, arenaPhys) {
    const mass = body.mass ?? 1;
    const v = Math.hypot(body.vx, body.vy);
    if (v < 0.5) {
      body.vx *= Math.max(0, 1 - dt * 3.5);
      body.vy *= Math.max(0, 1 - dt * 3.5);
      return;
    }
    const drag = (arenaPhys.airLinear * v + arenaPhys.airQuad * v * v) / mass;
    const scale = Math.max(0, 1 - drag * dt);
    body.vx *= scale;
    body.vy *= scale;
  }

  function resolveWallCollision(body, w, h, restitution, friction) {
    const r = body.radius;
    if (body.x - r < 0) {
      body.x = r;
      body.vx = Math.abs(body.vx) * restitution;
      body.vy *= friction;
    } else if (body.x + r > w) {
      body.x = w - r;
      body.vx = -Math.abs(body.vx) * restitution;
      body.vy *= friction;
    }
    if (body.y - r < 0) {
      body.y = r;
      body.vy = Math.abs(body.vy) * restitution;
      body.vx *= friction;
    } else if (body.y + r > h) {
      body.y = h - r;
      body.vy = -Math.abs(body.vy) * restitution;
      body.vx *= friction;
    }
  }

  function resolveBodyCollision(a, b, restitution) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;
    if (dist >= minDist) return;
    if (dist < 0.001) dist = 0.001;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = (minDist - dist) * 0.5;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;

    const m1 = a.mass ?? 1;
    const m2 = b.mass ?? 1;
    const relVelN = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (relVelN <= 0) return;
    const impulse = (-(1 + restitution) * relVelN) / (1 / m1 + 1 / m2);
    a.vx += (impulse / m1) * nx;
    a.vy += (impulse / m1) * ny;
    b.vx -= (impulse / m2) * nx;
    b.vy -= (impulse / m2) * ny;
  }

  function integrateAnchoredBody(body, homeX, homeY, w, h, dt, prof) {
    const mass = body.mass ?? 1;
    const dx = body.x - homeX;
    const dy = body.y - homeY;

    let ax = (-prof.springK * dx - prof.dampC * body.vx) / mass;
    let ay = (-prof.springK * dy - prof.dampC * body.vy) / mass;
    ay += (prof.buoyancy - prof.gravity) / mass;

    body.turbPhase = (body.turbPhase ?? 0) + dt;
    const turb = turbulenceForce(
      body.turbPhase,
      body.turbSeed ?? 0,
      prof.turbAmp * (body.wobbleAmp ?? 1),
      prof.turbFreqScale ?? 1,
    );
    ax += turb.fx / mass;
    ay += turb.fy / mass;

    body.vx += ax * dt;
    body.vy += ay * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;

    const angAcc = (-prof.angSpring * body.rotation - prof.angDamp * body.rotVel) / mass;
    body.rotVel += angAcc * dt;
    body.rotation += body.rotVel * dt;

    body.wobbleAmp = Math.max(0.18, (body.wobbleAmp ?? 1) * (1 - dt * 0.42));

    if ((body.glyphCount ?? 1) <= 1) {
      resolveWallCollision(body, w, h, prof.wallRest, prof.wallFric);
    }
  }

  function applyClusterCohesion(members, dt, maxSpread, arenaPhys) {
    if (members.length < 2) return;

    let cx = 0;
    let cy = 0;
    members.forEach((body) => {
      cx += body.x;
      cy += body.y;
    });
    cx /= members.length;
    cy /= members.length;

    const softR = maxSpread * 0.42;
    members.forEach((body) => {
      const dx = cx - body.x;
      const dy = cy - body.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.001) return;
      const mass = body.mass ?? 1;
      const beyond = Math.max(0, dist - softR);
      const pull = (beyond * arenaPhys.clusterSpring + dist * arenaPhys.clusterSpring * 0.12) / mass;
      body.vx += (dx / dist) * pull * dt;
      body.vy += (dy / dist) * pull * dt;
    });
  }

  function getArenaEl() {
    return document.getElementById("battle-thought-arena");
  }

  function getHeroMountEl(side) {
    if (isAnchoredFlankArena()) {
      return document.getElementById(side === "player" ? "player-thought-slot" : "enemy-thought-slot");
    }
    return getArenaEl();
  }

  function usesGlyphMountContainers(glyphCount) {
    if (glyphCount <= 1) return false;
    if (isStaticThoughts()) return false;
    return true;
  }

  /** На flank-arena один глиф в центре слота — без перестройки кластера при смене emoji. */
  function normalizeGlyphsForDisplay(glyphs, rawEmoji) {
    if (!glyphs.length) return glyphs;
    if (isAnchoredFlankArena() && glyphs.length > 1) {
      return [String(rawEmoji || glyphs.join("")).trim()];
    }
    if (isStaticThoughts() && isAnchoredFlankArena() && glyphs.length > 1) {
      return [String(rawEmoji || glyphs.join("")).trim()];
    }
    return glyphs;
  }

  function getClusterRootEl(side) {
    return getHeroMountEl(side)?.querySelector(`.${CLUSTER_ROOT_CLASS}`) ?? null;
  }

  function getBodyMountEl(body) {
    return body.mountEl || getHeroMountEl(body.side);
  }

  function clearClusterRootEl(side) {
    getClusterRootEl(side)?.remove();
  }

  function ensureClusterRoot(side, glyphCount) {
    const slot = getHeroMountEl(side);
    if (!slot || !usesGlyphMountContainers(glyphCount)) {
      clearClusterRootEl(side);
      return null;
    }
    let root = slot.querySelector(`.${CLUSTER_ROOT_CLASS}`);
    if (!root) {
      root = document.createElement("div");
      root.className = CLUSTER_ROOT_CLASS;
      root.dataset.team = side;
      slot.prepend(root);
    }
    root.dataset.glyphCount = String(glyphCount);
    return root;
  }

  function ensureGlyphMountEl(clusterRoot, side, index) {
    let mount = clusterRoot.querySelector(`.${GLYPH_MOUNT_CLASS}[data-glyph-index="${index}"]`);
    if (!mount) {
      mount = document.createElement("div");
      mount.className = GLYPH_MOUNT_CLASS;
      mount.dataset.team = side;
      mount.dataset.glyphIndex = String(index);
      clusterRoot.appendChild(mount);
    }
    const size = thoughtDiameterPx(1);
    const sizeKey = `${size}`;
    if (mount.dataset.sizeKey !== sizeKey) {
      mount.dataset.sizeKey = sizeKey;
      mount.style.width = `${size}px`;
      mount.style.height = `${size}px`;
    }
    return mount;
  }

  function layoutGlyphMounts(clusterRoot, glyphCount, anchored) {
    const emojiSize = thoughtDiameterPx(1);
    const spacing = clusterGlyphSpacingPx(glyphCount, anchored);
    const offsets = clusterOffsets(glyphCount, spacing, { horizontalOnly: anchored });
    const totalW = glyphCount <= 1
      ? emojiSize
      : Math.ceil(emojiSize + (glyphCount - 1) * spacing);

    const sig = [
      glyphCount,
      emojiSize,
      spacing,
      totalW,
      anchored ? 1 : 0,
      ...offsets.map((o) => `${Math.round(o.ox)}|${Math.round(o.oy)}`),
    ].join(":");
    if (clusterRoot.dataset.layoutSig === sig) return;
    clusterRoot.dataset.layoutSig = sig;

    clusterRoot.style.width = `${totalW}px`;
    clusterRoot.style.height = `${emojiSize}px`;

    [...clusterRoot.querySelectorAll(`.${GLYPH_MOUNT_CLASS}`)].forEach((mount, index) => {
      if (index >= glyphCount) {
        mount.remove();
        return;
      }
      const offset = offsets[index] || { ox: 0, oy: 0 };
      const cx = totalW / 2 + offset.ox;
      const cy = emojiSize / 2 + offset.oy;
      mount.style.left = `${Math.round(cx - emojiSize / 2)}px`;
      mount.style.top = `${Math.round(cy - emojiSize / 2)}px`;
    });
  }

  function isAnchoredFlankArena() {
    const root = document.documentElement;
    if (root.dataset.battleHeroPlacement !== "flank-arena") return false;
    if (root.dataset.battleArenaLayout === "true") return true;
    return root.dataset.battlePrepHeroLayer === "true";
  }

  function getCompanionAnchorNorm(side) {
    return COMPANION_ANCHOR_NORM[side] || COMPANION_ANCHOR_NORM.player;
  }

  /** Центр слота эмодзи в локальных координатах mount-контейнера */
  function getLocalAnchorPx(w, h) {
    return { x: w * 0.5, y: h * 0.5 };
  }

  /** Точка удара/цели в координатах #battle-thought-arena (для ArenaEquipment) */
  function getCompanionAnchorPx(side, w, h) {
    if (isAnchoredFlankArena()) {
      const slot = getHeroMountEl(side);
      const arena = getArenaEl();
      if (slot && arena) {
        const sr = slot.getBoundingClientRect();
        const ar = arena.getBoundingClientRect();
        if (sr.width > 0 && sr.height > 0) {
          return {
            x: sr.left + sr.width / 2 - ar.left,
            y: sr.top + sr.height / 2 - ar.top,
          };
        }
      }
    }
    const n = getCompanionAnchorNorm(side);
    return { x: w * n.x, y: h * n.y };
  }

  function viewportMin() {
    const vv = window.visualViewport;
    return Math.min(vv?.width ?? window.innerWidth, vv?.height ?? window.innerHeight);
  }

  function splitEmojiGlyphs(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];

    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
      return [...seg.segment(raw)]
        .map((part) => part.segment)
        .filter((g) => g && !/^\s+$/.test(g));
    }

    const re = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
    const matches = raw.match(re);
    if (matches?.length) return matches;
    return [...raw].filter((ch) => ch.trim());
  }

  function thoughtDiameterPx(glyphCount = 1) {
    const onHeroCard = isAnchoredFlankArena();
    if (onHeroCard && typeof BattleHeroAnchor !== "undefined") {
      const emojiSize = BattleHeroAnchor.thoughtSlotEmojiSize();
      return Math.round(emojiSize);
    }
    const ratio = glyphCount > 1
      ? (onHeroCard ? HERO_CARD_CLUSTER_SIZE_RATIO : CLUSTER_SIZE_RATIO)
      : (onHeroCard ? HERO_CARD_SIZE_RATIO : SIZE_RATIO);
    return viewportMin() * ratio;
  }

  function thoughtRadiusPx(glyphCount = 1) {
    return thoughtDiameterPx(glyphCount) * 0.5;
  }

  function clusterGlyphGapPx(glyphPx) {
    return Math.max(4, Math.round(glyphPx * 0.08));
  }

  /** Расстояние между центрами соседних глифов — не меньше ширины символа + зазор. */
  function clusterGlyphSpacingPx(glyphCount, anchored) {
    const glyphPx = Math.round(thoughtDiameterPx(1) * THOUGHT_GLYPH_FONT_RATIO);
    const gap = clusterGlyphGapPx(glyphPx);
    const sideBySide = glyphPx + gap;
    if (anchored) return sideBySide;
    const clusterDiameter = thoughtDiameterPx(glyphCount);
    return Math.max(sideBySide, clusterDiameter * CLUSTER_SPACING_RATIO);
  }

  function clusterOffsets(count, spacing, opts = {}) {
    const horizontalOnly = !!opts.horizontalOnly;
    if (count <= 1) return [{ ox: 0, oy: 0 }];
    const span = spacing * (count - 1);
    return Array.from({ length: count }, (_, i) => ({
      ox: -span * 0.5 + i * spacing,
      oy: horizontalOnly ? 0 : (Math.random() - 0.5) * spacing * 0.28,
    }));
  }

  function snapAnchoredClusterHome(cluster) {
    if (!cluster?.members?.length || !isAnchoredFlankArena()) return;
    cluster.members.forEach((body) => {
      const mount = getBodyMountEl(body);
      if (!mount) return;
      const mw = mount.clientWidth || thoughtDiameterPx(1);
      const mh = mount.clientHeight || thoughtDiameterPx(1);
      const anchor = getLocalAnchorPx(mw, mh);
      body.offsetOx = 0;
      body.offsetOy = 0;
      body.homeX = anchor.x;
      body.homeY = anchor.y;
      body.x = anchor.x;
      body.y = anchor.y;
      body.renderX = anchor.x;
      body.renderY = anchor.y;
      body.vx = 0;
      body.vy = 0;
      body.rotVel = 0;
      body.wobbleAmp = 0.16;
    });
  }

  function refreshClusterMemberOffsets(cluster) {
    const glyphCount = cluster.members[0]?.clusterGlyphCount
      ?? cluster.members[0]?.glyphCount
      ?? cluster.members.length;
    const anchored = isAnchoredFlankArena();
    if (usesGlyphMountContainers(glyphCount)) {
      const side = cluster.members[0]?.side;
      const root = getClusterRootEl(side) || ensureClusterRoot(side, glyphCount);
      if (root) layoutGlyphMounts(root, glyphCount, anchored);
      cluster.members.forEach((body) => {
        body.offsetOx = 0;
        body.offsetOy = 0;
      });
      return;
    }
    const spacing = clusterGlyphSpacingPx(glyphCount, anchored);
    const offsets = clusterOffsets(glyphCount, spacing, { horizontalOnly: anchored });
    cluster.members.forEach((body, index) => {
      const offset = offsets[index] || { ox: 0, oy: 0 };
      body.offsetOx = offset.ox;
      body.offsetOy = offset.oy;
    });
  }

  function spawnPosition(w, h, r, side) {
    if (isAnchoredFlankArena()) {
      return getLocalAnchorPx(w, h);
    }
    const pad = r + 4;
    const usableH = Math.max(1, h - pad * 2);
    if (side === "player") {
      const usableW = Math.max(1, w * 0.5 - pad * 2);
      return {
        x: pad + Math.random() * usableW,
        y: pad + Math.random() * usableH,
      };
    }
    const usableW = Math.max(1, w * 0.5 - pad * 2);
    return {
      x: w * 0.5 + pad + Math.random() * usableW,
      y: pad + Math.random() * usableH,
    };
  }

  function randomVelocity(arenaPhys) {
    const vmin = viewportMin();
    const speed = vmin * (
      arenaPhys.spawnSpeedMin
      + Math.random() * (arenaPhys.spawnSpeedMax - arenaPhys.spawnSpeedMin)
    );
    const angle = Math.random() * Math.PI * 2;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.85,
    };
  }

  function getAllBodies() {
    const all = [];
    clusters.forEach((cluster) => {
      all.push(...cluster.members);
    });
    return all;
  }

  function removeCluster(side, immediate = false) {
    const cluster = clusters.get(side);
    if (!cluster) return;
    cluster.members.forEach((body) => {
      if (immediate) body.el.remove();
    });
    if (immediate) clearClusterRootEl(side);
    clusters.delete(side);
  }

  function clampBodyToArena(body, w, h) {
    const r = body.radius;
    body.x = Math.max(r, Math.min(w - r, body.x));
    body.y = Math.max(r, Math.min(h - r, body.y));
  }

  function isBattlePausedNow() {
    return typeof isBattlePaused === "function" ? isBattlePaused() : !!window.battlePaused;
  }

  function usesThoughtDuelMirror() {
    return document.documentElement.dataset.thoughtDuelCenter === "true";
  }

  function applyVisual(body) {
    const speed = Math.hypot(body.vx ?? 0, body.vy ?? 0);
    const stretch = Math.min(0.008, speed * 0.0004);
    const squash = 1 + stretch * Math.sin((body.turbPhase ?? 0) * 1.6);
    const useCssIdleDance = isAnchoredFlankArena() && !isStaticThoughts() && isAnchoredBodySettled(body);
    body.el.classList.toggle("battle-thought-body--css-dance", useCssIdleDance);
    const dance = useCssIdleDance
      ? { ox: 0, oy: 0, rot: 0, scaleMult: 1 }
      : (isAnchoredFlankArena() ? sampleThoughtDance(body) : { ox: 0, oy: 0, rot: 0, scaleMult: 1 });
    const scale = body.displayScale * squash * (body.reactScale ?? 1) * dance.scaleMult;
    const mirrorX = body.mirrorX ? -1 : 1;
    const x = (body.renderX ?? body.x) + (body.reactOx ?? 0) + dance.ox;
    const y = (body.renderY ?? body.y) + (body.reactOy ?? 0) + dance.oy;
    const rot = (body.renderRot ?? body.rotation ?? 0) + (body.reactRot ?? 0) + dance.rot;

    if (useCssIdleDance) {
      const posKey = `${x.toFixed(1)}|${y.toFixed(1)}|${scale.toFixed(3)}|${mirrorX}`;
      if (body._lastPos !== posKey) {
        body._lastPos = posKey;
        body.el.style.left = `${x}px`;
        body.el.style.top = `${y}px`;
        body.el.style.setProperty("--thought-idle-scale", String(mirrorX * scale));
      }
      if (body._lastTransform !== "") {
        body._lastTransform = "";
        body.el.style.removeProperty("transform");
      }
    } else {
      body._lastPos = null;
      const transform = [
        `translate3d(${x}px, ${y}px, 0)`,
        `translate(-50%, -50%)`,
        `rotate(${rot}deg)`,
        `scale(${mirrorX * scale}, ${scale})`,
      ].join(" ");
      if (body._lastTransform !== transform) {
        body._lastTransform = transform;
        body.el.style.transform = transform;
      }
    }
    const opacity = String(body.opacity);
    if (body._lastOpacity !== opacity) {
      body._lastOpacity = opacity;
      body.el.style.opacity = opacity;
    }
    const filter = body.reactFilter || "";
    if (body._lastFilter !== filter) {
      body._lastFilter = filter;
      body.el.style.filter = filter;
    }
  }

  function isStaticThoughts() {
    return typeof BattleFxTier !== "undefined" && BattleFxTier.isStaticBattleThoughts?.();
  }

  function triggerEquipHitReaction(side, spec) {
    if (isStaticThoughts()) return;
    if (typeof BattleFxTier !== "undefined" && BattleFxTier.equipThoughtReactionsEnabled
      && !BattleFxTier.equipThoughtReactionsEnabled()) return;
    if (!clusters.has(side) || !spec) return;
    equipReactions[side].push({
      kind: spec.kind || "shake",
      intensity: (spec.intensity ?? 1) * 0.72,
      duration: spec.duration ?? 0.48,
      fromSide: spec.fromSide,
      styleId: spec.styleId,
      t: 0,
    });
    scheduleFrame();
  }

  function scaleThoughtReaction(sample) {
    if (!sample || THOUGHT_SHAKE_DYNAMICS === 1) return sample;
    const s = THOUGHT_SHAKE_DYNAMICS;
    const out = { ...sample };
    if (sample.ox) out.ox = sample.ox * s;
    if (sample.oy) out.oy = sample.oy * s;
    if (sample.rot) out.rot = sample.rot * s;
    if (sample.scale != null) out.scale = 1 + (sample.scale - 1) * s;
    return out;
  }

  function sampleEquipReaction(spec, p, vmin) {
    const k = spec.kind;
    const i = spec.intensity;
    const wave = Math.sin(p * Math.PI * 6);
    const dir = spec.fromSide === "player" ? 1 : -1;

    switch (k) {
      case "flinch":
        return {
          ox: dir * vmin * 0.018 * i * (1 - p),
          oy: vmin * 0.006 * i * p,
          scale: 1 - p * 0.14 * i,
          rot: -dir * 8 * i * (1 - p),
        };
      case "duck":
        return {
          ox: 0,
          oy: vmin * 0.022 * i * Math.sin(p * Math.PI),
          scale: 1 - 0.12 * i * Math.sin(p * Math.PI),
          rot: dir * 6 * i * (1 - p),
        };
      case "squash":
        return {
          ox: dir * vmin * 0.01 * wave * (1 - p),
          oy: vmin * 0.008 * i * (1 - p),
          scale: 1 - 0.18 * i * Math.sin(p * Math.PI),
          rot: wave * 4 * i,
        };
      case "stagger":
        return {
          ox: dir * vmin * 0.025 * i * Math.sin(p * Math.PI * 3),
          oy: vmin * 0.012 * i * Math.cos(p * Math.PI * 2),
          scale: 1 - 0.08 * i * Math.sin(p * Math.PI),
          rot: wave * 10 * i,
        };
      case "spin":
        return {
          ox: 0,
          oy: 0,
          scale: 1 + 0.1 * i * Math.sin(p * Math.PI),
          rot: p * 220 * i * dir,
        };
      case "burn":
        return {
          ox: wave * vmin * 0.004,
          oy: -vmin * 0.006 * i * Math.sin(p * Math.PI),
          scale: 1 + 0.12 * i * Math.sin(p * Math.PI),
          rot: wave * 5,
          filter: `drop-shadow(0 0 ${8 + p * 14}px rgba(255,120,40,${0.35 + (1 - p) * 0.4}))`,
        };
      case "freeze":
        return {
          ox: wave * vmin * 0.002,
          oy: 0,
          scale: 1 - 0.1 * i * Math.min(1, p * 1.4),
          rot: wave * 2,
          filter: `drop-shadow(0 0 ${10}px rgba(120,200,255,${0.25 + (1 - p) * 0.35}))`,
        };
      case "poison":
        return {
          ox: Math.sin(p * Math.PI * 5) * vmin * 0.005 * i,
          oy: vmin * 0.008 * i * Math.sin(p * Math.PI * 2),
          scale: 1 + 0.06 * i * wave,
          rot: wave * 6,
          filter: `drop-shadow(0 0 ${8}px rgba(80,220,90,${0.2 + (1 - p) * 0.3}))`,
        };
      case "dazzle":
        return {
          ox: 0,
          oy: -vmin * 0.01 * i * Math.sin(p * Math.PI),
          scale: 1 + 0.2 * i * Math.sin(p * Math.PI),
          rot: 0,
          filter: `drop-shadow(0 0 ${16 + p * 20}px rgba(255,255,220,${0.45 * (1 - p)})) brightness(${1 + 0.35 * (1 - p)})`,
        };
      case "drain":
        return {
          ox: -dir * vmin * 0.02 * i * Math.sin(p * Math.PI),
          oy: vmin * 0.004 * i * (1 - p),
          scale: 1 - 0.15 * i * Math.sin(p * Math.PI),
          rot: -dir * p * 30 * i,
          filter: `drop-shadow(0 0 ${10}px rgba(180,60,220,${0.25 + (1 - p) * 0.25}))`,
        };
      case "impale":
        return {
          ox: -dir * vmin * 0.03 * i * Math.min(1, p * 2),
          oy: 0,
          scale: 1 - 0.1 * i * Math.min(1, p * 1.5),
          rot: dir * 12 * i * (1 - p),
        };
      case "ripple":
        return {
          ox: wave * vmin * 0.008 * i,
          oy: Math.cos(p * Math.PI * 4) * vmin * 0.006 * i,
          scale: 1 + 0.14 * i * Math.sin(p * Math.PI),
          rot: wave * 8,
        };
      case "spark":
        return {
          ox: wave * vmin * 0.01 * i,
          oy: -wave * vmin * 0.008 * i,
          scale: 1 + 0.08 * i * Math.sin(p * Math.PI * 2),
          rot: p * 160 * dir * i,
          filter: `drop-shadow(0 0 ${12}px rgba(120,180,255,${0.35 * (1 - p)}))`,
        };
      case "stun":
        return {
          ox: wave * vmin * 0.012 * i,
          oy: Math.sin(p * Math.PI * 8) * vmin * 0.008 * i,
          scale: 1 + 0.1 * i * Math.sin(p * Math.PI * 3),
          rot: p * 300 * dir * i,
          filter: `drop-shadow(0 0 ${10}px rgba(255,220,80,${0.3 * (1 - p)}))`,
        };
      case "flicker":
        return {
          ox: (Math.random() - 0.5) * vmin * 0.012 * i * (1 - p),
          oy: (Math.random() - 0.5) * vmin * 0.01 * i * (1 - p),
          scale: 1 - 0.06 * i * Math.random(),
          rot: (Math.random() - 0.5) * 20 * i,
          filter: `drop-shadow(0 0 ${8}px rgba(60,40,90,${0.35 * (1 - p)}))`,
        };
      case "shake":
      default:
        return {
          ox: wave * vmin * 0.01 * i,
          oy: Math.cos(p * Math.PI * 5) * vmin * 0.006 * i,
          scale: 1 + 0.05 * i * Math.sin(p * Math.PI),
          rot: wave * 7 * i,
        };
    }
  }

  function stepEquipReactions(list, dt) {
    const vmin = viewportMin();
    ["player", "enemy"].forEach((side) => {
      equipReactions[side] = equipReactions[side].filter((spec) => {
        spec.t += dt;
        return spec.t < spec.duration;
      });
    });

    if (!equipReactions.player.length && !equipReactions.enemy.length) {
      list.forEach((body) => {
        body.reactOx = 0;
        body.reactOy = 0;
        body.reactScale = 1;
        body.reactRot = 0;
        body.reactFilter = "";
      });
      return;
    }

    list.forEach((body) => {
      const reactions = equipReactions[body.side] || [];
      let ox = 0;
      let oy = 0;
      let scale = 1;
      let rot = 0;
      let filter = "";

      reactions.forEach((spec) => {
        const p = Math.min(1, spec.t / spec.duration);
        const sample = scaleThoughtReaction(sampleEquipReaction(spec, p, vmin));
        ox += sample.ox || 0;
        oy += sample.oy || 0;
        scale *= sample.scale ?? 1;
        rot += sample.rot || 0;
        if (sample.filter) filter = sample.filter;
      });

      body.reactOx = ox;
      body.reactOy = oy;
      body.reactScale = scale;
      body.reactRot = rot;
      body.reactFilter = filter;
    });
  }

  function pruneFadedBodies() {
    clusters.forEach((cluster, side) => {
      cluster.members = cluster.members.filter((body) => {
        if (!body.fadeOut || body.opacity > 0.02) return true;
        body.el.remove();
        return false;
      });
      if (cluster.members.length === 0) {
        clearClusterRootEl(side);
        clusters.delete(side);
      }
    });
  }

  function stepAnchoredSpring(list, dt, prof) {
    const mountSizeCache = new Map();
    const readMountSize = (mount) => {
      if (!mount) return null;
      let cached = mountSizeCache.get(mount);
      if (!cached) {
        cached = { w: mount.clientWidth, h: mount.clientHeight };
        mountSizeCache.set(mount, cached);
      }
      return cached;
    };

    const subDt = dt / Math.max(1, prof.subSteps);
    for (let step = 0; step < prof.subSteps; step += 1) {
      list.forEach((body) => {
        const mount = getBodyMountEl(body);
        if (!mount) return;
        const size = readMountSize(mount);
        if (!size || size.w <= 0 || size.h <= 0) return;
        const { w, h } = size;

        const anchor = getLocalAnchorPx(w, h);
        body.homeX = anchor.x + (body.offsetOx || 0);
        body.homeY = anchor.y + (body.offsetOy || 0);

        if (prefersReducedThoughtMotion()) {
          body.x = body.homeX;
          body.y = body.homeY;
          body.vx = 0;
          body.vy = 0;
          body.rotation = 0;
          body.rotVel = 0;
        } else {
          integrateAnchoredBody(body, body.homeX, body.homeY, w, h, subDt, prof);
        }
      });
    }

    const posAlpha = expSmoothingAlpha(dt, prof.renderSmooth ?? 18);
    const rotAlpha = expSmoothingAlpha(dt, prof.rotRenderSmooth ?? 14);
    list.forEach((body) => {
      const rx = body.renderX ?? body.x;
      const ry = body.renderY ?? body.y;
      body.renderX = rx + (body.x - rx) * posAlpha;
      body.renderY = ry + (body.y - ry) * posAlpha;
      const rr = body.renderRot ?? body.rotation ?? 0;
      body.renderRot = rr + ((body.rotation ?? 0) - rr) * rotAlpha;
    });
  }

  function stepArenaPhysics(list, w, h, dt, arenaPhys) {
    const subDt = dt / Math.max(1, arenaPhys.subSteps);
    for (let step = 0; step < arenaPhys.subSteps; step += 1) {
      list.forEach((body) => {
        const mass = body.mass ?? 1;
        body.vy += (arenaPhys.gravity - arenaPhys.buoyancy) / mass * subDt;
        applyAirDrag(body, subDt, arenaPhys);
        body.x += body.vx * subDt;
        body.y += body.vy * subDt;
        body.rotation += body.rotVel * subDt;
        resolveWallCollision(body, w, h, arenaPhys.restitution, arenaPhys.wallFriction);
        clampBodyToArena(body, w, h);
      });

      const alive = getAllBodies();
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          resolveBodyCollision(alive[i], alive[j], arenaPhys.restitution);
        }
      }

      clusters.forEach((cluster) => {
        const glyphCount = cluster.members[0]?.clusterGlyphCount
          || cluster.members[0]?.glyphCount
          || cluster.members.length;
        const spacing = clusterGlyphSpacingPx(glyphCount, false);
        const layoutSpan = spacing * Math.max(1, glyphCount - 1);
        const maxSpread = Math.max(
          thoughtDiameterPx(glyphCount) * CLUSTER_MAX_SPREAD_RATIO,
          layoutSpan * 0.58,
        );
        applyClusterCohesion(cluster.members, subDt, maxSpread, arenaPhys);
      });
    }

    list.forEach((body) => {
      body.renderX = body.renderX ?? body.x;
      body.renderY = body.renderY ?? body.y;
      const smooth = Math.min(1, dt * 12);
      body.renderX += (body.x - body.renderX) * smooth;
      body.renderY += (body.y - body.renderY) * smooth;
    });
  }

  function smoothAnchoredRender(list, dt, prof) {
    const posAlpha = expSmoothingAlpha(dt, prof.renderSmooth ?? 22);
    const rotAlpha = expSmoothingAlpha(dt, prof.rotRenderSmooth ?? 18);
    list.forEach((body) => {
      const rx = body.renderX ?? body.x;
      const ry = body.renderY ?? body.y;
      body.renderX = rx + (body.x - rx) * posAlpha;
      body.renderY = ry + (body.y - ry) * posAlpha;
      const rr = body.renderRot ?? body.rotation ?? 0;
      body.renderRot = rr + ((body.rotation ?? 0) - rr) * rotAlpha;
    });
  }

  function advanceThoughtPresentation(list, dt, anchoredProf) {
    list.forEach((body) => {
      body.danceTime = (body.danceTime ?? 0) + dt * DANCE_TIME_SCALE;
      const targetR = thoughtRadiusPx(body.glyphCount);
      body.radius += (targetR - body.radius) * Math.min(1, dt * 4);
      body.displayScale += (body.targetScale - body.displayScale) * Math.min(1, dt * (anchoredProf.scaleSmooth ?? 2.4));
      if (body.fadeOut) {
        body.opacity = Math.max(0, body.opacity - dt * 4.5);
      }
    });
  }

  function isAnchoredBodySettled(body) {
    if (!isAnchoredFlankArena()) return false;
    return Math.hypot(body.vx ?? 0, body.vy ?? 0) < 0.12
      && Math.abs(body.rotVel ?? 0) < 0.2
      && Math.abs((body.renderX ?? body.x) - body.x) < 0.2
      && Math.abs((body.renderY ?? body.y) - body.y) < 0.2
      && Math.abs((body.displayScale ?? 1) - (body.targetScale ?? 1)) < 0.025
      && (body.opacity ?? 1) >= 0.97
      && !body.fadeOut
      && !body.reactOx && !body.reactOy && !body.reactRot && !body.reactFilter;
  }

  function thoughtsNeedMotionStep(list) {
    if (equipReactions.player.length || equipReactions.enemy.length) return true;
    for (const body of list) {
      if (isAnchoredBodySettled(body)) continue;
      if (body.fadeOut) return true;
      if (Math.abs((body.displayScale ?? 1) - (body.targetScale ?? 1)) > 0.025) return true;
      if ((body.opacity ?? 1) < 0.97) return true;
      if (Math.hypot(body.vx ?? 0, body.vy ?? 0) > 0.35) return true;
      if (Math.abs(body.rotVel ?? 0) > 0.6) return true;
      if (Math.abs((body.renderX ?? body.x) - body.x) > 0.35) return true;
      if (Math.abs((body.renderY ?? body.y) - body.y) > 0.35) return true;
      if (body.reactOx || body.reactOy || body.reactRot || body.reactFilter) return true;
    }
    return false;
  }

  function step(ts) {
    rafId = null;
    if (clusters.size === 0) {
      lastTs = 0;
      return;
    }

    if (isBattlePausedNow()) {
      lastTs = 0;
      scheduleThoughtWait(120);
      return;
    }

    if (!lastTs) lastTs = ts;
    let dt = Math.min(MAX_DT, (ts - lastTs) / 1000);
    lastTs = ts;
    if (dt <= 0) dt = 1 / 60;

    const list = getAllBodies();
    const anchored = isAnchoredFlankArena();
    const { anchored: anchoredProf, arena: arenaPhys } = thoughtPhysicsProfile();

    advanceThoughtPresentation(list, dt, anchoredProf);

    const gap = thoughtStepGapMs();
    const now = performance.now();
    const runPhysics = gap <= 0 || now - lastThoughtStepAt >= gap;
    if (runPhysics) {
      if (gap > 0) lastThoughtStepAt = now;

      if (anchored) {
        stepAnchoredSpring(list, dt, anchoredProf);
      } else {
        const arena = getArenaEl();
        if (!arena) {
          lastTs = 0;
          return;
        }
        const w = arena.clientWidth;
        const h = arena.clientHeight;
        if (w <= 0 || h <= 0) {
          scheduleFrame();
          return;
        }
        stepArenaPhysics(list, w, h, dt, arenaPhys);
        pruneFadedBodies();
      }
      pruneFadedBodies();
    } else if (anchored) {
      smoothAnchoredRender(list, dt, anchoredProf);
    }

    stepEquipReactions(list, dt);
    getAllBodies().forEach(applyVisual);

    if (thoughtsNeedMotionStep(list)) {
      scheduleFrame();
    } else {
      lastTs = 0;
    }
  }

  function cancelThoughtScheduler() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (thoughtWaitTimer != null) {
      clearTimeout(thoughtWaitTimer);
      thoughtWaitTimer = null;
    }
  }

  function scheduleThoughtWait(ms) {
    if (typeof PresentationClock !== "undefined" && PresentationClock.shouldOwnLoop?.("thought")) {
      if (rafId != null || thoughtWaitTimer != null) return;
      thoughtWaitTimer = setTimeout(() => {
        thoughtWaitTimer = null;
        PresentationClock.wake("thought");
      }, Math.max(1, Math.round(ms)));
      return;
    }
    if (rafId != null || thoughtWaitTimer != null) return;
    thoughtWaitTimer = setTimeout(() => {
      thoughtWaitTimer = null;
      scheduleFrame();
    }, Math.max(1, Math.round(ms)));
  }

  function scheduleFrame() {
    if (typeof PresentationClock !== "undefined" && PresentationClock.shouldOwnLoop?.("thought")) {
      PresentationClock.wake("thought");
      return;
    }
    if (rafId != null || thoughtWaitTimer != null) return;
    rafId = requestAnimationFrame(step);
  }

  /** Вызывается из PresentationClock вместо автономного rAF. */
  function tickFromClock(ts) {
    step(ts ?? performance.now());
    const list = getAllBodies();
    return thoughtsNeedMotionStep(list);
  }

  function createBodyEl(side, glyphIndex) {
    const el = document.createElement("div");
    el.className = `battle-thought-body battle-thought-body--${side}`;
    el.setAttribute("role", "img");
    el.dataset.team = side;
    if (glyphIndex > 0) el.dataset.glyphIndex = String(glyphIndex);
    return el;
  }

  function styleBodyEl(body, glyph) {
    const size = thoughtDiameterPx(body.mountEl ? 1 : body.glyphCount);
    body.el.textContent = glyph;
    if (body.dancePhaseOffset != null) {
      body.el.style.setProperty("--thought-dance-phase", String(body.dancePhaseOffset));
    }
    if (isAnchoredFlankArena()) {
      body.el.style.width = "";
      body.el.style.height = "";
      body.el.style.fontSize = `${Math.round(size * THOUGHT_GLYPH_FONT_RATIO)}px`;
      body.el.style.zIndex = "1";
      return;
    }
    body.el.style.width = `${size}px`;
    body.el.style.height = `${size}px`;
    body.el.style.fontSize = `${Math.round(size * THOUGHT_GLYPH_FONT_RATIO)}px`;
  }

  function createCluster(side, glyphs, eventKey, event) {
    const slot = getHeroMountEl(side);
    if (!slot) return;

    const glyphCount = glyphs.length;
    const r = thoughtRadiusPx(usesGlyphMountContainers(glyphCount) ? 1 : glyphCount);
    const anchored = isAnchoredFlankArena();
    const splitMounts = usesGlyphMountContainers(glyphCount);
    const w = slot.clientWidth || slot.offsetWidth || Math.round(viewportMin() * 0.14);
    const h = slot.clientHeight || slot.offsetHeight || Math.round(viewportMin() * 0.14);
    const clusterRoot = splitMounts ? ensureClusterRoot(side, glyphCount) : null;
    if (splitMounts && clusterRoot) {
      layoutGlyphMounts(clusterRoot, glyphCount, anchored);
      clusterRoot.style.position = "absolute";
      clusterRoot.style.left = "50%";
      clusterRoot.style.top = "50%";
      clusterRoot.style.transform = "translate(-50%, -50%)";
      if (!anchored) {
        const clusterCenter = spawnPosition(w, h, r * glyphCount, side);
        clusterRoot.style.left = `${clusterCenter.x}px`;
        clusterRoot.style.top = `${clusterCenter.y}px`;
      }
    }

    const { arena: arenaPhys } = thoughtPhysicsProfile();
    const spacing = clusterGlyphSpacingPx(glyphCount, anchored);
    const offsets = clusterOffsets(glyphCount, spacing, { horizontalOnly: anchored });
    const center = splitMounts
      ? getLocalAnchorPx(thoughtDiameterPx(1), thoughtDiameterPx(1))
      : spawnPosition(w, h, r * glyphCount, side);
    const baseVel = anchored ? { vx: 0, vy: 0 } : randomVelocity(arenaPhys);
    const vmin = viewportMin();
    const perturb = anchored ? 0 : vmin * 0.018;
    const physicsGlyphCount = splitMounts ? 1 : glyphCount;

    const members = glyphs.map((glyph, index) => {
      const mountEl = splitMounts ? ensureGlyphMountEl(clusterRoot, side, index) : null;
      const el = createBodyEl(side, index);
      (mountEl || slot).appendChild(el);
      if (event.animation) el.dataset.animation = event.animation;
      if (event.replyTo) el.dataset.replyTo = event.replyTo;

      const mountW = mountEl
        ? (mountEl.clientWidth || thoughtDiameterPx(1))
        : w;
      const mountH = mountEl
        ? (mountEl.clientHeight || thoughtDiameterPx(1))
        : h;
      const offset = splitMounts ? { ox: 0, oy: 0 } : (offsets[index] || { ox: 0, oy: 0 });
      const spawn = splitMounts
        ? getLocalAnchorPx(mountW, mountH)
        : center;
      const x = spawn.x + offset.ox;
      const y = spawn.y + offset.oy;
      const body = {
        side,
        clusterSide: side,
        glyph,
        glyphIndex: index,
        glyphCount: physicsGlyphCount,
        clusterGlyphCount: glyphCount,
        mountEl,
        el,
        eventKey,
        offsetOx: offset.ox,
        offsetOy: offset.oy,
        homeX: x,
        homeY: y,
        x,
        y,
        renderX: x,
        renderY: y,
        renderRot: (Math.random() - 0.5) * 2,
        vx: baseVel.vx + (Math.random() - 0.5) * perturb,
        vy: baseVel.vy + (Math.random() - 0.5) * perturb,
        mass: 0.92 + glyphCount * 0.06 + index * 0.04,
        turbSeed: Math.random() * 80,
        turbPhase: Math.random() * Math.PI * 2,
        radius: r * 0.65,
        rotation: (Math.random() - 0.5) * 2,
        rotVel: (Math.random() - 0.5) * 1.5,
        displayScale: anchored ? 1 : 0.42,
        targetScale: 1,
        opacity: 1,
        fadeOut: false,
        wobbleAmp: 0.16,
        danceStyle: resolveDanceStyle(event.animation),
        dancePhaseOffset: index * GLYPH_DANCE_STAGGER_S + (side === "player" ? 0 : 0.28) + Math.random() * 0.12,
        danceTime: index * 0.14,
        mirrorX: usesThoughtDuelMirror() && side === "player",
      };
      if (isStaticThoughts()) {
        body.vx = 0;
        body.vy = 0;
        body.rotVel = 0;
        body.displayScale = 1;
        body.renderRot = 0;
        body.rotation = 0;
      }
      styleBodyEl(body, glyph);
      return body;
    });

    clusters.set(side, { eventKey, members });
  }

  function pulseClusterMember(body) {
    if (isStaticThoughts()) return;
    const vmin = viewportMin();
    const impulse = vmin * 0.0055;

    if (isAnchoredFlankArena()) {
      body.vy -= impulse * (0.06 + Math.random() * 0.025);
      body.vx += (Math.random() - 0.5) * impulse * 0.04;
      body.wobbleAmp = Math.min(0.28, (body.wobbleAmp ?? 1) + 0.05);
      body.targetScale = 1 + 0.012 * THOUGHT_SHAKE_DYNAMICS;
      window.setTimeout(() => {
        body.targetScale = 1;
      }, 520);
      return;
    }

    body.targetScale = 1.06;
    body.wobbleAmp = 0.65;
    body.vy -= impulse * 0.45;
    body.vx += (Math.random() - 0.5) * impulse * 0.7;
    window.setTimeout(() => {
      body.targetScale = 1;
    }, 260);
  }

  function pulseCluster(cluster) {
    if (isStaticThoughts()) return;
    cluster.members.forEach((body, index) => {
      window.setTimeout(() => pulseClusterMember(body), index * 180);
    });
  }

  function updateClusterGlyphs(cluster, glyphs, event) {
    cluster.eventKey = `${event.emoji}|${event.animation || ""}`;
    glyphs.forEach((glyph, index) => {
      const body = cluster.members[index];
      if (!body) return;
      if (event.animation) {
        body.el.dataset.animation = event.animation;
        body.danceStyle = resolveDanceStyle(event.animation);
      }
      if (body.glyph !== glyph) {
        body.glyph = glyph;
        styleBodyEl(body, glyph);
      }
    });
    if (isAnchoredFlankArena()) snapAnchoredClusterHome(cluster);
  }

  function upsert(side, event) {
    if (!getHeroMountEl(side) || !event?.emoji) return;

    const glyphs = normalizeGlyphsForDisplay(splitEmojiGlyphs(event.emoji), event.emoji);
    if (!glyphs.length) return;

    const key = `${event.emoji}|${event.animation || ""}`;
    const cluster = clusters.get(side);
    const anchored = isAnchoredFlankArena();

    if (!cluster) {
      createCluster(side, glyphs, key, event);
    } else if (cluster.members.length === glyphs.length) {
      const sameKey = cluster.eventKey === key;
      if (sameKey) return;
      updateClusterGlyphs(cluster, glyphs, event);
      if (!isStaticThoughts() && !isAnchoredFlankArena()) pulseCluster(cluster);
    } else {
      removeCluster(side, true);
      createCluster(side, glyphs, key, event);
    }

    if (isAnchoredFlankArena()) snapAnchoredClusterHome(clusters.get(side));

    clusters.get(side)?.members.forEach(applyVisual);
    if (!isStaticThoughts()) scheduleFrame();
  }

  function remove(side) {
    const cluster = clusters.get(side);
    if (!cluster) return;
    cluster.members.forEach((body) => {
      body.fadeOut = true;
    });
    scheduleFrame();
  }

  function clearAll() {
    clusters.forEach((cluster) => {
      cluster.members.forEach((body) => body.el.remove());
    });
    clusters.clear();
    clearClusterRootEl("player");
    clearClusterRootEl("enemy");
    equipReactions.player = [];
    equipReactions.enemy = [];
    cancelThoughtScheduler();
    lastTs = 0;
  }

  let thoughtResizeInProgress = false;
  let thoughtResizeLastAt = 0;
  let thoughtResizeDeferTimer = 0;
  const THOUGHT_RESIZE_MIN_MS = 180;

  function onResize() {
    if (thoughtResizeInProgress) return;
    const now = performance.now();
    if (now - thoughtResizeLastAt < THOUGHT_RESIZE_MIN_MS) {
      if (!thoughtResizeDeferTimer) {
        thoughtResizeDeferTimer = window.setTimeout(() => {
          thoughtResizeDeferTimer = 0;
          onResize();
        }, THOUGHT_RESIZE_MIN_MS);
      }
      return;
    }
    thoughtResizeInProgress = true;
    thoughtResizeLastAt = now;
    try {
      clusters.forEach((cluster) => {
        refreshClusterMemberOffsets(cluster);
        if (isAnchoredFlankArena()) snapAnchoredClusterHome(cluster);
      });
      getAllBodies().forEach((body) => {
        body.radius = thoughtRadiusPx(body.glyphCount);
        styleBodyEl(body, body.glyph);
        if (isAnchoredFlankArena()) {
          const mount = getBodyMountEl(body);
          if (!mount) return;
          const mw = mount.clientWidth;
          const mh = mount.clientHeight;
          const anchor = getLocalAnchorPx(mw, mh);
          body.homeX = anchor.x + (body.offsetOx || 0);
          body.homeY = anchor.y + (body.offsetOy || 0);
          body.x = body.homeX;
          body.y = body.homeY;
          body.mirrorX = usesThoughtDuelMirror() && body.side === "player";
        } else {
          const arena = getArenaEl();
          if (!arena) return;
          clampBodyToArena(body, arena.clientWidth, arena.clientHeight);
        }
        applyVisual(body);
      });
    } finally {
      thoughtResizeInProgress = false;
    }
  }

  if (typeof ResizeObserver !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      const onThoughtSlotResize = () => {
        if (thoughtResizeInProgress) return;
        onResize();
      };
      const ro = new ResizeObserver(onThoughtSlotResize);
      const arena = getArenaEl();
      if (arena) ro.observe(arena);
      ["player-thought-slot", "enemy-thought-slot"].forEach((id) => {
        const slot = document.getElementById(id);
        if (slot) ro.observe(slot);
      });
    });
  }
  window.addEventListener("resize", onResize);

  return {
    upsert,
    remove,
    clearAll,
    splitEmojiGlyphs,
    getArenaEl,
    getHeroMountEl,
    thoughtDiameterPx,
    getCompanionAnchorPx,
    getCompanionAnchorNorm,
    isAnchoredFlankArena,
    triggerEquipHitReaction,
    onResize,
    tickFromClock,
  };
})();
