/**
 * Экспериментальный visual overhaul (opt-in).
 *
 * Включить:  ?vexp=1  или  VisualExperiment.enable()
 * Выключить: ?vexp=0  или  VisualExperiment.disable()
 *
 * Откат: удалить visual-experiment.css/js из index.html и хуки в ui-layout.js.
 */

const VISUAL_EXPERIMENT_KEY = "bb_visual_experiment";

const VisualExperiment = (() => {
  let atmoEl = null;

  function readUrlFlag() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("vexp")) {
        return params.get("vexp") === "1" || params.get("vexp") === "true";
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  function isEnabled() {
    return document.documentElement.dataset.visualExperiment === "true";
  }

  function syncDataset(on) {
    const root = document.documentElement;
    if (on) root.dataset.visualExperiment = "true";
    else root.removeAttribute("data-visual-experiment");
  }

  function refreshLayout() {
    if (typeof window.applyGridMetricsFromCss === "function") {
      window.applyGridMetricsFromCss();
    }
    if (typeof window.applyUiLayout === "function") {
      window.applyUiLayout();
    } else if (typeof window.scheduleCanvasFit === "function") {
      window.scheduleCanvasFit();
    }
    if (typeof window.syncMobileShopFabPosition === "function") {
      window.syncMobileShopFabPosition();
    }
  }

  function ensureAtmosphere() {
    if (!isEnabled()) {
      atmoEl?.remove();
      atmoEl = null;
      return;
    }
    const world = document.getElementById("layer-world");
    if (!world) return;
    if (!atmoEl) {
      atmoEl = document.createElement("div");
      atmoEl.className = "vexp-atmo";
      atmoEl.setAttribute("aria-hidden", "true");
      const seeds = [12, 28, 44, 61, 73, 18, 52, 36, 67, 8, 81, 39];
      seeds.forEach((left, i) => {
        const p = document.createElement("span");
        p.className = "vexp-atmo__particle";
        p.style.left = `${left}%`;
        p.style.bottom = `${6 + (i % 5) * 4}%`;
        p.style.animationDelay = `${(i * 0.7) % 5}s`;
        p.style.animationDuration = `${7 + (i % 4)}s`;
        atmoEl.appendChild(p);
      });
      world.appendChild(atmoEl);
    }
  }

  function ensurePedestals() {
    if (!isEnabled()) {
      document.querySelectorAll(".vexp-hero-pedestal").forEach((el) => el.remove());
      return;
    }
    ["player-avatar-panel", "enemy-avatar-panel"].forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel || panel.querySelector(".vexp-hero-pedestal")) return;
      const ped = document.createElement("div");
      ped.className = "vexp-hero-pedestal";
      ped.setAttribute("aria-hidden", "true");
      panel.appendChild(ped);
    });
  }

  function setEnabled(on, persist = true) {
    const next = !!on;
    if (persist) {
      try {
        localStorage.setItem(VISUAL_EXPERIMENT_KEY, next ? "1" : "0");
      } catch (_) { /* ignore */ }
    }
    syncDataset(next);
    ensureAtmosphere();
    ensurePedestals();
    refreshLayout();
    if (next) {
      console.info("[VisualExperiment] ON — disable: ?vexp=0 or VisualExperiment.disable()");
    } else {
      console.info("[VisualExperiment] OFF");
    }
    return next;
  }

  function enable() {
    return setEnabled(true);
  }

  function disable() {
    return setEnabled(false);
  }

  function toggle() {
    return setEnabled(!isEnabled());
  }

  function getHeroScale(ctx = {}) {
    if (!isEnabled()) return 1;
    const root = document.documentElement;
    if (ctx.mobileLayout) return 1.3;
    if (ctx.tabletSide || ctx.tabletPortrait || root.dataset.uiTier === "tablet") return 1.5;
    if (root.dataset.uiTier === "phone") return 1.28;
    return 1.15;
  }

  function isMobileLayout() {
    return document.documentElement.dataset.prepLayout === "mobile";
  }

  /** ui-layout hook: battle hero row metrics — на mobile не трогаем JS-геометрию */
  function applyBattleLayout(metrics) {
    if (!isEnabled() || !metrics || metrics.mobileLayout || isMobileLayout()) return null;
    const heroScale = getHeroScale(metrics);
    return {
      heroZone: Math.round(metrics.heroZone * heroScale * 0.98),
      arenaMin: Math.round(metrics.arenaMin * 1.08),
      heroColW: Math.round(metrics.heroColW * heroScale * 0.98),
      heroImgH: Math.round(metrics.heroImgH * heroScale),
      portraitZoom: metrics.portraitZoom * 1.03,
      chromePad: metrics.chromePad,
      scale: metrics.scale,
    };
  }

  /** ui-layout hook: gap between canvas and hero row */
  function getHeroRowGap(uiScale) {
    if (!isEnabled() || isMobileLayout()) return Math.round(8 * uiScale);
    return Math.max(4, Math.round(5 * uiScale));
  }

  /** ui-layout hook: prep ui-scale bump for backpack focus */
  function applyPrepUiScale(scale, ctx = {}) {
    if (!isEnabled()) return scale;
    if (ctx.prepLayout === "mobile") return scale;
    return Math.min(1, scale * 1.02);
  }

  function onPhaseChange() {
    if (!isEnabled()) return;
    ensurePedestals();
    if (typeof window.applyGridMetricsFromCss === "function") {
      window.applyGridMetricsFromCss();
    }
    if (typeof window.scheduleCanvasFit === "function") {
      window.scheduleCanvasFit();
    }
    if (typeof window.syncMobileShopFabPosition === "function") {
      window.syncMobileShopFabPosition();
    }
  }

  function initVisualExperiment() {
    const urlFlag = readUrlFlag();
    let stored = null;
    try {
      stored = localStorage.getItem(VISUAL_EXPERIMENT_KEY);
    } catch (_) { /* ignore */ }

    const on = urlFlag != null ? urlFlag : stored === "1";
    syncDataset(on);
    if (urlFlag != null) {
      try {
        localStorage.setItem(VISUAL_EXPERIMENT_KEY, on ? "1" : "0");
      } catch (_) { /* ignore */ }
    }

    if (on) {
      ensureAtmosphere();
      ensurePedestals();
      console.info("[VisualExperiment] loaded ON — ?vexp=0 to disable");
    }

    const app = document.getElementById("app");
    if (app) {
      new MutationObserver(() => onPhaseChange()).observe(app, {
        attributes: true,
        attributeFilter: ["data-phase"],
      });
    }
  }

  return {
    initVisualExperiment,
    isEnabled,
    enable,
    disable,
    toggle,
    applyBattleLayout,
    getHeroRowGap,
    applyPrepUiScale,
    onPhaseChange,
  };
})();

function initVisualExperiment() {
  VisualExperiment.initVisualExperiment();
}

function isVisualExperimentActive() {
  return VisualExperiment.isEnabled();
}

function applyVisualExperimentBattleLayout(metrics) {
  return VisualExperiment.applyBattleLayout(metrics);
}

function getVisualExperimentHeroRowGap(uiScale) {
  return VisualExperiment.getHeroRowGap(uiScale);
}

function applyVisualExperimentPrepUiScale(scale, ctx) {
  return VisualExperiment.applyPrepUiScale(scale, ctx);
}

window.VisualExperiment = VisualExperiment;
