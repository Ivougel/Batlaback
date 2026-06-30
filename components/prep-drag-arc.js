/**
 * PrepDragArc — магическая дуга переноса предмета из магазина/скамьи на поле (только prep).
 */

const PrepDragArc = (() => {
  const MIN_SPAN_PX = 48;

  let active = false;
  let fromX = 0;
  let fromY = 0;
  let lastTargetX = 0;
  let lastTargetY = 0;
  let lastProgress = 0;
  let lastRotation = 0;
  let layerEl = null;
  let haloPathEl = null;
  let glowPathEl = null;
  let corePathEl = null;
  let sparkPathEl = null;
  let rafId = null;
  let pulsePhase = 0;

  function viewportMin() {
    const vv = window.visualViewport;
    return Math.min(vv?.width ?? window.innerWidth, vv?.height ?? window.innerHeight);
  }

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
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

  /** Плавная широкая дуга: два контрольных пункта с высоким подъёмом. */
  function arcControls(from, to, vmin) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const span = Math.hypot(dx, dy);
    const lift = Math.max(vmin * 0.26, span * 0.48);
    const sideBias = dx * 0.08;

    return {
      c1: {
        x: from.x + dx * 0.18 + sideBias,
        y: from.y + dy * 0.06 - lift * 0.72,
      },
      c2: {
        x: from.x + dx * 0.82 - sideBias * 0.5,
        y: from.y + dy * 0.38 - lift,
      },
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
          <linearGradient id="prep-drag-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#c77dff" stop-opacity="0.95"/>
            <stop offset="45%" stop-color="#7ee8fa" stop-opacity="1"/>
            <stop offset="100%" stop-color="#a78bfa" stop-opacity="0.9"/>
          </linearGradient>
          <filter id="prep-drag-arc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur"/>
            <feColorMatrix in="blur" type="matrix"
              values="0 0 0 0 0.72  0 0 0 0 0.35  0 0 0 0 1  0 0 0 0.85 0"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path class="prep-drag-arc-halo" fill="none"/>
        <path class="prep-drag-arc-glow" fill="none" filter="url(#prep-drag-arc-glow)"/>
        <path class="prep-drag-arc-core" fill="none" stroke="url(#prep-drag-arc-grad)"/>
        <path class="prep-drag-arc-spark" fill="none" stroke="url(#prep-drag-arc-grad)"/>
      `;
      const host = document.getElementById("layer-fx") || document.body;
      host.appendChild(layerEl);
    }
    haloPathEl = layerEl.querySelector(".prep-drag-arc-halo");
    glowPathEl = layerEl.querySelector(".prep-drag-arc-glow");
    corePathEl = layerEl.querySelector(".prep-drag-arc-core");
    sparkPathEl = layerEl.querySelector(".prep-drag-arc-spark");
    return layerEl;
  }

  function syncLayerSize() {
    if (!layerEl) return;
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    layerEl.setAttribute("width", String(w));
    layerEl.setAttribute("height", String(h));
    layerEl.style.width = `${w}px`;
    layerEl.style.height = `${h}px`;
  }

  function pathD(from, c1, c2, to) {
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  }

  function pulseWave(speed = 1, offset = 0) {
    return 0.5 + 0.5 * Math.sin(pulsePhase * speed + offset);
  }

  function renderArc(from, controls, to, progress) {
    ensureLayer();
    syncLayerSize();
    const { c1, c2 } = controls;
    const d = pathD(from, c1, c2, to);

    const pulseA = pulseWave(1.1, 0);
    const pulseB = pulseWave(1.7, 1.2);
    const glowWidth = 18 + pulseA * 10;
    const haloWidth = 28 + pulseB * 14;
    const coreWidth = 2.8 + pulseA * 1.2;
    const glowOpacity = 0.42 + pulseA * 0.28;
    const coreOpacity = 0.78 + pulseB * 0.2;
    const haloOpacity = 0.18 + pulseA * 0.14;

    [haloPathEl, glowPathEl, corePathEl, sparkPathEl].forEach((el) => {
      if (!el) return;
      el.setAttribute("d", d);
    });

    if (haloPathEl) {
      haloPathEl.setAttribute("stroke", `rgba(140, 200, 255, ${haloOpacity.toFixed(3)})`);
      haloPathEl.setAttribute("stroke-width", String(haloWidth));
      haloPathEl.setAttribute("stroke-linecap", "round");
    }
    if (glowPathEl) {
      glowPathEl.setAttribute("stroke", `rgba(168, 120, 255, ${glowOpacity.toFixed(3)})`);
      glowPathEl.setAttribute("stroke-width", String(glowWidth));
      glowPathEl.setAttribute("stroke-linecap", "round");
    }
    if (corePathEl) {
      corePathEl.setAttribute("stroke-width", String(coreWidth));
      corePathEl.setAttribute("stroke-linecap", "round");
      corePathEl.style.opacity = String(coreOpacity);
    }
    if (sparkPathEl) {
      const len = Math.max(140, Math.hypot(to.x - from.x, to.y - from.y) * 1.5);
      sparkPathEl.setAttribute("stroke-width", String(1.6 + pulseB * 0.8));
      sparkPathEl.setAttribute("stroke-dasharray", `6 14 3 ${len}`);
      sparkPathEl.setAttribute("stroke-dashoffset", String(-pulsePhase * 52));
      sparkPathEl.style.opacity = String(0.28 + progress * 0.35 + pulseA * 0.18);
    }

    layerEl.style.setProperty("--prep-arc-pulse", String(pulseA));
    layerEl.classList.remove("hidden");
    layerEl.classList.remove("prep-drag-arc-layer--fade");
  }

  function schedulePulse() {
    if (rafId != null) return;
    rafId = requestAnimationFrame((ts) => {
      rafId = null;
      if (!active) return;
      pulsePhase = ts * 0.0032;
      const from = { x: fromX, y: fromY };
      const to = { x: lastTargetX, y: lastTargetY };
      const controls = arcControls(from, to, viewportMin());
      renderArc(from, controls, to, lastProgress);
      schedulePulse();
    });
  }

  function isPrepShopBenchDrag() {
    if (typeof phase === "undefined" || phase !== "prep") return false;
    if (typeof dragFrom === "undefined" || !dragFrom) return false;
    return dragFrom.type === "shop" || dragFrom.type === "bench";
  }

  function sampleArc(from, controls, to, t) {
    return cubicBezier(from, controls.c1, controls.c2, to, t);
  }

  function begin({ fromX: fx, fromY: fy }) {
    if (typeof phase !== "undefined" && phase !== "prep") return;
    active = true;
    fromX = fx;
    fromY = fy;
    lastTargetX = fx;
    lastTargetY = fy;
    lastProgress = 0;
    lastRotation = 0;
    pulsePhase = 0;
    ensureLayer();
    schedulePulse();
  }

  function resolveGhostPosition(clientX, clientY, targetX, targetY) {
    if (!active) return { x: targetX, y: targetY, rotation: 0, progress: 1 };

    const from = { x: fromX, y: fromY };
    const to = { x: targetX, y: targetY };
    const pointer = { x: clientX, y: clientY };
    const span = Math.hypot(to.x - from.x, to.y - from.y);

    if (span < MIN_SPAN_PX) {
      return { x: targetX, y: targetY, rotation: 0, progress: 1 };
    }

    const controls = arcControls(from, to, viewportMin());
    const progress = easeInOutSine(arcProgress(from, to, pointer));
    const pt = sampleArc(from, controls, to, progress);
    const ptNext = sampleArc(from, controls, to, Math.min(1, progress + 0.025));
    const rotation = Math.atan2(ptNext.y - pt.y, ptNext.x - pt.x) * (180 / Math.PI);

    lastTargetX = targetX;
    lastTargetY = targetY;
    lastProgress = progress;
    lastRotation = rotation;

    return { x: pt.x, y: pt.y, rotation, progress };
  }

  function sync(clientX, clientY, targetX, targetY) {
    if (!active) return;
    resolveGhostPosition(clientX, clientY, targetX, targetY);
    const from = { x: fromX, y: fromY };
    const to = { x: targetX, y: targetY };
    const controls = arcControls(from, to, viewportMin());
    renderArc(from, controls, to, lastProgress);
  }

  function end() {
    active = false;
    lastProgress = 0;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (!layerEl) return;
    layerEl.classList.add("prep-drag-arc-layer--fade");
    window.setTimeout(() => {
      if (active) return;
      layerEl?.classList.add("hidden");
      layerEl?.classList.remove("prep-drag-arc-layer--fade");
    }, 160);
    getDragGhostCanvas?.()?.classList.remove("ui-drag-ghost--arc-flight");
  }

  function isActive() {
    return active && isPrepShopBenchDrag();
  }

  return {
    begin,
    sync,
    end,
    isActive,
    resolveGhostPosition,
    getGhostRotation: () => lastRotation,
  };
})();

if (typeof window !== "undefined") {
  window.PrepDragArc = PrepDragArc;
}
