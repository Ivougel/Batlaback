/**
 * PrepDragArc — живая магическая дуга переноса в prep:
 * магазин/скамья → поле, рюкзак → продажа/скамья.
 */

const PrepDragArc = (() => {
  const MIN_SPAN_PX = 48;
  const SPRING_K = 11;
  const TRAIL_MAX = 6;
  const PARTICLE_MAX = 14;

  const RARITY_PALETTE = {
    common:    { a: "#9eb4d4", b: "#8ecde8", c: "#a8b8d0" },
    rare:      { a: "#7eb8ff", b: "#5ecfff", c: "#88a8e8" },
    epic:      { a: "#c49bff", b: "#a878ff", c: "#b8a0e8" },
    legendary: { a: "#ffc86a", b: "#ffb040", c: "#e8b060" },
    unique:    { a: "#7affc4", b: "#50e8a8", c: "#88e8c0" },
    godly:     { a: "#ff8a9a", b: "#ff6080", c: "#ffa0b0" },
  };

  const VALIDITY_TINT = {
    valid:   { hue: 0.28, sat: 1.15 },
    invalid: { hue: -0.08, sat: 0.9 },
    neutral: { hue: 0, sat: 1 },
  };

  let active = false;
  let celebrating = false;
  let fromX = 0;
  let fromY = 0;
  let itemId = null;
  let dropState = "neutral";
  let lastTargetX = 0;
  let lastTargetY = 0;
  let lastProgress = 0;
  let lastRotation = 0;
  let layerEl = null;
  let measurePathEl = null;
  let haloPathEl = null;
  let flowPathEl = null;
  let corePathEl = null;
  let sparkEl = null;
  let sourceAnchorEl = null;
  let targetAnchorEl = null;
  let burstEl = null;
  let trailGroupEl = null;
  let particleGroupEl = null;
  let gradStopA = null;
  let gradStopB = null;
  let gradStopC = null;
  let rafId = null;
  let pulsePhase = 0;
  let lastFrameTs = 0;
  let burstT = 0;
  let audioCtx = null;

  let smoothTo = null;
  let smoothC1 = null;
  let smoothC2 = null;
  const trail = [];
  const particles = [];

  function viewportMin() {
    const vv = window.visualViewport;
    return Math.min(vv?.width ?? window.innerWidth, vv?.height ?? window.innerHeight);
  }

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpPt(a, b, t) {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  }

  function cubicBezier(p0, c1, c2, p3, t) {
    const u = 1 - t;
    const u2 = u * u;
    const t2 = t * t;
    return {
      x: u2 * u * p0.x + 3 * u2 * t * c1.x + 3 * u * t2 * c2.x + t2 * t * p3.x,
      y: u2 * u * p0.y + 3 * u2 * t * c1.y + 3 * u * t2 * c2.y + t2 * t * p3.y,
    };
  }

  function arcControls(from, to, vmin) {
    const dx = to.x - from.x;
    const span = Math.hypot(dx, to.y - from.y) || 1;
    const lift = Math.min(span * 0.1, vmin * 0.055);
    const midX = (from.x + to.x) * 0.5;
    const midY = (from.y + to.y) * 0.5;
    return {
      c1: { x: from.x + dx * 0.28, y: midY - lift * 0.35 },
      c2: { x: midX + dx * 0.12, y: midY - lift },
    };
  }

  function arcProgress(from, to, pointer) {
    const vx = to.x - from.x;
    const vy = to.y - from.y;
    const len2 = vx * vx + vy * vy;
    if (len2 < 36) return 1;
    const raw = ((pointer.x - from.x) * vx + (pointer.y - from.y) * vy) / len2;
    return Math.max(0, Math.min(1, raw));
  }

  function playTone(freq, duration, volume = 0.035) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = audioCtx.currentTime;
      gain.gain.setValueAtTime(volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (_) {}
  }

  function playBeginSound() {
    playTone(440, 0.1, 0.028);
    window.setTimeout(() => playTone(620, 0.08, 0.02), 40);
  }

  function playCelebrateSound() {
    playTone(740, 0.1, 0.032);
    window.setTimeout(() => playTone(980, 0.12, 0.028), 55);
    window.setTimeout(() => playTone(1180, 0.08, 0.018), 110);
  }

  function rarityKey(id) {
    const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[id] : null;
    return def?.rarity || "common";
  }

  function applyPalette() {
    const pal = RARITY_PALETTE[rarityKey(itemId)] || RARITY_PALETTE.common;
    const tint = VALIDITY_TINT[dropState] || VALIDITY_TINT.neutral;
    const boost = tint.sat;
    if (gradStopA) {
      gradStopA.setAttribute("stop-color", pal.a);
      gradStopB.setAttribute("stop-color", pal.b);
      gradStopC.setAttribute("stop-color", pal.c);
      const op = dropState === "valid" ? 0.52 : dropState === "invalid" ? 0.38 : 0.44;
      [gradStopA, gradStopB, gradStopC].forEach((s) => s.setAttribute("stop-opacity", String(op * boost)));
    }
    layerEl?.classList.toggle("prep-drag-arc-layer--valid", dropState === "valid");
    layerEl?.classList.toggle("prep-drag-arc-layer--invalid", dropState === "invalid");
  }

  function ensureLayer() {
    if (layerEl) return layerEl;
    layerEl = document.getElementById("prep-drag-arc-layer");
    if (!layerEl) {
      layerEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      layerEl.id = "prep-drag-arc-layer";
      layerEl.classList.add("prep-drag-arc-layer", "hidden");
      layerEl.setAttribute("aria-hidden", "true");
      layerEl.innerHTML = `
        <defs>
          <linearGradient id="prep-drag-arc-grad" gradientUnits="userSpaceOnUse">
            <stop id="prep-drag-arc-stop-a" offset="0%" stop-color="#b8a0e8" stop-opacity="0.44"/>
            <stop id="prep-drag-arc-stop-b" offset="50%" stop-color="#8ecde8" stop-opacity="0.5"/>
            <stop id="prep-drag-arc-stop-c" offset="100%" stop-color="#a99ad4" stop-opacity="0.4"/>
          </linearGradient>
          <filter id="prep-drag-arc-shimmer" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" result="noise">
              <animate attributeName="baseFrequency" dur="4s" values="0.014;0.022;0.014" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
        <g class="prep-drag-arc-particles"></g>
        <g class="prep-drag-arc-trail"></g>
        <path class="prep-drag-arc-measure" fill="none" stroke="none" visibility="hidden"/>
        <path class="prep-drag-arc-halo" fill="none" filter="url(#prep-drag-arc-shimmer)"/>
        <path class="prep-drag-arc-flow" fill="none"/>
        <path class="prep-drag-arc-core" fill="none" stroke="url(#prep-drag-arc-grad)"/>
        <circle class="prep-drag-arc-spark" r="3"/>
        <circle class="prep-drag-arc-anchor prep-drag-arc-anchor--source" fill="none"/>
        <circle class="prep-drag-arc-anchor prep-drag-arc-anchor--target" fill="none"/>
        <circle class="prep-drag-arc-burst" fill="none" opacity="0"/>
      `;
      document.body.appendChild(layerEl);
    }
    measurePathEl = layerEl.querySelector(".prep-drag-arc-measure");
    haloPathEl = layerEl.querySelector(".prep-drag-arc-halo");
    flowPathEl = layerEl.querySelector(".prep-drag-arc-flow");
    corePathEl = layerEl.querySelector(".prep-drag-arc-core");
    sparkEl = layerEl.querySelector(".prep-drag-arc-spark");
    sourceAnchorEl = layerEl.querySelector(".prep-drag-arc-anchor--source");
    targetAnchorEl = layerEl.querySelector(".prep-drag-arc-anchor--target");
    burstEl = layerEl.querySelector(".prep-drag-arc-burst");
    trailGroupEl = layerEl.querySelector(".prep-drag-arc-trail");
    particleGroupEl = layerEl.querySelector(".prep-drag-arc-particles");
    gradStopA = layerEl.querySelector("#prep-drag-arc-stop-a");
    gradStopB = layerEl.querySelector("#prep-drag-arc-stop-b");
    gradStopC = layerEl.querySelector("#prep-drag-arc-stop-c");
    return layerEl;
  }

  function syncLayerSize() {
    if (!layerEl) return;
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    const left = vv?.offsetLeft ?? 0;
    const top = vv?.offsetTop ?? 0;
    layerEl.setAttribute("width", String(w));
    layerEl.setAttribute("height", String(h));
    layerEl.style.width = `${w}px`;
    layerEl.style.height = `${h}px`;
    layerEl.style.left = `${left}px`;
    layerEl.style.top = `${top}px`;
  }

  function pathD(from, c1, c2, to) {
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  }

  function pulseWave(speed = 1, offset = 0) {
    return 0.5 + 0.5 * Math.sin(pulsePhase * speed + offset);
  }

  function updateGradient(from, to) {
    const grad = layerEl?.querySelector("#prep-drag-arc-grad");
    if (!grad) return;
    grad.setAttribute("x1", String(from.x));
    grad.setAttribute("y1", String(from.y));
    grad.setAttribute("x2", String(to.x));
    grad.setAttribute("y2", String(to.y));
    const wave = pulseWave(1.2, 0);
    if (gradStopB) gradStopB.setAttribute("offset", `${(45 + wave * 12).toFixed(1)}%`);
  }

  function pointOnPath(d, t) {
    if (!measurePathEl) return { x: 0, y: 0 };
    measurePathEl.setAttribute("d", d);
    const len = measurePathEl.getTotalLength();
    return measurePathEl.getPointAtLength(len * Math.max(0, Math.min(1, t)));
  }

  function spawnParticle(x, y) {
    if (particles.length >= PARTICLE_MAX) particles.shift();
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -0.4 - Math.random() * 0.5,
      life: 0.5 + Math.random() * 0.4,
      age: 0,
    });
  }

  function tickParticles(dt, d) {
    if (!particleGroupEl) return;
    while (particleGroupEl.firstChild) particleGroupEl.removeChild(particleGroupEl.firstChild);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      if (Math.random() < dt * 5 && d) {
        const t = Math.random();
        const pt = pointOnPath(d, t);
        p.x = pt.x;
        p.y = pt.y;
      }
      p.x += p.vx;
      p.y += p.vy;
      const alpha = (1 - p.age / p.life) * 0.55;
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", p.x.toFixed(1));
      circle.setAttribute("cy", p.y.toFixed(1));
      circle.setAttribute("r", String(1.2 + alpha * 1.5));
      circle.setAttribute("fill", `rgba(180, 220, 255, ${alpha.toFixed(3)})`);
      particleGroupEl.appendChild(circle);
    }
    if (Math.random() < dt * 3.5 && d) {
      const t = (pulsePhase * 0.15) % 1;
      const pt = pointOnPath(d, t);
      spawnParticle(pt.x, pt.y);
    }
  }

  function pushTrailPoint(x, y) {
    if (!active) return;
    const last = trail[trail.length - 1];
    if (last && Math.hypot(last.x - x, last.y - y) < 6) return;
    trail.push({ x, y, age: 0 });
    if (trail.length > TRAIL_MAX) trail.shift();
  }

  function renderTrail(dt) {
    if (!trailGroupEl) return;
    while (trailGroupEl.firstChild) trailGroupEl.removeChild(trailGroupEl.firstChild);
    trail.forEach((pt) => {
      pt.age += dt;
      const alpha = Math.max(0, 0.35 - pt.age * 0.9);
      if (alpha <= 0) return;
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", pt.x.toFixed(1));
      circle.setAttribute("cy", pt.y.toFixed(1));
      circle.setAttribute("r", "4");
      circle.setAttribute("fill", `rgba(160, 200, 255, ${alpha.toFixed(3)})`);
      trailGroupEl.appendChild(circle);
    });
    while (trail.length && trail[0].age > 0.4) trail.shift();
  }

  function renderAnchors(from, to, pulseA, pulseB) {
    const srcR = 5 + pulseA * 2.5;
    const tgtR = 6 + pulseB * 3;
    if (sourceAnchorEl) {
      sourceAnchorEl.setAttribute("cx", from.x.toFixed(1));
      sourceAnchorEl.setAttribute("cy", from.y.toFixed(1));
      sourceAnchorEl.setAttribute("r", String(srcR));
      sourceAnchorEl.setAttribute("stroke-width", "1.2");
    }
    if (targetAnchorEl) {
      targetAnchorEl.setAttribute("cx", to.x.toFixed(1));
      targetAnchorEl.setAttribute("cy", to.y.toFixed(1));
      targetAnchorEl.setAttribute("r", String(tgtR));
      targetAnchorEl.setAttribute("stroke-width", "1.4");
    }
  }

  function renderSpark(d, progress, pulseB) {
    if (!sparkEl) return;
    const t = Math.max(0.04, Math.min(0.98, progress));
    const pt = pointOnPath(d, t);
    sparkEl.setAttribute("cx", pt.x.toFixed(1));
    sparkEl.setAttribute("cy", pt.y.toFixed(1));
    sparkEl.setAttribute("r", String(2.2 + pulseB * 1.2));
    sparkEl.style.opacity = String(0.45 + pulseB * 0.35);
  }

  function renderBurst(dt) {
    if (!burstEl || burstT <= 0) return;
    burstT = Math.max(0, burstT - dt);
    const p = 1 - burstT / 0.28;
    const r = 6 + p * 28;
    burstEl.setAttribute("r", String(r));
    burstEl.style.opacity = String((1 - p) * 0.65);
    burstEl.setAttribute("stroke-width", String(2 - p * 1.2));
  }

  function getSmoothedGeometry(targetX, targetY, dt) {
    const from = { x: fromX, y: fromY };
    const targetTo = { x: targetX, y: targetY };
    const targetControls = arcControls(from, targetTo, viewportMin());
    const t = Math.min(1, dt * SPRING_K);
    if (!smoothTo) {
      smoothTo = { ...targetTo };
      smoothC1 = { ...targetControls.c1 };
      smoothC2 = { ...targetControls.c2 };
    } else {
      smoothTo = lerpPt(smoothTo, targetTo, t);
      smoothC1 = lerpPt(smoothC1, targetControls.c1, t);
      smoothC2 = lerpPt(smoothC2, targetControls.c2, t);
    }
    return { from, to: smoothTo, controls: { c1: smoothC1, c2: smoothC2 } };
  }

  function renderArc(geom, progress, dt) {
    ensureLayer();
    syncLayerSize();
    applyPalette();
    const { from, to, controls } = geom;
    const { c1, c2 } = controls;
    const d = pathD(from, c1, c2, to);

    const pulseA = pulseWave(1.05, 0);
    const pulseB = pulseWave(1.55, 0.9);
    const dashPeriod = 4 + pulseB;
    const dashGap = 6.5 + pulseA * 1.2;
    const dashOffset = -pulsePhase * 28;
    const flowOffset = -pulsePhase * 28 + 9;
    const dashPattern = `${dashPeriod.toFixed(1)} ${dashGap.toFixed(1)}`;

    const haloWidth = 4.5 + pulseA * 2;
    const coreWidth = 1.2 + pulseA * 0.35;
    const flowWidth = 1 + pulseB * 0.3;
    const haloOpacity = 0.08 + pulseA * 0.06;
    const coreOpacity = 0.3 + pulseB * 0.12;
    const flowOpacity = 0.22 + pulseA * 0.1;

    [haloPathEl, flowPathEl, corePathEl].forEach((el) => {
      if (!el) return;
      el.setAttribute("d", d);
    });
    if (measurePathEl) measurePathEl.setAttribute("d", d);

    if (haloPathEl) {
      haloPathEl.setAttribute("stroke", `rgba(148, 188, 230, ${haloOpacity.toFixed(3)})`);
      haloPathEl.setAttribute("stroke-width", String(haloWidth));
      haloPathEl.setAttribute("stroke-dasharray", dashPattern);
      haloPathEl.setAttribute("stroke-dashoffset", String(dashOffset));
    }
    if (flowPathEl) {
      flowPathEl.setAttribute("stroke", `rgba(200, 230, 255, ${flowOpacity.toFixed(3)})`);
      flowPathEl.setAttribute("stroke-width", String(flowWidth));
      flowPathEl.setAttribute("stroke-dasharray", `2 ${(dashPeriod + dashGap).toFixed(1)}`);
      flowPathEl.setAttribute("stroke-dashoffset", String(flowOffset));
    }
    if (corePathEl) {
      corePathEl.setAttribute("stroke-width", String(coreWidth));
      corePathEl.setAttribute("stroke-dasharray", dashPattern);
      corePathEl.setAttribute("stroke-dashoffset", String(dashOffset));
      corePathEl.style.opacity = String(coreOpacity);
    }

    updateGradient(from, to);
    renderAnchors(from, to, pulseA, pulseB);
    renderSpark(d, progress, pulseB);
    renderTrail(dt);
    tickParticles(dt, d);
    renderBurst(dt);

    layerEl.style.setProperty("--prep-arc-pulse", String(pulseA));
    layerEl.classList.remove("hidden");
    layerEl.classList.remove("prep-drag-arc-layer--fade");
  }

  function schedulePulse() {
    if (rafId != null) return;
    rafId = requestAnimationFrame((ts) => {
      rafId = null;
      if (!active && !celebrating) return;
      const dt = lastFrameTs ? Math.min(0.05, (ts - lastFrameTs) / 1000) : 0.016;
      lastFrameTs = ts;
      pulsePhase = ts * 0.0036;
      const from = { x: fromX, y: fromY };
      const geom = getSmoothedGeometry(lastTargetX, lastTargetY, dt);
      renderArc(geom, lastProgress, dt);
      if (active || celebrating) schedulePulse();
    });
  }

  function isPrepArcDrag() {
    if (typeof phase === "undefined" || phase !== "prep") return false;
    if (typeof dragFrom === "undefined" || !dragFrom) return false;
    return dragFrom.type === "shop"
      || dragFrom.type === "bench"
      || dragFrom.type === "item"
      || dragFrom.type === "container";
  }

  function sampleArc(geom, t) {
    return cubicBezier(geom.from, geom.controls.c1, geom.controls.c2, geom.to, t);
  }

  function begin({ fromX: fx, fromY: fy, itemId: id }) {
    if (typeof phase !== "undefined" && phase !== "prep") return;
    active = true;
    celebrating = false;
    fromX = fx;
    fromY = fy;
    itemId = id || (typeof dragPayload !== "undefined" ? dragPayload?.itemId : null);
    dropState = "neutral";
    lastTargetX = fx;
    lastTargetY = fy;
    lastProgress = 0;
    lastRotation = 0;
    smoothTo = null;
    smoothC1 = null;
    smoothC2 = null;
    trail.length = 0;
    particles.length = 0;
    burstT = 0;
    lastFrameTs = 0;
    pulsePhase = 0;
    ensureLayer();
    playBeginSound();
    schedulePulse();
  }

  function resolveGhostPosition(clientX, clientY, targetX, targetY) {
    if (!active) return { x: targetX, y: targetY, rotation: 0, progress: 1 };

    const geom = getSmoothedGeometry(targetX, targetY, 0.14);
    const from = geom.from;
    const to = geom.to;
    const pointer = { x: clientX, y: clientY };
    const span = Math.hypot(to.x - from.x, to.y - from.y);

    if (span < MIN_SPAN_PX) {
      return { x: targetX, y: targetY, rotation: 0, progress: 1 };
    }

    const progress = easeInOutSine(arcProgress(from, to, pointer));
    const pt = sampleArc(geom, progress);
    const ptNext = sampleArc(geom, Math.min(1, progress + 0.025));
    const rotation = Math.atan2(ptNext.y - pt.y, ptNext.x - pt.x) * (180 / Math.PI);

    lastTargetX = targetX;
    lastTargetY = targetY;
    lastProgress = progress;
    lastRotation = rotation;

    return { x: pt.x, y: pt.y, rotation, progress };
  }

  function sync(clientX, clientY, targetX, targetY, opts = {}) {
    if (!active) return;
    if (opts.dropState) dropState = opts.dropState;
    if (opts.itemId) itemId = opts.itemId;
    const pos = resolveGhostPosition(clientX, clientY, targetX, targetY);
    pushTrailPoint(pos.x, pos.y);
    const geom = getSmoothedGeometry(targetX, targetY, 0.14);
    renderArc(geom, lastProgress, 0.016);
  }

  function celebrate(x, y) {
    if (!active && !layerEl) return;
    celebrating = true;
    active = false;
    if (x != null && y != null) {
      lastTargetX = x;
      lastTargetY = y;
      if (burstEl) {
        burstEl.setAttribute("cx", String(x));
        burstEl.setAttribute("cy", String(y));
      }
    }
    burstT = 0.28;
    playCelebrateSound();
    schedulePulse();
    window.setTimeout(() => {
      celebrating = false;
      end();
    }, 280);
  }

  function end() {
    active = false;
    celebrating = false;
    lastProgress = 0;
    trail.length = 0;
    particles.length = 0;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    getDragGhostCanvas?.()?.classList.remove("ui-drag-ghost--arc-flight");
    restoreGhostParent();
    if (!layerEl) return;
    layerEl.classList.add("prep-drag-arc-layer--fade");
    window.setTimeout(() => {
      if (active || celebrating) return;
      layerEl?.classList.add("hidden");
      layerEl?.classList.remove("prep-drag-arc-layer--fade");
      layerEl?.classList.remove("prep-drag-arc-layer--valid", "prep-drag-arc-layer--invalid");
    }, 180);
  }

  let ghostOriginalParent = null;

  function mountGhostToBody() {
    const el = typeof getDragGhostCanvas === "function" ? getDragGhostCanvas() : null;
    if (!el || el.parentElement === document.body) return;
    ghostOriginalParent = el.parentElement;
    document.body.appendChild(el);
  }

  function restoreGhostParent() {
    const el = typeof getDragGhostCanvas === "function" ? getDragGhostCanvas() : null;
    if (!el || !ghostOriginalParent) return;
    if (el.parentElement === document.body) ghostOriginalParent.appendChild(el);
    ghostOriginalParent = null;
  }

  function isActive() {
    return active && isPrepArcDrag();
  }

  function isCelebrating() {
    return celebrating;
  }

  return {
    begin,
    sync,
    end,
    celebrate,
    isActive,
    isCelebrating,
    resolveGhostPosition,
    pushTrailPoint,
    mountGhostToBody,
    getGhostRotation: () => lastRotation,
  };
})();

if (typeof window !== "undefined") {
  window.PrepDragArc = PrepDragArc;
}
