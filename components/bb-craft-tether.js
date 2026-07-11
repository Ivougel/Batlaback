/**
 * SVG-нити крафта: магазин/скамья/курсор ↔ партнёры на поле (реф. Backpack Battles).
 */

const BBCraftTether = (() => {
  const MAX_LINES = 6;
  let layerEl = null;
  let pathEls = [];
  let glowEls = [];
  let active = false;
  let hoverMode = false;
  let rafId = null;
  let pulsePhase = 0;
  let lastSource = null;
  let lastTargets = [];
  let lastSegments = [];

  function clientToLayer(clientX, clientY) {
    const vv = window.visualViewport;
    const ox = vv?.offsetLeft ?? 0;
    const oy = vv?.offsetTop ?? 0;
    return { x: clientX - ox, y: clientY - oy };
  }

  function ensureLayer() {
    if (layerEl) return layerEl;
    layerEl = document.getElementById("bb-craft-tether-layer");
    if (!layerEl) {
      layerEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      layerEl.id = "bb-craft-tether-layer";
      layerEl.classList.add("bb-craft-tether-layer", "hidden");
      layerEl.setAttribute("aria-hidden", "true");
      document.body.appendChild(layerEl);
    }
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

  function arcPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const span = Math.hypot(dx, dy) || 1;
    const lift = Math.min(span * 0.14, 72);
    const c1x = from.x + dx * 0.22;
    const c1y = from.y - lift * 0.35;
    const c2x = to.x - dx * 0.22;
    const c2y = to.y - lift * 0.55;
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  }

  function palette(strength) {
    if (strength === "strong") {
      return {
        core: "rgba(210, 170, 255, 0.95)",
        halo: "rgba(188, 140, 255, 0.48)",
        width: 3.2,
        haloWidth: 10,
      };
    }
    return {
      core: "rgba(188, 140, 255, 0.92)",
      halo: "rgba(140, 90, 220, 0.42)",
      width: 2.6,
      haloWidth: 8,
    };
  }

  function ensurePathPool(count) {
    ensureLayer();
    while (glowEls.length < count) {
      const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("fill", "none");
      glow.classList.add("bb-craft-tether__halo");
      const core = document.createElementNS("http://www.w3.org/2000/svg", "path");
      core.setAttribute("fill", "none");
      core.classList.add("bb-craft-tether__core");
      layerEl.appendChild(glow);
      layerEl.appendChild(core);
      glowEls.push(glow);
      pathEls.push(core);
    }
  }

  function paintPathPair(glow, core, from, to, pal, dashOffset, i) {
    const d = arcPath(from, to);
    [glow, core].forEach((el) => el.setAttribute("d", d));
    glow.setAttribute("stroke", pal.halo);
    glow.setAttribute("stroke-width", String(pal.haloWidth + 2));
    glow.style.opacity = String(0.62 + Math.sin(pulsePhase * 2 + i) * 0.16);
    core.setAttribute("stroke", pal.core);
    core.setAttribute("stroke-width", String(pal.width + 0.4));
    core.setAttribute("stroke-dasharray", "8 6");
    core.setAttribute("stroke-dashoffset", String(dashOffset));
    glow.style.display = "";
    core.style.display = "";
  }

  function renderSegments(segments) {
    if (typeof shouldShowPrepCraftCommerceFx === "function"
      && !shouldShowPrepCraftCommerceFx()) {
      end();
      return;
    }

    if (!segments?.length) {
      if (!hoverMode && !lastSource) end();
      return;
    }

    ensurePathPool(segments.length);
    syncLayerSize();

    const dashOffset = -pulsePhase * 22;
    segments.forEach((segment, i) => {
      const from = clientToLayer(segment.from.x, segment.from.y);
      const to = clientToLayer(segment.to.x, segment.to.y);
      paintPathPair(glowEls[i], pathEls[i], from, to, palette(segment.strength || "strong"), dashOffset, i);
    });

    for (let i = segments.length; i < pathEls.length; i += 1) {
      glowEls[i].style.display = "none";
      pathEls[i].style.display = "none";
    }

    lastSegments = segments;
    lastSource = null;
    lastTargets = [];
    active = true;
    layerEl.classList.remove("hidden");
    schedulePulse();
  }

  function renderLines(source, targets) {
    if (typeof shouldShowPrepCraftCommerceFx === "function"
      && !shouldShowPrepCraftCommerceFx()) {
      end();
      return;
    }

    if (!source || !targets?.length) {
      end();
      return;
    }

    const from = clientToLayer(source.x, source.y);
    const limited = targets.slice(0, MAX_LINES);
    ensurePathPool(limited.length);
    syncLayerSize();

    const dashOffset = -pulsePhase * 18;
    limited.forEach((target, i) => {
      const to = clientToLayer(target.x, target.y);
      paintPathPair(glowEls[i], pathEls[i], from, to, palette(target.strength), dashOffset, i);
    });

    for (let i = limited.length; i < pathEls.length; i += 1) {
      glowEls[i].style.display = "none";
      pathEls[i].style.display = "none";
    }

    lastSource = source;
    lastTargets = limited;
    lastSegments = [];
    active = true;
    layerEl.classList.remove("hidden");
    schedulePulse();
  }

  function schedulePulse() {
    if (rafId != null) return;
    rafId = requestAnimationFrame((ts) => {
      rafId = null;
      if (!active) return;
      pulsePhase = ts * 0.002;
      if (lastSegments.length) {
        renderSegments(lastSegments);
      } else if (lastSource && lastTargets.length) {
        renderLines(lastSource, lastTargets);
      }
      if (active) schedulePulse();
    });
  }

  function sync(source, targets, opts = {}) {
    hoverMode = !!opts.hover;
    if (!source) {
      end();
      return;
    }
    lastSource = source;
    lastTargets = targets || [];
    renderLines(lastSource, lastTargets);
  }

  function showFromElement(el, targets, opts = {}) {
    if (!el) {
      end();
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      end();
      return;
    }
    sync({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, targets, opts);
  }

  function showHoverCard(cardEl, itemId, containers, items, bench, team) {
    if (typeof dragPayload !== "undefined" && dragPayload) return;
    const resolveTargets = typeof getShopCraftTetherTargetsForItem === "function"
      ? getShopCraftTetherTargetsForItem
      : getCraftTetherTargetsForItem;
    if (typeof resolveTargets !== "function") return;
    const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(team) : {};
    const targets = resolveTargets(itemId, containers, items, bench, team, ctx);
    if (!targets.length) {
      end();
      return;
    }
    showFromElement(cardEl, targets, { hover: true });
  }

  function syncDragTethers(clientX, clientY, side) {
    if (typeof resolveActiveDragCraftTetherTargets !== "function") return;
    const targets = resolveActiveDragCraftTetherTargets(side);
    if (!targets.length) {
      if (!hoverMode) end();
      return;
    }
    sync({ x: clientX, y: clientY }, targets, { hover: false });
  }

  function syncPendingBoardClusters(side) {
    if (hoverMode) return;
    if (typeof dragPayload !== "undefined" && dragPayload) return;
    if (typeof shouldShowIdlePrepBoardHighlights === "function"
      && !shouldShowIdlePrepBoardHighlights()) {
      if (!lastSource) end();
      return;
    }
    if (typeof getPendingCraftsForSide !== "function") return;

    const pending = getPendingCraftsForSide(side);
    if (!pending.length) {
      if (!lastSource) end();
      return;
    }

    const st = getSideState(side);
    const items = st.items || [];
    const uidToItem = new Map(items.map((item) => [item.uid, item]));
    const segments = [];

    pending.forEach((entry) => {
      const clusterItems = entry.itemUids
        .map((uid) => uidToItem.get(uid))
        .filter(Boolean);
      for (let i = 0; i < clusterItems.length; i += 1) {
        for (let j = i + 1; j < clusterItems.length; j += 1) {
          const from = typeof getBoardItemClientCenter === "function"
            ? getBoardItemClientCenter(clusterItems[i], side)
            : null;
          const to = typeof getBoardItemClientCenter === "function"
            ? getBoardItemClientCenter(clusterItems[j], side)
            : null;
          if (!from || !to) continue;
          segments.push({ from, to, strength: "strong" });
        }
      }
    });

    if (!segments.length) {
      if (!lastSource) end();
      return;
    }
    renderSegments(segments);
  }

  function end() {
    active = false;
    hoverMode = false;
    lastSource = null;
    lastTargets = [];
    lastSegments = [];
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pathEls.forEach((el) => { el.style.display = "none"; });
    glowEls.forEach((el) => { el.style.display = "none"; });
    layerEl?.classList.add("hidden");
  }

  return {
    sync,
    showFromElement,
    showHoverCard,
    syncDragTethers,
    syncPendingBoardClusters,
    end,
    isActive: () => active,
  };
})();

if (typeof window !== "undefined") {
  window.BBCraftTether = BBCraftTether;
}
