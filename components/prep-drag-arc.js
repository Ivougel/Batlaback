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
  let corePathEl = null;
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

  /**
   * Низкая плавная дуга вдоль хорды (магазин → поле), без высокого пика к верху экрана.
   */
  function arcControls(from, to, vmin) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const span = Math.hypot(dx, dy) || 1;
    const lift = Math.min(span * 0.1, vmin * 0.055);
    const midX = (from.x + to.x) * 0.5;
    const midY = (from.y + to.y) * 0.5;

    return {
      c1: {
        x: from.x + dx * 0.28,
        y: midY - lift * 0.35,
      },
      c2: {
        x: midX + dx * 0.12,
        y: midY - lift,
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
          <linearGradient id="prep-drag-arc-grad" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#b8a0e8" stop-opacity="0.42"/>
            <stop offset="50%" stop-color="#8ecde8" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#a99ad4" stop-opacity="0.38"/>
          </linearGradient>
        </defs>
        <path class="prep-drag-arc-halo" fill="none"/>
        <path class="prep-drag-arc-core" fill="none" stroke="url(#prep-drag-arc-grad)"/>
      `;
      document.body.appendChild(layerEl);
    }
    haloPathEl = layerEl.querySelector(".prep-drag-arc-halo");
    corePathEl = layerEl.querySelector(".prep-drag-arc-core");
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

  function updateGradientEndpoints(from, to) {
    const grad = layerEl?.querySelector("#prep-drag-arc-grad");
    if (!grad) return;
    grad.setAttribute("x1", String(from.x));
    grad.setAttribute("y1", String(from.y));
    grad.setAttribute("x2", String(to.x));
    grad.setAttribute("y2", String(to.y));
  }

  function renderArc(from, controls, to, progress) {
    ensureLayer();
    syncLayerSize();
    updateGradientEndpoints(from, to);
    const { c1, c2 } = controls;
    const d = pathD(from, c1, c2, to);

    const pulseA = pulseWave(1.05, 0);
    const pulseB = pulseWave(1.55, 0.9);
    const dashPeriod = 5 + pulseB * 1.2;
    const dashGap = 7 + pulseA * 1.5;
    const dashOffset = -pulsePhase * 18;
    const dashPattern = `${dashPeriod.toFixed(1)} ${dashGap.toFixed(1)}`;

    const haloWidth = 5 + pulseA * 2.5;
    const coreWidth = 1.35 + pulseA * 0.45;
    const haloOpacity = 0.1 + pulseA * 0.08;
    const coreOpacity = 0.34 + pulseB * 0.14;

    [haloPathEl, corePathEl].forEach((el) => {
      if (!el) return;
      el.setAttribute("d", d);
      el.setAttribute("stroke-dasharray", dashPattern);
      el.setAttribute("stroke-dashoffset", String(dashOffset));
    });

    if (haloPathEl) {
      haloPathEl.setAttribute("stroke", `rgba(148, 188, 230, ${haloOpacity.toFixed(3)})`);
      haloPathEl.setAttribute("stroke-width", String(haloWidth));
      haloPathEl.setAttribute("stroke-linecap", "round");
    }
    if (corePathEl) {
      corePathEl.setAttribute("stroke-width", String(coreWidth));
      corePathEl.setAttribute("stroke-linecap", "round");
      corePathEl.style.opacity = String(coreOpacity);
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
