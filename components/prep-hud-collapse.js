/**
 * Сворачивание верхней HUD-карточки героя (prep / TD overworld).
 * Состояние: localStorage bb-prep-hero-hud-collapsed
 */

const PREP_HUD_COLLAPSE_KEY = "bb-prep-hero-hud-collapsed";

function isPrepHudCollapseEnabled() {
  return typeof isPrepHeroCardHud === "function" && isPrepHeroCardHud();
}

function loadPrepHudCollapsed() {
  try {
    return localStorage.getItem(PREP_HUD_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function savePrepHudCollapsed(collapsed) {
  try {
    localStorage.setItem(PREP_HUD_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function getHudCharacterPanel() {
  return document.getElementById("prep-hero-card");
}

function getHudCollapseToggle() {
  return document.getElementById("btn-hud-collapse-toggle");
}

function measureHudPanelHeights(panel) {
  const wasCollapsed = panel.classList.contains("is-collapsed");
  const prevMax = panel.style.maxHeight;

  panel.classList.remove("is-collapsed");
  panel.style.maxHeight = "none";
  const expanded = panel.scrollHeight;

  panel.classList.add("is-collapsed");
  panel.style.maxHeight = "none";
  const collapsed = panel.scrollHeight;

  panel.classList.toggle("is-collapsed", wasCollapsed);
  panel.style.maxHeight = prevMax;

  return {
    expanded,
    collapsed: Math.max(collapsed, 48),
  };
}

function syncOpenPrepTooltipAfterHudLayout() {
  if (typeof window.positionPrepTooltipDock !== "function") return;
  requestAnimationFrame(() => {
    const tip = document.getElementById("sidebar-tooltip");
    if (tip && !tip.classList.contains("hidden")) {
      window.positionPrepTooltipDock();
    }
  });
}

function syncHudCollapseToggleState(collapsed) {
  const toggle = getHudCollapseToggle();
  const panel = getHudCharacterPanel();
  if (!toggle) return;
  toggle.classList.toggle("is-collapsed", collapsed);
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle.setAttribute(
    "aria-label",
    collapsed ? "Развернуть профиль персонажа" : "Свернуть профиль персонажа",
  );
  panel?.querySelector(".hud-character-panel__collapsed-metrics")
    ?.setAttribute("aria-hidden", collapsed ? "false" : "true");
}

function animateHudPanelCollapse(panel, collapse, heights) {
  const { expanded, collapsed } = heights || measureHudPanelHeights(panel);
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    panel.classList.toggle("is-collapsed", collapse);
    panel.style.maxHeight = collapse ? `${collapsed}px` : "none";
    syncHudCollapseToggleState(collapse);
    syncOpenPrepTooltipAfterHudLayout();
    return;
  }

  panel.style.overflow = "hidden";
  panel.style.transition = "max-height 0.35s ease, opacity 0.3s ease";

  if (collapse) {
    panel.style.maxHeight = `${expanded}px`;
    panel.offsetHeight;
    panel.classList.add("is-collapsed");
    syncHudCollapseToggleState(true);
    requestAnimationFrame(() => {
      panel.style.maxHeight = `${collapsed}px`;
    });
  } else {
    panel.style.maxHeight = `${collapsed}px`;
    panel.offsetHeight;
    panel.classList.remove("is-collapsed");
    syncHudCollapseToggleState(false);
    requestAnimationFrame(() => {
      panel.style.maxHeight = `${expanded}px`;
    });
  }

  const onEnd = (e) => {
    if (e.propertyName !== "max-height") return;
    panel.removeEventListener("transitionend", onEnd);
    if (!panel.classList.contains("is-collapsed")) {
      panel.style.maxHeight = "none";
    }
    panel.style.overflow = "";
    if (typeof window.syncPrepHeroCardPortraitSize === "function") {
      window.syncPrepHeroCardPortraitSize();
    }
    syncOpenPrepTooltipAfterHudLayout();
  };
  panel.addEventListener("transitionend", onEnd);
}

function setPrepHudCollapsed(collapsed, { animate = true } = {}) {
  const panel = getHudCharacterPanel();
  if (!panel || !isPrepHudCollapseEnabled()) return;

  savePrepHudCollapsed(collapsed);
  document.getElementById("app")?.toggleAttribute("data-prep-hud-collapsed", collapsed);

  if (animate) {
    animateHudPanelCollapse(panel, collapsed);
    return;
  }

  panel.classList.toggle("is-collapsed", collapsed);
  if (collapsed) {
    const { collapsed: h } = measureHudPanelHeights(panel);
    panel.style.maxHeight = `${h}px`;
  } else {
    panel.style.maxHeight = "none";
  }
  syncHudCollapseToggleState(collapsed);
  syncOpenPrepTooltipAfterHudLayout();
}

function togglePrepHudCollapsed() {
  const panel = getHudCharacterPanel();
  if (!panel) return;
  setPrepHudCollapsed(!panel.classList.contains("is-collapsed"));
}

function syncPrepHudCollapseChrome() {
  const panel = getHudCharacterPanel();
  const toggle = getHudCollapseToggle();
  const enabled = isPrepHudCollapseEnabled();

  toggle?.classList.toggle("hidden", !enabled);

  if (!enabled || !panel) {
    panel?.classList.remove("is-collapsed");
    panel?.style.removeProperty("max-height");
    panel?.style.removeProperty("overflow");
    document.getElementById("app")?.removeAttribute("data-prep-hud-collapsed");
    syncHudCollapseToggleState(false);
    return;
  }

  const wantCollapsed = loadPrepHudCollapsed();
  const isCollapsed = panel.classList.contains("is-collapsed");

  if (wantCollapsed !== isCollapsed) {
    setPrepHudCollapsed(wantCollapsed, { animate: false });
  } else if (isCollapsed) {
    const { collapsed } = measureHudPanelHeights(panel);
    panel.style.maxHeight = `${collapsed}px`;
    syncHudCollapseToggleState(true);
  } else {
    syncHudCollapseToggleState(false);
  }

  document.getElementById("app")?.toggleAttribute("data-prep-hud-collapsed", panel.classList.contains("is-collapsed"));
}

let prepHudCollapseResizeObserver = null;

function initPrepHudCollapse() {
  const toggle = getHudCollapseToggle();
  const panel = getHudCharacterPanel();
  if (!toggle || !panel || toggle.dataset.bound === "true") return;
  toggle.dataset.bound = "true";

  toggle.addEventListener("click", togglePrepHudCollapsed);
  syncPrepHudCollapseChrome();

  if (typeof ResizeObserver !== "undefined") {
    prepHudCollapseResizeObserver?.disconnect();
    prepHudCollapseResizeObserver = new ResizeObserver(() => {
      const el = getHudCharacterPanel();
      if (!el?.classList.contains("is-collapsed")) return;
      const { collapsed } = measureHudPanelHeights(el);
      el.style.maxHeight = `${collapsed}px`;
    });
    prepHudCollapseResizeObserver.observe(panel);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPrepHudCollapse);
} else {
  initPrepHudCollapse();
}
