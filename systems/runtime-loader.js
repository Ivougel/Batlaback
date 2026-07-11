// Transpiled from TypeScript — npm run compile:ts

(function initRuntimeLoader() {
  const loaded = /* @__PURE__ */ new Set();
  const inflight = /* @__PURE__ */ new Map();
  const BUNDLES = {
    combatFeed: ["components/combat-feed.js?v=4"]
  };
  function scriptsForMode(_mode) {
    return [];
  }
  function loadScript(src) {
    if (loaded.has(src)) return Promise.resolve();
    const pending = inflight.get(src);
    if (pending) return pending;
    const p = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = false;
      el.onload = () => {
        loaded.add(src);
        inflight.delete(src);
        resolve();
      };
      el.onerror = () => {
        inflight.delete(src);
        reject(new Error(`RuntimeLoader: failed to load ${src}`));
      };
      document.head.appendChild(el);
    });
    inflight.set(src, p);
    return p;
  }
  async function ensureModeBundle(_mode) {
    return Promise.resolve();
  }
  async function ensureCombatFeedBundle() {
    for (const src of BUNDLES.combatFeed) {
      await loadScript(src);
    }
  }
  function preloadCombatFeedBundle() {
    void ensureCombatFeedBundle().catch((err) => {
      console.warn("RuntimeLoader combat-feed preload failed:", err);
    });
  }
  function preloadModeBundle(_mode) {
  }
  function isBundleLoaded(_mode) {
    return true;
  }
  window.RuntimeLoader = {
    BUNDLES,
    scriptsForMode,
    ensureModeBundle,
    ensureCombatFeedBundle,
    preloadCombatFeedBundle,
    preloadModeBundle,
    isBundleLoaded
  };
})();
