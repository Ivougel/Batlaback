/**
 * Ленивая подгрузка mode-specific скриптов при выборе режима / старте забега.
 * Источник TypeScript — npm run compile:ts
 */
(function initRuntimeLoader(): void {
  const loaded = new Set<string>();
  const inflight = new Map<string, Promise<void>>();

  const BUNDLES = {
    combatFeed: ["components/combat-feed.js?v=4"],
  } as const;

  function scriptsForMode(_mode: string): string[] {
    return [];
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

  async function ensureModeBundle(_mode: string): Promise<void> {
    return Promise.resolve();
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

  function preloadModeBundle(_mode: string): void {
  }

  function isBundleLoaded(_mode: string): boolean {
    return true;
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
