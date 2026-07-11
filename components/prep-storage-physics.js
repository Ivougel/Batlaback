/**
 * Prep storage physics — хранилище BB classic/versus: предметы падают, сталкиваются, лежат кучей.
 */

const PrepStoragePhysics = (() => {
  const MAX_DT = 0.032;
  const PHYS = {
    gravity: 920,
    restitution: 0.38,
    wallFriction: 0.78,
    airDrag: 3.4,
    angularDrag: 5.2,
    sleepSpeed: 6,
    sleepAng: 0.08,
    subSteps: 2,
    cellPx: 22,
  };

  let mountEl = null;
  let arenaEl = null;
  let bodiesLayer = null;
  let activeSide = "player";
  let bodies = new Map();
  /** uid предметов в активном drag/fling — sync не удаляет body, пока предмет «в руке». */
  const dragHeldUids = new Set();
  let arenaW = 0;
  let arenaH = 0;
  let tickAcc = 0;
  let pointerBound = false;
  let pointerHandler = null;
  let resizeObs = null;

  function isActive() {
    if (typeof phase !== "undefined" && phase !== "prep") return false;
    const appPhase = typeof document !== "undefined"
      ? document.getElementById("app")?.dataset?.phase
      : null;
    if (appPhase && appPhase !== "prep") return false;
    return typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics();
  }

  function syncMountGeometry() {
    if (!mountEl) return;
    const chrome = document.getElementById("bottom-chrome");
    let bottom = 0;
    if (chrome && !chrome.classList.contains("hidden")) {
      const style = typeof getComputedStyle === "function" ? getComputedStyle(chrome) : null;
      if (style?.display !== "none") {
        const cr = chrome.getBoundingClientRect();
        if (cr.height > 0) bottom = Math.ceil(cr.height);
      }
    }
    const prevBottom = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--prep-storage-mount-bottom"),
    ) || 0;
    if (Math.abs(prevBottom - bottom) > 0.5) {
      document.documentElement.style.setProperty("--prep-storage-mount-bottom", `${bottom}px`);
    }
    mountEl.style.left = "0";
    mountEl.style.right = "0";
    mountEl.style.width = "100vw";
    mountEl.style.maxWidth = "none";
    measureArena();
  }

  function getArenaClientRect() {
    if (!arenaEl) return null;
    const r = arenaEl.getBoundingClientRect();
    return r.width > 4 && r.height > 4 ? r : null;
  }

  /** Полоса хранилища — на всю ширину экрана. */
  function getStorageBandRect() {
    const arena = getArenaClientRect();
    if (arena) return arena;
    const bottom = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--prep-storage-mount-bottom"),
    ) || 44;
    const h = arenaH > 1 ? arenaH : 96;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const top = Math.max(0, vh - bottom - h);
    return {
      left: 0,
      top,
      right: vw,
      bottom: top + h,
      width: vw,
      height: h,
    };
  }

  function clientToLocal(clientX, clientY, unclamped = false) {
    const r = getArenaClientRect() || getStorageBandRect();
    if (!r) return null;
    const x = clientX - r.left;
    const y = clientY - r.top;
    if (unclamped) return { x, y };
    return {
      x: clamp(x, 0, r.width),
      y: clamp(y, 0, r.height),
    };
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function readStorageIconMetrics() {
    const fallback = { box: 62, duoW: 86, font: 50, duoFont: 43 };
    if (typeof document === "undefined") return fallback;

    const soloIcon = document.querySelector(
      '#shop-panel .shop-card:not(.empty) .shop-item-visual .icon:not(.icon--duo)',
    );
    const duoIcon = document.querySelector(
      '#shop-panel .shop-card:not(.empty) .shop-item-visual .icon.icon--duo, #shop-panel .shop-card:not(.empty) .shop-item-visual .icon.icon--stage-duo',
    );
    const refIcon = soloIcon || duoIcon || document.querySelector(
      '#shop-panel .shop-card:not(.empty) .shop-item-visual .icon',
    );

    if (refIcon) {
      const cs = getComputedStyle(refIcon);
      const box = Math.max(refIcon.offsetWidth, refIcon.offsetHeight) || fallback.box;
      const font = parseFloat(cs.fontSize) || fallback.font;
      const duoW = duoIcon
        ? Math.max(duoIcon.offsetWidth, refIcon.offsetHeight)
        : box * 1.38;
      const duoFont = duoIcon
        ? parseFloat(getComputedStyle(duoIcon).fontSize) || font * 0.86
        : font * 0.86;
      return {
        box,
        duoW: Math.max(duoW, box),
        font,
        duoFont,
      };
    }

    return fallback;
  }

  function isItemIconDuo(itemId) {
    const def = ITEM_CATALOG?.[itemId];
    const icons = typeof getItemIcons === "function" ? getItemIcons(def) : [];
    return icons.length > 1;
  }

  function getItemRadius(itemId) {
    const { box, duoW } = readStorageIconMetrics();
    if (isItemIconDuo(itemId)) {
      return Math.max(duoW, box) / 2;
    }
    const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
    const shape = typeof normalizeItemShape === "function"
      ? normalizeItemShape(def?.shape)
      : [[0, 0]];
    const bounds = typeof getShapeBounds === "function"
      ? getShapeBounds(shape)
      : { cols: 1, rows: 1 };
    const dim = Math.max(bounds.cols, bounds.rows, 1);
    if (dim <= 1) return box / 2;
    return (box * Math.min(dim, 2.2) * 0.72) / 2;
  }

  function getItemMass(itemId) {
    const r = getItemRadius(itemId);
    return r * r * 0.02;
  }

  function getItemEmoji(itemId) {
    const def = ITEM_CATALOG?.[itemId];
    if (!def) return "📦";
    const icons = typeof getItemIcons === "function" ? getItemIcons(def) : [];
    return icons.join("") || def.icon || "📦";
  }

  function buildStorageGlyphHtml(itemId) {
    const def = ITEM_CATALOG?.[itemId];
    const color = def?.color || "#58a6ff";
    const icons = typeof getItemIcons === "function" ? getItemIcons(def) : [];
    const metrics = readStorageIconMetrics();
    const duo = icons.length > 1;
    const fontPx = duo ? metrics.duoFont : metrics.font;
    let inner = "📦";
    if (icons.length === 1) {
      inner = `<span class="icon-glyph" aria-hidden="true">${icons[0]}</span>`;
    } else if (icons.length > 1) {
      inner = `<span class="icon-duo" aria-hidden="true">${icons.map((glyph) => `<span class="icon-glyph">${glyph}</span>`).join("")}</span>`;
    } else if (def?.icon) {
      inner = `<span class="icon-glyph" aria-hidden="true">${def.icon}</span>`;
    }
    const duoClass = duo ? " prep-storage-item-glyph--duo" : "";
    return `<span class="prep-storage-item-glyph${duoClass}" style="--item-color:${color};font-size:${fontPx}px">${inner}</span>`;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function measureArena() {
    if (!arenaEl) return;
    const r = arenaEl.getBoundingClientRect();
    arenaW = Math.max(1, r.width);
    arenaH = Math.max(1, r.height);
    arenaEl.style.setProperty("--prep-storage-arena-h", `${Math.round(arenaH)}px`);
  }

  function clampClientToStorageBand(clientX, clientY) {
    const band = getStorageBandRect();
    const pad = 18;
    return {
      x: clamp(clientX, band.left + pad, band.right - pad),
      y: clamp(clientY, band.top + pad, band.bottom - pad),
    };
  }

  function beginBenchDragFromBody(benchIndex, e) {
    if (!isActive() || e.button !== 0) return;
    if (typeof phase !== "undefined" && phase !== "prep") return;
    const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
    if (typeof canEditPrepSide === "function" && !canEditPrepSide(side)) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof beginPendingBenchDrag === "function") {
      beginPendingBenchDrag(benchIndex, e, side);
    } else if (typeof startBenchDrag === "function") {
      startBenchDrag(benchIndex, e, side);
    }
  }

  function resolveWallCollision(body) {
    const r = body.radius;
    const rest = PHYS.restitution;
    const fric = PHYS.wallFriction;
    if (body.x - r < 0) {
      body.x = r;
      body.vx = Math.abs(body.vx) * rest;
    } else if (body.x + r > arenaW) {
      body.x = arenaW - r;
      body.vx = -Math.abs(body.vx) * rest;
    }
    if (body.y - r < 0) {
      body.y = r;
      body.vy = Math.abs(body.vy) * rest;
    } else if (body.y + r > arenaH) {
      body.y = arenaH - r;
      body.vy = -Math.abs(body.vy) * rest;
      body.vx *= fric;
      body.rotVel *= 0.82;
    }
  }

  function resolveBodyCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;
    if (dist >= minDist || dist < 0.001) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const totalMass = a.mass + b.mass;
    a.x -= nx * overlap * (b.mass / totalMass);
    a.y -= ny * overlap * (b.mass / totalMass);
    b.x += nx * overlap * (a.mass / totalMass);
    b.y += ny * overlap * (b.mass / totalMass);

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const relVel = rvx * nx + rvy * ny;
    if (relVel >= 0) return;

    const impulse = (-(1 + PHYS.restitution) * relVel) / (1 / a.mass + 1 / b.mass);
    a.vx -= (impulse / a.mass) * nx;
    a.vy -= (impulse / a.mass) * ny;
    b.vx += (impulse / b.mass) * nx;
    b.vy += (impulse / b.mass) * ny;

    const tangentImpulse = (rvx * -ny + rvy * nx) * 0.22;
    a.rotVel -= tangentImpulse / a.radius;
    b.rotVel += tangentImpulse / b.radius;
    a.awake = true;
    b.awake = true;
  }

  function applyAirDrag(body, dt) {
    const drag = Math.exp(-PHYS.airDrag * dt);
    body.vx *= drag;
    body.vy *= drag;
    body.rotVel *= Math.exp(-PHYS.angularDrag * dt);
  }

  function stepPhysics(dt) {
    if (!isActive() || !arenaEl || arenaW < 1 || arenaH < 1) return false;
    const subDt = dt / PHYS.subSteps;
    let anyAwake = false;

    for (let step = 0; step < PHYS.subSteps; step += 1) {
      const list = [...bodies.values()];
      list.forEach((body) => {
        if (!body.awake) return;
        body.vy += PHYS.gravity * subDt;
        applyAirDrag(body, subDt);
        body.x += body.vx * subDt;
        body.y += body.vy * subDt;
        body.rotation += body.rotVel * subDt;
        resolveWallCollision(body);
      });

      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          if (list[i].awake || list[j].awake) resolveBodyCollision(list[i], list[j]);
        }
      }
    }

    bodies.forEach((body) => {
      const speed = Math.hypot(body.vx, body.vy);
      if (body.awake && speed < PHYS.sleepSpeed && Math.abs(body.rotVel) < PHYS.sleepAng) {
        body.awake = false;
        body.vx = 0;
        body.vy = 0;
        body.rotVel = 0;
      }
      if (body.awake) anyAwake = true;
      if (body.el) {
        body.el.style.transform = `translate(${body.x - body.radius}px, ${body.y - body.radius}px) rotate(${body.rotation}rad)`;
        body.el.style.zIndex = String(10 + Math.round(body.y));
      }
    });

    return anyAwake;
  }

  function persistBodyToEntry(body) {
    if (!body?.entry || arenaW < 1 || arenaH < 1) return;
    body.entry.storageX = body.x / arenaW;
    body.entry.storageY = body.y / arenaH;
    body.entry.storageRot = body.rotation;
  }

  function createBodyEl(body) {
    const el = document.createElement("div");
    el.className = "prep-storage-body";
    el.dataset.uid = body.uid;
    el.dataset.bench = String(body.benchIndex ?? "");
    const size = body.radius * 2;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = buildStorageGlyphHtml(body.itemId);
    el.addEventListener("pointerdown", (e) => {
      const idx = Number(el.dataset.bench);
      if (Number.isFinite(idx) && idx >= 0) beginBenchDragFromBody(idx, e);
    });
    if (el.dataset.itemTipBound !== "1" && typeof bindItemTooltipEvents === "function" && body.entry) {
      bindItemTooltipEvents(el, body.entry.itemId, body.entry, "bench");
      el.dataset.itemTipBound = "1";
    }
    bodiesLayer.appendChild(el);
    body.el = el;
    el.style.transform = `translate(${body.x - body.radius}px, ${body.y - body.radius}px) rotate(${body.rotation}rad)`;
    el.style.zIndex = String(10 + Math.round(body.y));
  }

  function defaultSpawnXY(radius) {
    const margin = radius + 4;
    return {
      x: margin + Math.random() * Math.max(1, arenaW - margin * 2),
      y: margin + Math.random() * Math.max(8, arenaH * 0.35),
    };
  }

  function upsertBody(entry, benchIndex, opts = {}) {
    if (!entry?.uid) return null;
    measureArena();
    let body = bodies.get(entry.uid);
    const radius = getItemRadius(entry.itemId);
    const mass = getItemMass(entry.itemId);

    if (!body) {
      const pos = opts.x != null && opts.y != null
        ? { x: opts.x, y: opts.y }
        : (entry.storageX != null && entry.storageY != null
          ? { x: entry.storageX * arenaW, y: entry.storageY * arenaH }
          : defaultSpawnXY(radius));
      body = {
        uid: entry.uid,
        itemId: entry.itemId,
        entry,
        benchIndex,
        radius,
        mass,
        x: clamp(pos.x, radius, arenaW - radius),
        y: clamp(pos.y, radius, arenaH - radius),
        rotation: opts.rotation ?? entry.storageRot ?? (Math.random() - 0.5) * 0.5,
        vx: opts.vx ?? 0,
        vy: opts.vy ?? 0,
        rotVel: opts.rotVel ?? (Math.random() - 0.5) * 2.5,
        awake: opts.awake ?? !prefersReducedMotion(),
        el: null,
      };
      bodies.set(entry.uid, body);
      createBodyEl(body);
    } else {
      body.entry = entry;
      body.benchIndex = benchIndex;
      body.radius = radius;
      body.mass = mass;
      if (body.el) {
        body.el.dataset.bench = String(benchIndex);
        const size = radius * 2;
        body.el.style.width = `${size}px`;
        body.el.style.height = `${size}px`;
      }
      if (opts.x != null) body.x = clamp(opts.x, radius, arenaW - radius);
      if (opts.y != null) body.y = clamp(opts.y, radius, arenaH - radius);
      if (opts.rotation != null) body.rotation = opts.rotation;
      if (opts.vx != null) body.vx = opts.vx;
      if (opts.vy != null) body.vy = opts.vy;
      if (opts.rotVel != null) body.rotVel = opts.rotVel;
      if (opts.awake != null) body.awake = opts.awake;
      if (body.el && !dragHeldUids.has(entry.uid)) {
        body.el.hidden = false;
      }
    }
    return body;
  }

  function removeBody(uid) {
    const body = bodies.get(uid);
    if (!body) return;
    body.el?.remove();
    bodies.delete(uid);
  }

  function bindPointer() {
    if (pointerHandler) return;
    pointerHandler = (e) => {
      if (!isActive() || e.button !== 0) return;
      if (typeof phase !== "undefined" && phase !== "prep") return;
      if (e.target?.closest?.(".prep-storage-body, .prep-screen-flier, #shop-panel .shop-card, #btn-fight, #prep-top-bar")) {
        return;
      }
      const idx = hitTestBenchIndex(e.clientX, e.clientY);
      if (idx < 0) return;
      beginBenchDragFromBody(idx, e);
    };
    document.addEventListener("pointerdown", pointerHandler, { capture: true });
    pointerBound = true;
  }

  function ensureMountRoot() {
    let root = document.getElementById("prep-storage-mount");
    if (!root) {
      root = document.createElement("div");
      root.id = "prep-storage-mount";
      root.className = "prep-storage-mount";
      document.body.appendChild(root);
    }
    return root;
  }

  function mount(_container) {
    if (mountEl && arenaEl) {
      syncMountGeometry();
      return;
    }
    unmount();
    mountEl = ensureMountRoot();
    mountEl.innerHTML = "";
    arenaEl = document.createElement("div");
    arenaEl.id = "prep-storage-arena";
    arenaEl.className = "prep-storage-arena";
    arenaEl.setAttribute("role", "region");
    arenaEl.setAttribute("aria-label", "Хранилище");
    bodiesLayer = document.createElement("div");
    bodiesLayer.className = "prep-storage-bodies";
    arenaEl.appendChild(bodiesLayer);
    mountEl.appendChild(arenaEl);
    bindPointer();
    syncMountGeometry();
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(() => syncMountGeometry());
      resizeObs.observe(arenaEl);
      const chrome = document.getElementById("bottom-chrome");
      if (chrome) resizeObs.observe(chrome);
    }
    window.addEventListener("resize", syncMountGeometry);
  }

  function unmount() {
    if (resizeObs) {
      resizeObs.disconnect();
      resizeObs = null;
    }
    window.removeEventListener("resize", syncMountGeometry);
    if (pointerHandler) {
      document.removeEventListener("pointerdown", pointerHandler, { capture: true });
      pointerHandler = null;
    }
    pointerBound = false;
    bodies.forEach((b) => b.el?.remove());
    bodies.clear();
    const root = document.getElementById("prep-storage-mount");
    root?.remove();
    mountEl = null;
    arenaEl = null;
    bodiesLayer = null;
  }

  function sync(side = typeof prepViewSide !== "undefined" ? prepViewSide : "player") {
    if (!isActive()) {
      unmount();
      return;
    }
    if (!arenaEl) mount();
    syncMountGeometry();
    activeSide = side;
    const st = typeof getSideState === "function" ? getSideState(side) : null;
    if (!st?.bench) return;

    const seen = new Set();
    st.bench.forEach((entry, index) => {
      if (!entry?.uid) return;
      seen.add(entry.uid);
      const body = upsertBody(entry, index);
      if (body?.el && !dragHeldUids.has(entry.uid)) body.el.hidden = false;
    });

    bodies.forEach((body, uid) => {
      if (!seen.has(uid) && !dragHeldUids.has(uid)) removeBody(uid);
    });
  }

  function clearDragHold(uid) {
    if (!uid) return;
    dragHeldUids.delete(uid);
    showBody(uid);
  }

  function releaseDragHold(uid) {
    if (!uid) return;
    clearDragHold(uid);
    removeBody(uid);
  }

  function hideBody(uid) {
    const body = bodies.get(uid);
    if (body?.el) body.el.hidden = true;
  }

  function showBody(uid) {
    const body = bodies.get(uid);
    if (body?.el) body.el.hidden = false;
  }

  function spawnAtDrop(entry, clientX, clientY, side, velocity = null) {
    if (!entry || !isActive()) return;
    clearDragHold(entry.uid);
    const local = clientToLocal(clientX, clientY);
    if (!local) return;
    const radius = getItemRadius(entry.itemId);
    const vx = velocity?.vx ?? (Math.random() - 0.5) * 80;
    const vy = velocity?.vy ?? (Math.random() - 0.5) * 50;
    const body = upsertBody(entry, -1, {
      x: local.x,
      y: local.y,
      vx,
      vy,
      rotVel: velocity?.rotVel ?? (vx * 0.003 + (Math.random() - 0.5) * 3),
      awake: true,
    });
    if (body) {
      body.x = clamp(local.x, radius, arenaW - radius);
      body.y = clamp(local.y, radius, arenaH - radius);
      if (body.el) body.el.hidden = false;
      persistBodyToEntry(body);
    }
    sync(side);
  }

  /** Бросок внутри хранилища — скорость от жеста drag (px/s). */
  function releaseAtDrop(entry, clientX, clientY, vx, vy, side) {
    if (!entry || !isActive()) return;
    clearDragHold(entry.uid);
    syncMountGeometry();
    const local = clientToLocal(clientX, clientY, true) || clientToLocal(clientX, clientY);
    if (!local) return;
    const radius = getItemRadius(entry.itemId);
    const tossVx = clamp(vx || 0, -1100, 1100);
    const tossVy = clamp(vy || 0, -1600, 900);
    const body = upsertBody(entry, -1, {
      x: clamp(local.x, radius, arenaW - radius),
      y: clamp(local.y, radius, arenaH - radius),
      vx: tossVx,
      vy: tossVy,
      rotVel: tossVx * 0.0045 + tossVy * 0.0012 + (Math.random() - 0.5) * 2,
      awake: true,
    });
    if (body?.el) body.el.hidden = false;
    if (body) persistBodyToEntry(body);
    sync(side);
  }

  function spawnFromInbound(entry, clientX, clientY, side) {
    if (!entry || !isActive()) return;
    const local = clientToLocal(clientX, clientY) || defaultSpawnXY(getItemRadius(entry.itemId));
    const body = upsertBody(entry, -1, {
      x: local.x,
      y: Math.max(getItemRadius(entry.itemId), local.y - 12),
      vx: (Math.random() - 0.5) * 180,
      vy: -60 - Math.random() * 90,
      rotVel: (Math.random() - 0.5) * 6,
      awake: true,
    });
    if (body) persistBodyToEntry(body);
    sync(side);
  }

  function getInboundTarget(side, slotOffset = 0) {
    const r = getArenaClientRect();
    if (!r) return getBenchSlotClientPoint?.(side, slotOffset) ?? { x: window.innerWidth / 2, y: window.innerHeight - 48 };
    const margin = 24;
    return {
      x: r.left + margin + Math.random() * Math.max(1, r.width - margin * 2),
      y: r.top + r.height * (0.25 + Math.random() * 0.35),
    };
  }

  function isPointerInside(clientX, clientY) {
    if (!isActive()) return false;
    const r = getStorageBandRect();
    if (!r) return false;
    const pad = typeof isTouchUi === "function" && isTouchUi() ? 12 : 4;
    return clientX >= r.left - pad && clientX <= r.right + pad
      && clientY >= r.top - pad && clientY <= r.bottom + pad;
  }

  function hitTestBenchIndex(clientX, clientY) {
    if (!isActive()) return -1;
    const side = typeof prepViewSide !== "undefined" ? prepViewSide : activeSide;
    const st = typeof getSideState === "function" ? getSideState(side) : null;
    if (!st?.bench?.length) return -1;

    const hits = [...bodies.values()]
      .map((b) => {
        if (b.el?.hidden) return null;
        if (!st.bench.some((e) => e.uid === b.uid)) return null;
        let cx;
        let cy;
        let hitR;
        if (b.el) {
          const br = b.el.getBoundingClientRect();
          cx = br.left + br.width / 2;
          cy = br.top + br.height / 2;
          hitR = Math.max(br.width, br.height) * 0.58;
        } else {
          const r = getArenaClientRect() || getStorageBandRect();
          if (!r) return null;
          cx = r.left + b.x;
          cy = r.top + b.y;
          hitR = b.radius * 1.35;
        }
        const dx = clientX - cx;
        const dy = clientY - cy;
        return dx * dx + dy * dy <= hitR * hitR ? { body: b, depth: cy } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.depth - a.depth);

    if (!hits.length) return -1;
    const uid = hits[0].body.uid;
    return st.bench.findIndex((e) => e.uid === uid);
  }

  function ensureBenchEntryInteractive(entry, side, clientX, clientY, vx = 0, vy = 0) {
    if (!entry?.uid || !isActive()) return false;
    const st = typeof getSideState === "function" ? getSideState(side) : null;
    if (!st?.bench) return false;
    if (!st.bench.some((e) => e.uid === entry.uid)) {
      st.bench.push(entry);
    }
    clearDragHold(entry.uid);
    const land = clampClientToStorageBand(clientX, clientY);
    releaseAtDrop(entry, land.x, land.y, vx, vy, side);
    if (typeof renderBench === "function") renderBench(side);
    return true;
  }

  function absorbAtClient(dragFrom, dragPayload, clientX, clientY, vx, vy, side) {
    if (!dragFrom || !dragPayload || !isActive()) return false;
    const st = typeof getSideState === "function" ? getSideState(side) : null;
    if (!st) return false;

    let entry = null;
    if (dragFrom.type === "bench" && dragFrom.benchEntry) {
      entry = dragFrom.benchEntry;
      if (!st.bench.some((e) => e.uid === entry.uid)) {
        st.bench.push(entry);
      }
      dragFrom.benchEntry = null;
    } else if (dragFrom.type === "item") {
      entry = {
        itemId: dragFrom.item.itemId,
        uid: dragFrom.item.uid,
        rotation: dragPayload.rotation || 0,
      };
      if (!st.bench.some((e) => e.uid === entry.uid)) st.bench.push(entry);
    } else if (dragFrom.type === "container") {
      entry = {
        itemId: dragFrom.container.itemId,
        uid: dragFrom.container.uid,
        rotation: dragPayload.rotation || 0,
        carriedItems: dragFrom.carriedItems,
        originCol: dragFrom.container.col,
        originRow: dragFrom.container.row,
      };
      if (!st.bench.some((e) => e.uid === entry.uid)) st.bench.push(entry);
    } else if (dragFrom.type === "shop") {
      if (typeof commitShopPurchase === "function") {
        const itemId = commitShopPurchase(dragFrom.index, side);
        if (!itemId) return false;
        entry = {
          itemId,
          uid: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          rotation: dragPayload.rotation || 0,
        };
        st.bench.push(entry);
      }
    }
    if (!entry) return false;
    return ensureBenchEntryInteractive(entry, side, clientX, clientY, vx || 0, vy || 0);
  }

  function onDragStart(entry) {
    if (!entry?.uid) return;
    dragHeldUids.add(entry.uid);
    const body = bodies.get(entry.uid);
    if (!body) return;
    body.awake = false;
    body.vx = 0;
    body.vy = 0;
    body.rotVel = 0;
    if (body.el) body.el.hidden = true;
  }

  function onDragCancel(entry) {
    if (!entry?.uid) return;
    clearDragHold(entry.uid);
    const body = bodies.get(entry.uid);
    if (!body) {
      const side = typeof prepViewSide !== "undefined" ? prepViewSide : activeSide;
      sync(side);
      return;
    }
    body.awake = false;
    body.vx = 0;
    body.vy = 0;
    body.rotVel = 0;
  }

  function tick(dt) {
    if (isScreenFlingEnabled()) tickScreen(dt);

    if (!isActive() || !arenaEl) return;
    const anyAwake = [...bodies.values()].some((body) => body.awake);
    if (!anyAwake && (!isScreenFlingEnabled() || !screenFliers.length)) {
      tickAcc = 0;
      return;
    }
    tickAcc += dt;
    const step = prefersReducedMotion() ? 0.05 : 1 / 50;
    let stepped = false;
    while (tickAcc >= step) {
      const awake = stepPhysics(step);
      tickAcc -= step;
      stepped = true;
      if (!awake && tickAcc < step) break;
    }
    if (stepped) {
      bodies.forEach(persistBodyToEntry);
    }
  }

  function saveAll(side) {
    const st = typeof getSideState === "function" ? getSideState(side) : null;
    if (!st?.bench) return;
    st.bench.forEach((entry, i) => {
      const body = bodies.get(entry.uid);
      if (body) {
        body.benchIndex = i;
        persistBodyToEntry(body);
      }
    });
  }

  // --- Полноэкранный бросок (как в оригинале BB): летит по viewport, сетка только при drop в инвентарь ---

  const SCREEN_PHYS = {
    gravity: 1180,
    restitution: 0.5,
    wallFriction: 0.84,
    airDrag: 1.6,
    angularDrag: 2.8,
    sleepSpeed: 22,
    sleepAng: 0.12,
    captureSpeed: 160,
    subSteps: 2,
  };

  let screenLayer = null;
  let screenFliers = [];
  let screenTickAcc = 0;

  function isScreenFlingEnabled() {
    if (typeof shouldUseBBStackPrepLayout !== "function" || !shouldUseBBStackPrepLayout()) return false;
    if (typeof phase !== "undefined" && phase !== "prep") return false;
    return true;
  }

  function cloneDragFrom(src) {
    if (!src) return null;
    const copy = { ...src };
    if (src.benchEntry) copy.benchEntry = { ...src.benchEntry };
    if (src.item) copy.item = { ...src.item };
    if (src.container) copy.container = { ...src.container };
    if (src.carriedItems) copy.carriedItems = src.carriedItems.map((c) => ({ ...c }));
    return copy;
  }

  function ensureScreenLayer() {
    if (screenLayer) return;
    screenLayer = document.createElement("div");
    screenLayer.id = "prep-screen-fling-layer";
    screenLayer.className = "prep-screen-fling-layer";
    screenLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(screenLayer);
  }

  function getViewportSize() {
    const vv = window.visualViewport;
    return {
      w: Math.max(1, vv?.width ?? window.innerWidth),
      h: Math.max(1, vv?.height ?? window.innerHeight),
      left: vv?.offsetLeft ?? 0,
      top: vv?.offsetTop ?? 0,
    };
  }

  /** Нижняя граница для полётов — не заходить под #bottom-chrome. */
  function getBottomChromeFloorY(radius = 0) {
    const chrome = document.getElementById("bottom-chrome");
    if (!chrome || chrome.classList.contains("hidden")) {
      return (window.visualViewport?.height ?? window.innerHeight) - radius;
    }
    const style = typeof getComputedStyle === "function" ? getComputedStyle(chrome) : null;
    if (style?.display === "none") {
      return (window.visualViewport?.height ?? window.innerHeight) - radius;
    }
    const cr = chrome.getBoundingClientRect();
    if (cr.height <= 0) {
      return (window.visualViewport?.height ?? window.innerHeight) - radius;
    }
    return cr.top - radius - 2;
  }

  function createFlierEl(flier) {
    const el = document.createElement("div");
    el.className = "prep-screen-flier";
    const size = flier.radius * 2;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = buildStorageGlyphHtml(flier.itemId);
    screenLayer.appendChild(el);
    flier.el = el;
    el.style.transform = `translate(${flier.x - flier.radius}px, ${flier.y - flier.radius}px) rotate(${flier.rotation}rad)`;
  }

  function resolveScreenWall(flier, vp) {
    const r = flier.radius;
    const rest = SCREEN_PHYS.restitution;
    const fric = SCREEN_PHYS.wallFriction;
    const minX = vp.left + r;
    const maxX = vp.left + vp.w - r;
    const minY = vp.top + r;
    const maxY = Math.min(vp.top + vp.h - r, getBottomChromeFloorY(r));
    if (flier.x < minX) {
      flier.x = minX;
      flier.vx = Math.abs(flier.vx) * rest;
    } else if (flier.x > maxX) {
      flier.x = maxX;
      flier.vx = -Math.abs(flier.vx) * rest;
    }
    if (flier.y < minY) {
      flier.y = minY;
      flier.vy = Math.abs(flier.vy) * rest;
    } else if (flier.y > maxY) {
      flier.y = maxY;
      flier.vy = -Math.abs(flier.vy) * rest;
      flier.vx *= fric;
      flier.rotVel *= 0.84;
      if (Math.hypot(flier.vx, flier.vy) < SCREEN_PHYS.captureSpeed * 1.5) {
        flier.awake = false;
        flier.vx = 0;
        flier.vy = 0;
        flier.rotVel = 0;
      }
    }
  }

  function stepScreenFliers(dt) {
    if (!screenFliers.length) return false;
    const vp = getViewportSize();
    const subDt = dt / SCREEN_PHYS.subSteps;
    let anyAwake = false;

    for (let step = 0; step < SCREEN_PHYS.subSteps; step += 1) {
      screenFliers.forEach((flier) => {
        if (!flier.awake) return;
        flier.vy += SCREEN_PHYS.gravity * subDt;
        const drag = Math.exp(-SCREEN_PHYS.airDrag * subDt);
        flier.vx *= drag;
        flier.vy *= drag;
        flier.rotVel *= Math.exp(-SCREEN_PHYS.angularDrag * subDt);
        flier.x += flier.vx * subDt;
        flier.y += flier.vy * subDt;
        flier.rotation += flier.rotVel * subDt;
        resolveScreenWall(flier, vp);
      });

      const list = screenFliers.filter((f) => f.awake);
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.radius + b.radius;
          if (dist >= minDist || dist < 0.001) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const relVel = rvx * nx + rvy * ny;
          if (relVel >= 0) continue;
          const impulse = (-(1 + SCREEN_PHYS.restitution) * relVel) / 2;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;
        }
      }
    }

    const settling = [];
    screenFliers.forEach((flier) => {
      flier.age = (flier.age || 0) + dt;
      const speed = Math.hypot(flier.vx, flier.vy);
      if (flier.awake && speed < SCREEN_PHYS.sleepSpeed && Math.abs(flier.rotVel) < SCREEN_PHYS.sleepAng) {
        flier.awake = false;
        flier.vx = 0;
        flier.vy = 0;
        flier.rotVel = 0;
      }
      if (flier.awake && isInStorageBand(flier.x, flier.y) && speed < SCREEN_PHYS.captureSpeed) {
        flier.awake = false;
        flier.vx = 0;
        flier.vy = 0;
        flier.rotVel = 0;
      }
      if (flier.age > 3.5) {
        flier.awake = false;
        flier.vx = 0;
        flier.vy = 0;
        flier.rotVel = 0;
      }
      if (!flier.awake) settling.push(flier);
      if (flier.awake) anyAwake = true;
      if (flier.el) {
        flier.el.style.transform = `translate(${flier.x - flier.radius}px, ${flier.y - flier.radius}px) rotate(${flier.rotation}rad)`;
        flier.el.style.zIndex = String(200 + Math.round(flier.y));
      }
    });

    const settled = new Set();
    settling.forEach((flier) => {
      if (settled.has(flier)) return;
      settled.add(flier);
      resolveScreenFlier(flier);
    });
    return anyAwake || screenFliers.length > 0;
  }

  function isInStorageBand(clientX, clientY) {
    return isPointerInside(clientX, clientY);
  }

  function removeScreenFlier(flier) {
    flier.el?.remove();
    screenFliers = screenFliers.filter((f) => f !== flier);
    if (!screenFliers.length && screenLayer) {
      screenLayer.innerHTML = "";
    }
  }

  function resolveScreenFlier(flier) {
    if (typeof resolvePrepScreenFlingLanding === "function") {
      resolvePrepScreenFlingLanding(flier);
    } else {
      absorbAtClient(
        flier.dragFrom,
        flier.dragPayload,
        flier.x,
        flier.y,
        flier.vx * 0.35,
        flier.vy * 0.35,
        flier.side,
      );
    }
    removeScreenFlier(flier);
  }

  function beginScreenFling(opts) {
    if (!isScreenFlingEnabled() || prefersReducedMotion()) return false;
    const itemId = opts?.dragPayload?.itemId;
    if (!itemId || !opts.dragFrom) return false;

    const heldUid = opts.dragFrom?.benchEntry?.uid || opts.dragFrom?.item?.uid;
    ensureScreenLayer();
    const radius = Math.max(18, getItemRadius(itemId) * 1.2);
    const flier = {
      dragFrom: cloneDragFrom(opts.dragFrom),
      dragPayload: { ...opts.dragPayload },
      itemId,
      side: opts.side || "player",
      x: opts.clientX,
      y: opts.clientY,
      vx: clamp((opts.vx || 0) * 1.18, -1800, 1800),
      vy: clamp((opts.vy || 0) * 1.25, -2200, 1200),
      rotation: (Math.random() - 0.5) * 0.35,
      rotVel: (opts.vx || 0) * 0.004 + (Math.random() - 0.5) * 3,
      radius,
      mass: getItemMass(itemId) * 1.3,
      awake: true,
      age: 0,
      el: null,
    };
    createFlierEl(flier);
    screenFliers.push(flier);
    if (heldUid) releaseDragHold(heldUid);
    document.documentElement.setAttribute("data-prep-screen-fling", "true");
    return true;
  }

  function hasActiveScreenFliers() {
    return screenFliers.length > 0;
  }

  function tickScreen(dt) {
    if (!screenFliers.length) {
      document.documentElement.removeAttribute("data-prep-screen-fling");
      if (typeof window.flushDeferredLayoutPasses === "function") window.flushDeferredLayoutPasses();
      if (typeof window.scheduleCanvasFit === "function") window.scheduleCanvasFit();
      return;
    }
    screenTickAcc += dt;
    const step = 1 / 60;
    while (screenTickAcc >= step) {
      stepScreenFliers(step);
      screenTickAcc -= step;
    }
  }

  return {
    mount,
    unmount,
    sync,
    tick,
    spawnAtDrop,
    releaseAtDrop,
    spawnFromInbound,
    getInboundTarget,
    isPointerInside,
    hitTestBenchIndex,
    getArenaClientRect,
    onDragStart,
    onDragCancel,
    releaseDragHold,
    saveAll,
    hideBody,
    showBody,
    beginScreenFling,
    hasActiveScreenFliers,
    absorbAtClient,
    ensureBenchEntryInteractive,
    syncMountGeometry,
    getStorageBandRect,
    clampClientToStorageBand,
  };
})();

if (typeof window !== "undefined") {
  window.PrepStoragePhysics = PrepStoragePhysics;
}
