/**
 * Подсветка emoji предметов — блёстки при hover / touch / tooltip на поле.
 */
(function initItemEmojiSparkle() {
  const SPARKLE_MARKUP = `<span class="item-emoji-sparkles" aria-hidden="true">`
    + `<span class="item-emoji-sparkle item-emoji-sparkle--1"></span>`
    + `<span class="item-emoji-sparkle item-emoji-sparkle--2"></span>`
    + `<span class="item-emoji-sparkle item-emoji-sparkle--3"></span>`
    + `<span class="item-emoji-sparkle item-emoji-sparkle--4"></span>`
    + `<span class="item-emoji-sparkle item-emoji-sparkle--5"></span>`
    + `<span class="item-emoji-sparkle item-emoji-sparkle--6"></span>`
    + `</span>`;

  let domSparkleOwner = null;

  function renderItemEmojiSparklesHTML() {
    return SPARKLE_MARKUP;
  }

  function hashSeed(value) {
    const str = String(value ?? 0);
    let h = 0;
    for (let i = 0; i < str.length; i += 1) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return (h & 0xffff) / 0xffff * Math.PI * 2;
  }

  function findSparkleHost(el) {
    return el?.querySelector?.(".item-emoji-sparkle-host")
      || (el?.classList?.contains("item-emoji-sparkle-host") ? el : null);
  }

  function setDomSparkleActive(el, active) {
    const host = findSparkleHost(el);
    if (!host) return;
    host.classList.toggle("is-sparkle-active", !!active);
    if (active) domSparkleOwner = el;
    else if (domSparkleOwner === el) domSparkleOwner = null;
  }

  function clearDomSparkleHighlights() {
    document.querySelectorAll(".item-emoji-sparkle-host.is-sparkle-active").forEach((host) => {
      host.classList.remove("is-sparkle-active");
    });
    domSparkleOwner = null;
  }

  function syncDomSparkleFromTooltipSource(sourceEl) {
    clearDomSparkleHighlights();
    if (!sourceEl) return;
    setDomSparkleActive(sourceEl, true);
  }

  function forEachPlacedItemEmojiCenter(item, def, team, fn) {
    if (!item || !def || typeof fn !== "function") return;
    const layout = typeof getPlacedItemVisualLayout === "function"
      ? getPlacedItemVisualLayout(item, def)
      : null;
    if (layout?.iconSlots?.length && typeof cellRect === "function") {
      const cells = typeof getItemCells === "function" ? getItemCells(item) : [];
      layout.iconSlots.forEach((slot) => {
        const rect = slot.useShapeBounds && cells.length > 1 && typeof getShapeIconDrawRect === "function"
          ? getShapeIconDrawRect(cells, (c, r) => cellRect(team, c, r))
          : cellRect(team, slot.cell[0], slot.cell[1]);
        if (!rect) return;
        const pad = typeof CELL_TILE_PAD !== "undefined" ? CELL_TILE_PAD : 3;
        const innerW = Math.max(1, rect.w - pad * 2);
        const innerH = Math.max(1, rect.h - pad * 2);
        const size = Math.min(innerW, innerH);
        fn(rect.x + rect.w / 2, rect.y + rect.h / 2, size, slot);
      });
      return;
    }
    if (typeof getItemVisualCenter === "function") {
      const center = getItemVisualCenter(item, team);
      const cell = typeof getItemIconCell === "function" ? getItemIconCell(item) : [item.col, item.row];
      let size = 28;
      if (typeof cellRect === "function" && cell) {
        const rect = cellRect(team, cell[0], cell[1]);
        size = Math.min(rect.w, rect.h);
      }
      fn(center.x, center.y, size, null);
    }
  }

  function resolveTooltipItemTeam(item, sources) {
    if (!item?.uid || !sources) return typeof prepViewSide !== "undefined" ? prepViewSide : "player";
    if (sources.playerItems?.some((entry) => entry.uid === item.uid)) return "player";
    if (sources.enemyItems?.some((entry) => entry.uid === item.uid)) return "enemy";
    return typeof prepViewSide !== "undefined" ? prepViewSide : "player";
  }

  function drawCanvasItemEmojiSparkle(ctx, cx, cy, size, time, seed = 0) {
    if (!ctx) return;
    const radius = Math.max(12, size * 0.52);
    const sparkleChars = ["✦", "✨", "★", "·"];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "rgba(255, 230, 120, 0.95)";
    ctx.shadowBlur = Math.max(6, radius * 0.28);

    for (let i = 0; i < 8; i += 1) {
      const phase = time * 3.6 + seed + i * 0.85;
      const orbit = radius * (0.72 + 0.22 * Math.sin(phase * 1.7 + i));
      const x = cx + Math.cos(phase + i * 0.9) * orbit;
      const y = cy + Math.sin(phase * 1.15 + i * 0.7) * orbit * 0.88;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 5.5 + i * 1.4 + seed));
      ctx.globalAlpha = pulse;
      ctx.font = `${Math.max(9, Math.round(radius * 0.34))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = i % 3 === 0 ? "#fff8dc" : "#ffe566";
      ctx.fillText(sparkleChars[i % sparkleChars.length], x, y);
    }

    ctx.globalAlpha = 0.28 + 0.18 * Math.sin(time * 4.8 + seed);
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 248, 190, 0.55)";
    ctx.fill();

    ctx.globalAlpha = 0.22 + 0.14 * Math.sin(time * 3.4 + seed * 1.3);
    ctx.lineWidth = Math.max(1.5, radius * 0.07);
    ctx.strokeStyle = "rgba(255, 230, 120, 0.85)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBoardTooltipItemSparkles(targetCtx, time) {
    if (!targetCtx || typeof tooltipItem === "undefined" || !tooltipItem || typeof dragPayload !== "undefined" && dragPayload) {
      return;
    }
    const sources = typeof getTooltipBoardSources === "function" ? getTooltipBoardSources() : null;
    if (!sources) return;

    if (tooltipItem.contentItem) {
      const item = tooltipItem.contentItem;
      const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[item.itemId] : null;
      if (!def) return;
      const team = resolveTooltipItemTeam(item, sources);
      forEachPlacedItemEmojiCenter(item, def, team, (cx, cy, size) => {
        drawCanvasItemEmojiSparkle(targetCtx, cx, cy, size, time, hashSeed(item.uid));
      });
      return;
    }

    const itemId = tooltipItem.itemId;
    const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
    if (!def || typeof tooltipItem.x !== "number" || typeof tooltipItem.y !== "number") return;

    const mx = tooltipItem.x;
    const my = tooltipItem.y;
    const tryContainer = (containers, team) => {
      if (!containers || typeof findContainerAtCanvasPoint !== "function") return false;
      const container = findContainerAtCanvasPoint(mx, my, containers, team);
      if (!container) return false;
      const [c, r] = [container.col, container.row];
      if (typeof cellRect !== "function") return false;
      const rect = cellRect(team, c, r);
      drawCanvasItemEmojiSparkle(
        targetCtx,
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
        Math.min(rect.w, rect.h),
        time,
        hashSeed(`${team}-${c}-${r}-${itemId}`),
      );
      return true;
    };

    if (tryContainer(sources.playerContainers, "player")) return;
    tryContainer(sources.enemyContainers, "enemy");
  }

  function bindItemEmojiSparklePointer(el) {
    if (!el || el.dataset.emojiSparkleBound === "1") return;
    el.dataset.emojiSparkleBound = "1";

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!isTouchLikePointerType?.(e.pointerType) && e.pointerType !== "mouse") return;
      setDomSparkleActive(el, true);
    };
    const onUp = () => {
      if (domSparkleOwner !== el) return;
      if (typeof sidebarTooltipPinned !== "undefined" && sidebarTooltipPinned) return;
      setDomSparkleActive(el, false);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("mouseleave", () => {
      if (typeof sidebarTooltipPinned !== "undefined" && sidebarTooltipPinned) return;
      setDomSparkleActive(el, false);
    });
  }

  window.renderItemEmojiSparklesHTML = renderItemEmojiSparklesHTML;
  window.drawBoardTooltipItemSparkles = drawBoardTooltipItemSparkles;
  window.syncDomSparkleFromTooltipSource = syncDomSparkleFromTooltipSource;
  window.clearDomSparkleHighlights = clearDomSparkleHighlights;
  window.bindItemEmojiSparklePointer = bindItemEmojiSparklePointer;
})();
