/**
 * Ленивая подгрузка mode-specific скриптов при выборе режима / старте забега.
 * Источник TypeScript — npm run compile:ts
 */
(function initRuntimeLoader(): void {
  const loaded = new Set<string>();
  const inflight = new Map<string, Promise<void>>();

  const BUNDLES = {
    combatFeed: ["components/combat-feed.js?v=4"],
    lobby: [
      "systems/lobby-opponents.js?v=6",
      "systems/lobby-fighter-avatar.js?v=10",
      "systems/lobby-spectator.js?v=9",
      "systems/lobby-roster-float.js?v=1",
      "components/lobby-2p-hud.js?v=3",
      "lobby-runtime.js?v=1",
    ],
    hardbot: ["hard-bot-engine.js"],
  } as const;

  function scriptsForMode(mode: string): string[] {
    const urls: string[] = [];
    if (mode === "lobby" || mode === "lobby2p") urls.push(...BUNDLES.lobby);
    if (mode === "hardbot") urls.push(...BUNDLES.hardbot);
    return urls;
  }

  function loadScript(src: string): Promise<void> {
    if (loaded.has(src)) return Promise.resolve();
    const pending = inflight.get(src);
    if (pending) return pending;

    const p = new Promise<void>((resolve, reject) => {
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

  async function ensureModeBundle(mode: string): Promise<void> {
    const urls = scriptsForMode(mode);
    for (const src of urls) {
      await loadScript(src);
    }
  }

  async function ensureCombatFeedBundle(): Promise<void> {
    for (const src of BUNDLES.combatFeed) {
      await loadScript(src);
    }
  }

  function preloadCombatFeedBundle(): void {
    void ensureCombatFeedBundle().catch((err: unknown) => {
      console.warn("RuntimeLoader combat-feed preload failed:", err);
    });
  }

  function preloadModeBundle(mode: string): void {
    void ensureModeBundle(mode).catch((err: unknown) => {
      console.warn("RuntimeLoader preload failed:", err);
    });
  }

  function isBundleLoaded(mode: string): boolean {
    const urls = scriptsForMode(mode);
    return urls.length === 0 || urls.every((src) => loaded.has(src));
  }

  window.RuntimeLoader = {
    BUNDLES: BUNDLES as unknown as Record<string, readonly string[]>,
    scriptsForMode,
    ensureModeBundle,
    ensureCombatFeedBundle,
    preloadCombatFeedBundle,
    preloadModeBundle,
    isBundleLoaded,
  };
})();
