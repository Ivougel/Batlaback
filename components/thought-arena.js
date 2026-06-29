/**
 * ThoughtArena — общий контейнер боевых эмоджи (mobile + tablet battle).
 * Составные строки (⚔️🛡️) разбиваются на отдельные тела со своей физикой.
 */

const ThoughtArena = (() => {
  const SIZE_RATIO = 0.15;
  const CLUSTER_SIZE_RATIO = 0.12;
  const RESTITUTION = 0.9;
  const AIR_DRAG = 0.9992;
  const MAX_DT = 0.032;
  const CLUSTER_SPACING_RATIO = 0.58;
  const CLUSTER_MAX_SPREAD_RATIO = 1.35;

  /** Legacy: центр арены (до переноса на карточку героя) */
  const COMPANION_ANCHOR_NORM = {
    player: { x: 0.20, y: 0.36 },
    enemy: { x: 0.80, y: 0.36 },
  };

  /** Компактнее, когда эмодзи сидит на портрете */
  const HERO_CARD_SIZE_RATIO = 0.11;
  const HERO_CARD_CLUSTER_SIZE_RATIO = 0.095;

  /** @type {Map<string, { eventKey: string, members: object[] }>} */
  const clusters = new Map();
  let rafId = null;
  let lastTs = 0;

  function getArenaEl() {
    return document.getElementById("battle-thought-arena");
  }

  function getHeroMountEl(side) {
    if (isAnchoredFlankArena()) {
      return document.getElementById(side === "player" ? "player-thought-slot" : "enemy-thought-slot");
    }
    return getArenaEl();
  }

  function isAnchoredFlankArena() {
    const root = document.documentElement;
    return root.dataset.battleHeroPlacement === "flank-arena"
      && root.dataset.battleArenaLayout === "true";
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
    const ratio = glyphCount > 1
      ? (onHeroCard ? HERO_CARD_CLUSTER_SIZE_RATIO : CLUSTER_SIZE_RATIO)
      : (onHeroCard ? HERO_CARD_SIZE_RATIO : SIZE_RATIO);
    return viewportMin() * ratio;
  }

  function thoughtRadiusPx(glyphCount = 1) {
    return thoughtDiameterPx(glyphCount) * 0.5;
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

  function randomVelocity() {
    const vmin = viewportMin();
    const speed = vmin * (0.11 + Math.random() * 0.1);
    const angle = Math.random() * Math.PI * 2;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  }

  function clusterOffsets(count, spacing) {
    if (count <= 1) return [{ ox: 0, oy: 0 }];
    const span = spacing * (count - 1);
    return Array.from({ length: count }, (_, i) => ({
      ox: -span * 0.5 + i * spacing,
      oy: (Math.random() - 0.5) * spacing * 0.28,
    }));
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
    clusters.delete(side);
  }

  function clampBodyToArena(body, w, h) {
    const r = body.radius;
    body.x = Math.max(r, Math.min(w - r, body.x));
    body.y = Math.max(r, Math.min(h - r, body.y));
  }

  function resolveWallCollision(body, w, h) {
    const r = body.radius;
    if (body.x - r < 0) {
      body.x = r;
      body.vx = Math.abs(body.vx) * RESTITUTION;
    } else if (body.x + r > w) {
      body.x = w - r;
      body.vx = -Math.abs(body.vx) * RESTITUTION;
    }
    if (body.y - r < 0) {
      body.y = r;
      body.vy = Math.abs(body.vy) * RESTITUTION;
    } else if (body.y + r > h) {
      body.y = h - r;
      body.vy = -Math.abs(body.vy) * RESTITUTION;
    }
  }

  function resolveBodyCollision(a, b) {
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

    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dvn = dvx * nx + dvy * ny;
    if (dvn <= 0) return;
    const impulse = dvn * RESTITUTION;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
  }

  function applyClusterCohesion(members, dt, maxSpread) {
    if (members.length < 2) return;

    let cx = 0;
    let cy = 0;
    members.forEach((body) => {
      cx += body.x;
      cy += body.y;
    });
    cx /= members.length;
    cy /= members.length;

    members.forEach((body) => {
      const dx = cx - body.x;
      const dy = cy - body.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.001) return;

      body.vx += (dx / dist) * 1.1 * dt;
      body.vy += (dy / dist) * 1.1 * dt;

      if (dist > maxSpread) {
        const pull = (dist - maxSpread) * 3.2 * dt;
        body.vx += (dx / dist) * pull;
        body.vy += (dy / dist) * pull;
      }
    });
  }

  function isBattlePausedNow() {
    return typeof isBattlePaused === "function" ? isBattlePaused() : !!window.battlePaused;
  }

  function applyVisual(body) {
    const wobble = 1 + Math.sin(body.wobblePhase) * 0.04 * body.wobbleAmp;
    const scale = body.displayScale * wobble;
    const x = body.renderX ?? body.x;
    const y = body.renderY ?? body.y;
    body.el.style.transform = [
      `translate3d(${x}px, ${y}px, 0)`,
      "translate(-50%, -50%)",
      `rotate(${body.rotation}deg)`,
      `scale(${scale})`,
    ].join(" ");
    body.el.style.opacity = String(body.opacity);
  }

  function pruneFadedBodies() {
    clusters.forEach((cluster, side) => {
      cluster.members = cluster.members.filter((body) => {
        if (!body.fadeOut || body.opacity > 0.02) return true;
        body.el.remove();
        return false;
      });
      if (cluster.members.length === 0) clusters.delete(side);
    });
  }

  function stepAnchoredHover(list, dt) {
    const vmin = viewportMin();
    list.forEach((body) => {
      const mount = getHeroMountEl(body.side);
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w <= 0 || h <= 0) return;

      const targetR = thoughtRadiusPx(body.glyphCount);
      body.radius += (targetR - body.radius) * Math.min(1, dt * 6);
      body.displayScale += (body.targetScale - body.displayScale) * Math.min(1, dt * 5);
      body.wobblePhase += dt * (1.8 + body.wobbleSpeed * 0.6);
      body.wobbleAmp = Math.max(0.35, body.wobbleAmp * 0.98);

      if (body.fadeOut) {
        body.opacity = Math.max(0, body.opacity - dt * 4.5);
      }

      const anchor = getLocalAnchorPx(w, h);
      body.homeX = anchor.x + (body.offsetOx || 0);
      body.homeY = anchor.y + (body.offsetOy || 0);

      const wobbleX = Math.sin(body.wobblePhase) * vmin * 0.005 * body.wobbleAmp;
      const wobbleY = Math.cos(body.wobblePhase * 0.82) * vmin * 0.004 * body.wobbleAmp;
      body.x = body.homeX;
      body.y = body.homeY;
      body.renderX = body.homeX + wobbleX;
      body.renderY = body.homeY + wobbleY;
      body.rotation += Math.sin(body.wobblePhase * 0.5) * dt * 8;
    });
  }

  function step(ts) {
    rafId = null;
    if (clusters.size === 0) {
      lastTs = 0;
      return;
    }

    if (isBattlePausedNow()) {
      lastTs = 0;
      scheduleFrame();
      return;
    }

    if (!lastTs) lastTs = ts;
    let dt = Math.min(MAX_DT, (ts - lastTs) / 1000);
    lastTs = ts;
    if (dt <= 0) dt = 1 / 60;

    const list = getAllBodies();
    const anchored = isAnchoredFlankArena();

    list.forEach((body) => {
      const targetR = thoughtRadiusPx(body.glyphCount);
      body.radius += (targetR - body.radius) * Math.min(1, dt * 6);
      body.displayScale += (body.targetScale - body.displayScale) * Math.min(1, dt * 5);
      body.wobblePhase += dt * (2.2 + body.wobbleSpeed);
      body.wobbleAmp *= 0.96;

      if (body.fadeOut) {
        body.opacity = Math.max(0, body.opacity - dt * 4.5);
      }
    });

    if (anchored) {
      stepAnchoredHover(list, dt);
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

      list.forEach((body) => {
        body.vx *= AIR_DRAG;
        body.vy *= AIR_DRAG;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.rotation += body.rotVel * dt;
        resolveWallCollision(body, w, h);
        clampBodyToArena(body, w, h);
      });

      pruneFadedBodies();

      const alive = getAllBodies();
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          resolveBodyCollision(alive[i], alive[j]);
        }
      }

      clusters.forEach((cluster) => {
        const maxSpread = thoughtDiameterPx(cluster.members[0]?.glyphCount || 1) * CLUSTER_MAX_SPREAD_RATIO;
        applyClusterCohesion(cluster.members, dt, maxSpread);
      });

      alive.forEach((body) => {
        body.renderX = body.renderX ?? body.x;
        body.renderY = body.renderY ?? body.y;
        const smooth = Math.min(1, dt * 16);
        body.renderX += (body.x - body.renderX) * smooth;
        body.renderY += (body.y - body.renderY) * smooth;
      });
    }

    pruneFadedBodies();
    getAllBodies().forEach(applyVisual);

    if (clusters.size > 0) scheduleFrame();
    else lastTs = 0;
  }

  function scheduleFrame() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(step);
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
    const size = thoughtDiameterPx(body.glyphCount);
    body.el.textContent = glyph;
    body.el.style.width = `${size}px`;
    body.el.style.height = `${size}px`;
    body.el.style.fontSize = `${size * 0.72}px`;
  }

  function createCluster(side, glyphs, eventKey, event) {
    const mount = getHeroMountEl(side);
    if (!mount) return;

    const w = mount.clientWidth || mount.offsetWidth || Math.round(viewportMin() * 0.14);
    const h = mount.clientHeight || mount.offsetHeight || Math.round(viewportMin() * 0.14);
    const glyphCount = glyphs.length;
    const r = thoughtRadiusPx(glyphCount);
    const anchored = isAnchoredFlankArena();
    const center = spawnPosition(w, h, r * glyphCount, side);
    const baseVel = anchored ? { vx: 0, vy: 0 } : randomVelocity();
    const spacing = thoughtDiameterPx(glyphCount) * (anchored ? 0.42 : CLUSTER_SPACING_RATIO);
    const offsets = clusterOffsets(glyphCount, spacing);
    const vmin = viewportMin();
    const perturb = anchored ? 0 : vmin * 0.035;

    const members = glyphs.map((glyph, index) => {
      const el = createBodyEl(side, index);
      mount.appendChild(el);
      if (event.animation) el.dataset.animation = event.animation;
      if (event.replyTo) el.dataset.replyTo = event.replyTo;

      const offset = offsets[index];
      const x = center.x + offset.ox;
      const y = center.y + offset.oy;
      const body = {
        side,
        clusterSide: side,
        glyph,
        glyphIndex: index,
        glyphCount,
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
        vx: baseVel.vx + (Math.random() - 0.5) * perturb,
        vy: baseVel.vy + (Math.random() - 0.5) * perturb,
        radius: r * 0.65,
        rotation: (Math.random() - 0.5) * 18,
        rotVel: (Math.random() - 0.5) * 28,
        displayScale: anchored ? 1 : 0.35,
        targetScale: 1,
        opacity: 1,
        fadeOut: false,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 0.6,
        wobbleSpeed: 1,
      };
      styleBodyEl(body, glyph);
      return body;
    });

    clusters.set(side, { eventKey, members });
  }

  function pulseCluster(cluster) {
    if (isAnchoredFlankArena()) {
      cluster.members.forEach((body) => {
        body.targetScale = 1.1;
        body.wobbleAmp = 1.15;
      });
      window.setTimeout(() => {
        cluster.members.forEach((body) => {
          body.targetScale = 1;
        });
      }, 180);
      return;
    }

    const vmin = viewportMin();
    cluster.members.forEach((body) => {
      body.targetScale = 1.14;
      body.wobbleAmp = 1;
      body.vx += (Math.random() - 0.5) * vmin * 0.04;
      body.vy += (Math.random() - 0.5) * vmin * 0.04;
    });
    window.setTimeout(() => {
      cluster.members.forEach((body) => {
        body.targetScale = 1;
      });
    }, 180);
  }

  function updateClusterGlyphs(cluster, glyphs, event) {
    cluster.eventKey = `${event.emoji}|${event.animation || ""}`;
    glyphs.forEach((glyph, index) => {
      const body = cluster.members[index];
      if (!body) return;
      if (event.animation) body.el.dataset.animation = event.animation;
      if (body.glyph !== glyph) {
        body.glyph = glyph;
        styleBodyEl(body, glyph);
      }
    });
  }

  function upsert(side, event) {
    if (!getHeroMountEl(side) || !event?.emoji) return;

    const glyphs = splitEmojiGlyphs(event.emoji);
    if (!glyphs.length) return;

    const key = `${event.emoji}|${event.animation || ""}`;
    const cluster = clusters.get(side);
    const anchored = isAnchoredFlankArena();

    if (!cluster) {
      createCluster(side, glyphs, key, event);
    } else if (cluster.members.length === glyphs.length) {
      const sameKey = cluster.eventKey === key;
      updateClusterGlyphs(cluster, glyphs, event);
      if (!sameKey) pulseCluster(cluster);
    } else {
      removeCluster(side, true);
      createCluster(side, glyphs, key, event);
    }

    clusters.get(side)?.members.forEach(applyVisual);
    scheduleFrame();
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
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = 0;
  }

  function onResize() {
    getAllBodies().forEach((body) => {
      body.radius = thoughtRadiusPx(body.glyphCount);
      styleBodyEl(body, body.glyph);
      if (isAnchoredFlankArena()) {
        const mount = getHeroMountEl(body.side);
        if (!mount) return;
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        const anchor = getLocalAnchorPx(w, h);
        body.homeX = anchor.x + (body.offsetOx || 0);
        body.homeY = anchor.y + (body.offsetOy || 0);
        body.x = body.homeX;
        body.y = body.homeY;
      } else {
        const arena = getArenaEl();
        if (!arena) return;
        clampBodyToArena(body, arena.clientWidth, arena.clientHeight);
      }
      applyVisual(body);
    });
  }

  if (typeof ResizeObserver !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      const ro = new ResizeObserver(onResize);
      const arena = getArenaEl();
      if (arena) ro.observe(arena);
      ["player-thought-slot", "enemy-thought-slot"].forEach((id) => {
        const slot = document.getElementById(id);
        if (slot) ro.observe(slot);
      });
    });
  }
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);

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
    onResize,
  };
})();
