/**
 * ThoughtArena — общий контейнер боевых эмоджи (mobile portrait).
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

  /** @type {Map<string, { eventKey: string, members: object[] }>} */
  const clusters = new Map();
  let rafId = null;
  let lastTs = 0;

  function getArenaEl() {
    return document.getElementById("battle-thought-arena");
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
    const ratio = glyphCount > 1 ? CLUSTER_SIZE_RATIO : SIZE_RATIO;
    return viewportMin() * ratio;
  }

  function thoughtRadiusPx(glyphCount = 1) {
    return thoughtDiameterPx(glyphCount) * 0.5;
  }

  function randomSpawnPosition(w, h, r, side) {
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

  function step(ts) {
    rafId = null;
    const arena = getArenaEl();
    if (!arena || clusters.size === 0) {
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

    const w = arena.clientWidth;
    const h = arena.clientHeight;
    if (w <= 0 || h <= 0) {
      scheduleFrame();
      return;
    }

    const list = getAllBodies();

    list.forEach((body) => {
      const targetR = thoughtRadiusPx(body.glyphCount);
      body.radius += (targetR - body.radius) * Math.min(1, dt * 6);
      body.displayScale += (body.targetScale - body.displayScale) * Math.min(1, dt * 5);
      body.wobblePhase += dt * (2.2 + body.wobbleSpeed);
      body.wobbleAmp *= 0.96;

      if (body.fadeOut) {
        body.opacity = Math.max(0, body.opacity - dt * 4.5);
      }

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

    alive.forEach(applyVisual);

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
    const arena = getArenaEl();
    if (!arena) return;

    const w = arena.clientWidth || arena.offsetWidth || viewportMin();
    const h = arena.clientHeight || Math.max(120, viewportMin() * 0.22);
    const glyphCount = glyphs.length;
    const r = thoughtRadiusPx(glyphCount);
    const center = randomSpawnPosition(w, h, r * glyphCount, side);
    const baseVel = randomVelocity();
    const spacing = thoughtDiameterPx(glyphCount) * CLUSTER_SPACING_RATIO;
    const offsets = clusterOffsets(glyphCount, spacing);
    const vmin = viewportMin();
    const perturb = vmin * 0.035;

    const members = glyphs.map((glyph, index) => {
      const el = createBodyEl(side, index);
      arena.appendChild(el);
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
        x,
        y,
        renderX: x,
        renderY: y,
        vx: baseVel.vx + (Math.random() - 0.5) * perturb,
        vy: baseVel.vy + (Math.random() - 0.5) * perturb,
        radius: r * 0.65,
        rotation: (Math.random() - 0.5) * 18,
        rotVel: (Math.random() - 0.5) * 28,
        displayScale: 0.35,
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

  function upsert(side, event) {
    const arena = getArenaEl();
    if (!arena || !event?.emoji) return;

    const glyphs = splitEmojiGlyphs(event.emoji);
    if (!glyphs.length) return;

    const key = `${event.startedAt}|${event.emoji}|${event.animation || ""}`;
    const cluster = clusters.get(side);

    if (!cluster || cluster.eventKey !== key || cluster.members.length !== glyphs.length) {
      removeCluster(side, true);
      createCluster(side, glyphs, key, event);
    } else {
      glyphs.forEach((glyph, index) => {
        const body = cluster.members[index];
        if (!body) return;
        if (body.glyph !== glyph) {
          body.glyph = glyph;
          styleBodyEl(body, glyph);
        }
      });
      pulseCluster(cluster);
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
    const arena = getArenaEl();
    if (arena) arena.innerHTML = "";
  }

  function onResize() {
    const arena = getArenaEl();
    if (!arena) return;
    const w = arena.clientWidth;
    const h = arena.clientHeight;
    getAllBodies().forEach((body) => {
      body.radius = thoughtRadiusPx(body.glyphCount);
      styleBodyEl(body, body.glyph);
      clampBodyToArena(body, w, h);
      applyVisual(body);
    });
  }

  if (typeof ResizeObserver !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      const arena = getArenaEl();
      if (arena) new ResizeObserver(onResize).observe(arena);
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
    thoughtDiameterPx,
  };
})();
