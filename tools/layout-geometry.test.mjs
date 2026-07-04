/**
 * Геометрия ключевых зон — без pixel-snapshots (стабильно в CI).
 * Запуск: npm run test:geometry
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function quickStart(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");
  await page.evaluate(() => {
    selectGameMode("solo");
    selectPlayerClass("warrior");
    if (typeof selectCompanion === "function") {
      selectCompanion(
        typeof defaultCompanionForClass === "function"
          ? defaultCompanionForClass("warrior")
          : "s_stranger",
      );
    }
    selectOpponentClass("mage");
    startRunFromOverlay();
  });
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep");
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
    window.syncMobileShopFabPosition?.();
    window.syncMobileOverlayAnchors?.();
  });
  await page.waitForTimeout(500);
}

function box(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return null;
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
  }, selector);
}

const CASES = [
  {
    id: "iphone-portrait-battle-chrome",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForTimeout(800);
      await page.evaluate(() => { window.applyUiLayout?.(); });
      const m = await page.evaluate(() => {
        const bar = document.querySelector(".bottom-chrome")?.getBoundingClientRect();
        const gamepad = document.querySelector(".bottom-chrome-gamepad");
        const cs = gamepad ? getComputedStyle(gamepad) : null;
        const controls = document.querySelector(".battle-controls")?.getBoundingClientRect();
        return {
          gamepadHud: document.documentElement.dataset.gamepadHud,
          gamepadDisplay: cs?.display ?? "none",
          barH: bar?.height ?? 0,
          barBottom: bar?.bottom ?? 0,
          vw: window.innerWidth,
          controlsW: controls?.width ?? 0,
        };
      });
      assert(m.gamepadHud === "hidden", `gamepad hud should be hidden on touch: ${m.gamepadHud}`);
      assert(m.gamepadDisplay === "none", `gamepad row visible: ${m.gamepadDisplay}`);
      assert(m.barBottom <= (await page.evaluate(() => window.innerHeight)) + 2, "chrome below viewport");
      assert(m.controlsW <= m.vw + 2, "battle controls overflow");
    },
  },
  {
    id: "iphone-portrait-prep-chrome",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await quickStart(page);
      const m = await page.evaluate(() => {
        const fight = document.getElementById("btn-fight")?.getBoundingClientRect();
        const bar = document.querySelector(".bottom-chrome")?.getBoundingClientRect();
        const label = document.querySelector("#btn-prep-player .prep-side-label");
        const labelHidden = label ? getComputedStyle(label).display === "none" : false;
        const typeScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--type-scale")) || 0;
        return {
          fightW: fight?.width ?? 0,
          barW: bar?.width ?? 0,
          labelHidden,
          fightOnOwnRow: fight && bar ? fight.width >= bar.width * 0.92 : false,
          typeScale,
        };
      });
      assert(m.labelHidden, "prep side labels should be icon-only on mobile");
      assert(m.fightOnOwnRow, `fight btn not full width: ${m.fightW}/${m.barW}`);
      assert(m.typeScale >= 0.94, `type-scale too small on phone portrait: ${m.typeScale}`);
    },
  },
  {
    id: "iphone-portrait-shop-sheet-zone",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => window.toggleMobilePrepShop?.());
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const shop = document.getElementById("shop-panel")?.getBoundingClientRect();
        const chrome = document.getElementById("bottom-chrome")?.getBoundingClientRect();
        const island = document.getElementById("prep-field-island")?.getBoundingClientRect();
        const maxH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--prep-shop-sheet-max-h")) || 0;
        return {
          shopTop: shop?.top ?? 0,
          shopBottom: shop?.bottom ?? 0,
          shopH: shop?.height ?? 0,
          chromeTop: chrome?.top ?? 0,
          islandBottom: island?.bottom ?? 0,
          maxH,
          open: document.documentElement.hasAttribute("data-prep-shop-open"),
        };
      });
      assert(m.open, "shop drawer not open");
      assert(m.maxH >= 160, `shop sheet max-h token: ${m.maxH}`);
      assert(m.shopH <= m.maxH + 4, `shop taller than token: ${m.shopH} > ${m.maxH}`);
      assert(m.shopBottom <= m.chromeTop + 8, `shop overlaps toolbar: ${m.shopBottom} > ${m.chromeTop}`);
      assert(m.shopTop >= m.islandBottom - 24, `shop covers field: top=${m.shopTop} island=${m.islandBottom}`);
    },
  },
  {
    id: "iphone-portrait-class-dock",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(() => typeof selectPlayerClass === "function");
      await page.evaluate(() => {
        selectGameMode("solo");
        selectPlayerClass("warrior");
        showSecondClassStep();
        selectOpponentClass("mage");
        window.applyUiLayout?.();
        window.syncClassOverlayAnchors?.();
      });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const dock = document.getElementById("class-mobile-dock");
        const step = document.querySelector("#class-step-opponent:not(.hidden)");
        const dockRect = dock?.getBoundingClientRect();
        const stepRect = step?.getBoundingClientRect();
        const token = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--class-mobile-dock-h")) || 0;
        const scrollMax = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--class-modal-scroll-max-h")) || 0;
        return {
          dockVisible: !!(dock && !dock.classList.contains("hidden")),
          dockTop: dockRect?.top ?? 0,
          dockBottom: dockRect?.bottom ?? 0,
          stepBottom: stepRect?.bottom ?? 0,
          stepScrollH: step?.scrollHeight ?? 0,
          stepClientH: step?.clientHeight ?? 0,
          vh: window.innerHeight,
          token,
          scrollMax,
          prepLayout: document.documentElement.dataset.prepLayout,
        };
      });
      assert(m.prepLayout === "mobile", `expected mobile prep layout, got ${m.prepLayout}`);
      assert(m.dockVisible, "class mobile dock hidden on opponent step");
      assert(m.token >= 72, `class dock token: ${m.token}`);
      assert(m.dockBottom <= m.vh + 2, "dock below viewport");
      assert(m.stepBottom <= m.dockTop + 8, `class step overlaps dock: step=${m.stepBottom} dock=${m.dockTop}`);
      assert(m.stepScrollH <= m.stepClientH + 4, `class step should not scroll: scroll=${m.stepScrollH} client=${m.stepClientH}`);
    },
  },
  {
    id: "iphone-portrait-battle-emoji",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForFunction(
        () => !document.getElementById("battle-countdown-overlay")
          ?.classList.contains("battle-countdown-overlay-visible"),
        { timeout: 12000 },
      );
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        window.applyUiLayout?.();
        window.scheduleCanvasFit?.();
      });
      await page.waitForTimeout(600);

      const m = await page.evaluate(() => {
        const floor = document.getElementById("battle-thought-arena")?.getBoundingClientRect();
        const emojiPx = window.BattleHeroAnchor?.thoughtSlotEmojiSize?.() ?? 0;
        const playerHud = document.getElementById("battle-hud-player")?.getBoundingClientRect();
        const enemyHud = document.getElementById("battle-hud-enemy")?.getBoundingClientRect();
        const stage = document.querySelector("#player-avatar-slot .avatar-hero-stage")?.getBoundingClientRect();
        const playerSlot = document.getElementById("player-thought-slot")?.getBoundingClientRect();
        const chromeTop = document.getElementById("bottom-chrome")?.getBoundingClientRect().top ?? 0;
        const hudBottom = Math.max(playerHud?.bottom ?? 0, enemyHud?.bottom ?? 0);
        return {
          floorH: floor?.height ?? 0,
          floorTop: floor?.top ?? 0,
          emojiPx,
          hudBottom,
          hudTop: playerHud?.top ?? 0,
          stageBottom: stage?.bottom ?? 0,
          hudToSlotGap: (playerSlot?.top ?? 0) - hudBottom,
          slotCenterY: ((playerSlot?.top ?? 0) + (playerSlot?.bottom ?? 0)) / 2,
          chromeTop,
        };
      });
      assert(m.floorH > 48, "combat floor too small");
      assert(m.hudToSlotGap <= 80, `emoji too far below HUD: ${m.hudToSlotGap}px`);
      assert(m.hudToSlotGap >= -8, `emoji overlaps HUD: ${m.hudToSlotGap}px`);
      assert(m.emojiPx >= 76, `emoji too small: ${m.emojiPx}px`);
      assert(m.emojiPx <= 120, `emoji too large on portrait: ${m.emojiPx}px`);
      assert(m.floorTop >= m.hudBottom - 8, `combat floor above HUD: top=${m.floorTop} hud=${m.hudBottom}`);
      const corridorH = m.chromeTop - m.hudBottom;
      const slotRel = corridorH > 0 ? (m.slotCenterY - m.hudBottom) / corridorH : 0;
      assert(slotRel <= 0.38, `emoji too low in viewport: rel=${slotRel.toFixed(2)}`);
      assert(m.hudTop >= m.stageBottom - 28, `HUD too high on portrait: hud=${m.hudTop} stage=${m.stageBottom}`);
    },
  },
  {
    id: "iphone-portrait-prep-hero",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await quickStart(page);
      const island = await box(page, "#prep-field-island");
      const hero = await box(page, ".prep-character-layer");
      const chrome = await box(page, "#bottom-chrome");
      const fab = await box(page, ".prep-mobile-shop-btn");
      assert(island && island.h > 40, "canvas island missing");
      assert(hero && hero.h > 40, "hero layer missing");
      assert(chrome && chrome.h > 20, "bottom chrome missing");
      assert(hero.top >= island.bottom - 6, `hero above canvas gap: hero.top=${hero.top} island.bottom=${island.bottom}`);
      assert(hero.bottom <= chrome.top + 8, `hero above toolbar: hero.bottom=${hero.bottom} chrome.top=${chrome.top}`);
      if (fab) {
        assert(fab.top >= island.bottom - 4, "FAB not above canvas");
        assert(fab.bottom <= chrome.top + 4, "FAB overlaps toolbar");
      }
    },
  },
  {
    id: "iphone-portrait-mobile-fab-anchors",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await quickStart(page);
      const prep = await page.evaluate(() => {
        const chrome = document.getElementById("bottom-chrome")?.getBoundingClientRect();
        const doll = document.getElementById("btn-toggle-doll")?.getBoundingClientRect();
        const fabBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--prep-mobile-fab-bottom"));
        return { chromeTop: chrome?.top ?? 0, dollBottom: doll?.bottom ?? 0, fabBottom };
      });
      assert(prep.fabBottom > 0, "prep mobile fab bottom token missing");
      assert(prep.dollBottom <= prep.chromeTop + 4, `doll FAB overlaps toolbar: ${prep.dollBottom} > ${prep.chromeTop}`);

      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        window.applyUiLayout?.();
        window.syncMobileOverlayAnchors?.();
      });
      await page.waitForTimeout(300);

      const battle = await page.evaluate(() => {
        const chrome = document.getElementById("bottom-chrome")?.getBoundingClientRect();
        const stats = document.getElementById("btn-battle-build-stats")?.getBoundingClientRect();
        const fabBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--prep-mobile-fab-bottom"));
        const anchorDisplay = getComputedStyle(document.getElementById("battle-build-stats-anchor")).display;
        return {
          chromeTop: chrome?.top ?? 0,
          statsBottom: stats?.bottom ?? 0,
          fabBottom,
          anchorDisplay,
        };
      });
      assert(battle.fabBottom > 0, "battle mobile fab bottom token missing");
      assert(battle.anchorDisplay !== "none", "build-stats anchor hidden in mobile battle");
      assert(battle.statsBottom <= battle.chromeTop + 4, `build-stats overlaps toolbar: ${battle.statsBottom} > ${battle.chromeTop}`);
    },
  },
  {
    id: "iphone-portrait-battle-inventory-tooltip",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForFunction(
        () => !document.getElementById("battle-countdown-overlay")
          ?.classList.contains("battle-countdown-overlay-visible"),
        { timeout: 12000 },
      );
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        window.applyUiLayout?.();
        window.openBattleInventoryPopover?.("player");
      });
      await page.waitForTimeout(400);

      const opened = await page.evaluate(() => {
        const pop = document.getElementById("battle-inventory-popover-player");
        return !!(pop && !pop.classList.contains("hidden"));
      });
      assert(opened, "battle inventory popover did not open");

      const tipOk = await page.evaluate(() => {
        const cell = document.querySelector(
          "#battle-inventory-popover-player .bp-cell.bp-has-item[data-item-id]",
        );
        if (!cell || typeof showSidebarTooltipAt !== "function") return { ok: false, reason: "no-cell" };
        const rect = cell.getBoundingClientRect();
        showSidebarTooltipAt(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          cell.dataset.itemId,
          null,
          "inventory",
          cell,
          { pinned: true },
        );
        const tip = document.getElementById("sidebar-tooltip");
        return {
          ok: !!(tip && !tip.classList.contains("hidden")),
          source: typeof sidebarTooltipSource !== "undefined" ? sidebarTooltipSource : null,
        };
      });
      assert(tipOk.ok, `inventory tooltip not visible (${tipOk.reason || tipOk.source})`);
      assert(tipOk.source === "inventory", `tooltip source: ${tipOk.source}`);
    },
  },
  {
    id: "iphone-landscape-prep",
    device: {
      ...devices["iPhone 14 Pro Max"],
      viewport: { width: 932, height: 430 },
      isMobile: true,
      hasTouch: true,
    },
    async run(page) {
      await quickStart(page);
      const m = await page.evaluate(() => {
        const surface = document.documentElement.dataset.uiSurface;
        const prepLayout = document.documentElement.dataset.prepLayout;
        const canvas = document.getElementById("game-canvas")?.getBoundingClientRect();
        const island = document.getElementById("prep-field-island")?.getBoundingClientRect();
        const hero = document.querySelector(".prep-character-layer")?.getBoundingClientRect();
        const shop = document.getElementById("shop-panel")?.getBoundingClientRect();
        const fieldCol = document.querySelector(".prep-field-column")?.getBoundingClientRect();
        const fight = document.getElementById("btn-fight")?.getBoundingClientRect();
        const bar = document.querySelector(".bottom-chrome")?.getBoundingClientRect();
        const heroImg = document.querySelector(".prep-character-img")?.getBoundingClientRect();
        return {
          surface,
          prepLayout,
          canvasH: canvas?.height ?? 0,
          heroTop: hero?.top ?? 0,
          islandBottom: island?.bottom ?? 0,
          shopLeft: shop?.left ?? 0,
          fieldRight: fieldCol?.right ?? 0,
          fightW: fight?.width ?? 0,
          fightH: fight?.height ?? 0,
          barW: bar?.width ?? 0,
          heroImgH: heroImg?.height ?? 0,
          heroLayerH: hero?.height ?? 0,
        };
      });
      assert(m.surface === "tablet-side", `expected tablet-side, got ${m.surface}`);
      assert(m.prepLayout === "side", `expected side prep, got ${m.prepLayout}`);
      assert(m.canvasH >= 120, `canvas too small: ${m.canvasH}px`);
      assert(m.shopLeft >= m.fieldRight - 12, `shop not on right: shop.left=${m.shopLeft} field.right=${m.fieldRight}`);
      assert(m.heroTop >= m.islandBottom - 12, `hero should sit below canvas: hero.top=${m.heroTop} island.bottom=${m.islandBottom}`);
      assert(m.fightH >= 42, `fight btn too short on landscape side prep: ${m.fightH}px`);
      assert(m.fightW <= m.barW * 0.42, `toolbar too wide/spread: fight=${m.fightW} bar=${m.barW}`);
      if (m.heroImgH > 0 && m.heroLayerH > 0) {
        assert(m.heroImgH <= m.heroLayerH * 1.14, `hero image cropped: img=${m.heroImgH} layer=${m.heroLayerH}`);
      }
    },
  },
  {
    id: "iphone-landscape-battle",
    device: {
      ...devices["iPhone 14 Pro Max"],
      viewport: { width: 932, height: 430 },
      isMobile: true,
      hasTouch: true,
    },
    async run(page) {
      await quickStart(page);
      const prepSurface = await page.evaluate(() => document.documentElement.dataset.uiSurface);
      assert(prepSurface === "tablet-side", `expected tablet-side prep, got ${prepSurface}`);

      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        window.applyUiLayout?.();
        window.scheduleCanvasFit?.();
      });
      await page.waitForTimeout(600);

      const floor = await box(page, "#battle-thought-arena");
      const scene = await box(page, "#battle-scene-ui");
      const chrome = await box(page, "#bottom-chrome");
      const vh = await page.evaluate(() => window.innerHeight);

      assert(scene && scene.h > 60, "battle scene too small");
      assert(floor && floor.h > 48, "combat floor too small");
      assert(chrome && chrome.h > 20, "bottom chrome missing");
      assert(floor.bottom <= vh + 4, `floor overflows: ${floor.bottom} > ${vh}`);
      assert(scene.top >= -4, `scene clipped: top=${scene.top}`);
      assert(floor.top >= scene.bottom - 12, `floor should sit below portraits: floor.top=${floor.top} scene.bottom=${scene.bottom}`);
    },
  },
  {
    id: "iphone-portrait-replay-timeline",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => {
        const frames = Array.from({ length: 5 }, () => ({}));
        phase = "replay";
        replayPlayback = {
          frames,
          index: 2,
          accum: 0,
          frameDuration: 0.1,
          speed: 2,
          playing: true,
        };
        battleState = { player: { hp: 100 }, enemy: { hp: 100 }, finished: false };
        document.getElementById("app").dataset.phase = "replay";
        window.syncReplayTimeline?.();
      });

      const m = await page.evaluate(() => {
        const tl = document.getElementById("replay-timeline");
        const track = document.getElementById("replay-timeline-track");
        const feed = document.querySelector(".btn-combat-feed");
        const bar = document.querySelector(".bottom-chrome");
        const fill = document.getElementById("replay-timeline-fill");
        const feedCs = feed ? getComputedStyle(feed) : null;
        return {
          visible: tl && !tl.classList.contains("hidden"),
          trackW: track?.getBoundingClientRect().width ?? 0,
          barW: bar?.getBoundingClientRect().width ?? 0,
          fillPct: fill?.style.width ?? "",
          feedHidden: feedCs?.display === "none",
          time: document.getElementById("replay-timeline-time")?.textContent ?? "",
        };
      });
      assert(m.visible, "replay timeline hidden");
      assert(m.trackW >= m.barW * 0.35, `timeline too narrow: ${m.trackW}/${m.barW}`);
      assert(m.fillPct === "50%", `progress wrong: ${m.fillPct}`);
      assert(m.time === "3/5", `time label: ${m.time}`);
      assert(m.feedHidden, "combat feed should hide during replay");
    },
  },
  {
    id: "ipad-portrait-battle-hud",
    device: devices["iPad Mini"],
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForFunction(
        () => !document.getElementById("battle-countdown-overlay")
          ?.classList.contains("battle-countdown-overlay-visible"),
        { timeout: 12000 },
      );
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        window.applyUiLayout?.();
        window.syncBattleHudAnchors?.();
        window.syncBattleHudSurfaceFlags?.();
      });
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const stage = document.querySelector("#player-avatar-slot .avatar-hero-stage")?.getBoundingClientRect();
        const hud = document.getElementById("battle-hud-player")?.getBoundingClientRect();
        const hp = document.querySelector("#battle-hud-player .avatar-hero-hp-bar")?.getBoundingClientRect();
        return {
          profile: document.documentElement.dataset.battleProfile,
          compact: document.documentElement.dataset.battleHudCompact,
          htmlHud: document.documentElement.dataset.battleHudHtml,
          stageBottom: stage?.bottom ?? 0,
          hudTop: hud?.top ?? 0,
          hpTop: hp?.top ?? 0,
          hpH: hp?.height ?? 0,
        };
      });
      assert(m.profile === "tablet-portrait", `profile: ${m.profile}`);
      assert(m.htmlHud === "true", "flank HTML HUD flag missing");
      assert(m.hudTop >= m.stageBottom - 28, `HUD too high on portrait: hud=${m.hudTop} stage=${m.stageBottom}`);
      assert(m.hpH >= 6, `HP bar too small: ${m.hpH}px`);
      assert(m.hpTop >= m.stageBottom - 28, `HP bar on portrait: hp=${m.hpTop} stage=${m.stageBottom}`);
    },
  },
  {
    id: "ipad-portrait-battle-corridor",
    device: devices["iPad Mini"],
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForFunction(
        () => !document.getElementById("battle-countdown-overlay")
          ?.classList.contains("battle-countdown-overlay-visible"),
        { timeout: 12000 },
      );
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        window.applyUiLayout?.();
        window.syncBattleHudAnchors?.();
      });
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const floor = document.getElementById("battle-thought-arena")?.getBoundingClientRect();
        const slot = document.getElementById("player-thought-slot")?.getBoundingClientRect();
        const hudBottom = Math.max(
          document.getElementById("battle-hud-player")?.getBoundingClientRect().bottom ?? 0,
          document.getElementById("battle-hud-enemy")?.getBoundingClientRect().bottom ?? 0,
        );
        const chromeTop = document.getElementById("bottom-chrome")?.getBoundingClientRect().top ?? 0;
        return {
          profile: document.documentElement.dataset.battleProfile,
          floorTop: floor?.top ?? 0,
          hudBottom,
          chromeTop,
          gapHudFloor: (floor?.top ?? 0) - hudBottom,
          hudToSlotGap: (slot?.top ?? 0) - hudBottom,
          slotCenterY: ((slot?.top ?? 0) + (slot?.bottom ?? 0)) / 2,
        };
      });
      assert(m.profile === "tablet-portrait", `profile: ${m.profile}`);
      assert(m.gapHudFloor <= 16, `combat floor far below HUD: ${m.gapHudFloor}px`);
      assert(m.hudToSlotGap <= 88, `emoji too far below HUD: ${m.hudToSlotGap}px`);
      assert(m.hudToSlotGap >= -8, `emoji overlaps HUD: ${m.hudToSlotGap}px`);
      const corridorH = m.chromeTop - m.hudBottom;
      const slotRel = corridorH > 0 ? (m.slotCenterY - m.hudBottom) / corridorH : 0;
      assert(slotRel <= 0.40, `emoji too low on tablet portrait: rel=${slotRel.toFixed(2)}`);
    },
  },
  {
    id: "ipad-portrait-prep-field",
    device: devices["iPad Mini"],
    async run(page) {
      await quickStart(page);
      const surface = await page.evaluate(() => document.documentElement.dataset.uiSurface);
      assert(surface === "tablet-stacked", `expected tablet-stacked, got ${surface}`);

      await page.evaluate(() => {
        window.applyUiLayout?.();
        window.scheduleCanvasFit?.();
      });
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const root = document.documentElement;
        const canvas = document.getElementById("game-canvas")?.getBoundingClientRect();
        const hero = document.querySelector("#app[data-phase=\"prep\"] .prep-character-layer")?.getBoundingClientRect();
        const shop = document.getElementById("shop-panel")?.getBoundingClientRect();
        const fab = document.getElementById("btn-mobile-shop")?.getBoundingClientRect();
        const fabCs = document.getElementById("btn-mobile-shop")
          ? getComputedStyle(document.getElementById("btn-mobile-shop"))
          : null;
        const shopCs = document.getElementById("shop-panel")
          ? getComputedStyle(document.getElementById("shop-panel"))
          : null;
        return {
          drawer: root.dataset.prepShopDrawer === "true",
          shopOpen: root.hasAttribute("data-prep-shop-open"),
          canvasH: canvas?.height ?? 0,
          canvasW: canvas?.width ?? 0,
          heroH: hero?.height ?? 0,
          vh: window.innerHeight,
          vw: window.innerWidth,
          shopVisible: shopCs?.visibility === "visible" && (shop?.height ?? 0) > 40,
          shopTransform: shopCs?.transform ?? "",
          fabDisplay: fabCs?.display ?? "none",
          fabW: fab?.width ?? 0,
        };
      });

      assert(m.drawer === true, "tablet portrait should use shop drawer");
      assert(!m.shopOpen, "shop should be closed by default");
      assert(m.fabDisplay !== "none" && m.fabW >= 44, `shop FAB missing: display=${m.fabDisplay}`);
      assert(!m.shopVisible, `shop panel visible without open: transform=${m.shopTransform}`);
      assert(m.canvasH >= m.vh * 0.27, `canvas too small: ${m.canvasH}px vs vh ${m.vh}`);
      assert(m.canvasW >= m.vw * 0.48, `canvas too narrow: ${m.canvasW}px vs vw ${m.vw}`);
      assert(m.heroH >= m.vh * 0.18, `hero too small: ${m.heroH}px`);

      await page.evaluate(() => {
        window.toggleMobilePrepShop?.();
        window.applyUiLayout?.();
        window.scheduleCanvasFit?.();
      });
      await page.waitForTimeout(500);

      const shop = await page.evaluate(() => {
        const panel = document.getElementById("shop-panel");
        const slots = panel?.querySelector(".shop-slots");
        const bench = panel?.querySelector(".bench-panel .bench-slots");
        const slotsCs = slots ? getComputedStyle(slots) : null;
        const cols = slotsCs?.gridTemplateColumns?.split(" ").filter(Boolean).length ?? 0;
        return {
          sheetH: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--prep-shop-sheet-max-h")) || 0,
          panelH: panel?.offsetHeight ?? 0,
          scrollable: (slots?.scrollHeight ?? 0) > (slots?.clientHeight ?? 0) + 4,
          benchScroll: (bench?.scrollHeight ?? 0) > (bench?.clientHeight ?? 0) + 4,
          cols,
          overflow: slotsCs?.overflowY ?? "",
        };
      });
      assert(shop.sheetH >= 340, `shop sheet too short: ${shop.sheetH}px`);
      assert(shop.cols >= 5, `shop should be 5 columns: ${shop.cols}`);
      assert(shop.overflow === "visible" || shop.overflow === "hidden", `shop overflow: ${shop.overflow}`);
      assert(!shop.scrollable, "shop slots should not scroll on tablet portrait");
      assert(!shop.benchScroll, "bench should not scroll on tablet portrait");
    },
  },
  {
    id: "ipad-landscape-battle-emoji",
    device: { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } },
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForFunction(
        () => !document.getElementById("battle-countdown-overlay")
          ?.classList.contains("battle-countdown-overlay-visible"),
        { timeout: 12000 },
      );
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        window.applyUiLayout?.();
        window.scheduleCanvasFit?.();
      });
      await page.waitForTimeout(600);

      const m = await page.evaluate(() => {
        const floor = document.getElementById("battle-thought-arena")?.getBoundingClientRect();
        const playerSlot = document.getElementById("player-thought-slot")?.getBoundingClientRect();
        const enemySlot = document.getElementById("enemy-thought-slot")?.getBoundingClientRect();
        const playerHud = document.getElementById("battle-hud-player")?.getBoundingClientRect();
        const enemyHud = document.getElementById("battle-hud-enemy")?.getBoundingClientRect();
        const playerStage = document.querySelector("#player-avatar-slot .avatar-hero-stage")?.getBoundingClientRect();
        const playerPanel = document.getElementById("player-avatar-panel")?.getBoundingClientRect();
        const playerBody = document.querySelector("#player-thought-slot .battle-thought-body")?.getBoundingClientRect();
        const BHA = window.BattleHeroAnchor;
        const aboveAnchor = BHA?.getHeroAboveThoughtAnchor?.("player");
        const heroTop = BHA?.getHeroColumnTop?.("player") ?? playerStage?.top ?? 0;
        return {
          profile: document.documentElement.dataset.battleProfile,
          headBadge: BHA?.usesHeadBadgeAnchors?.() ?? false,
          heroBelow: BHA?.usesHeroBelowThoughtAnchors?.() ?? false,
          emojiPx: BHA?.thoughtSlotEmojiSize?.() ?? 0,
          satScale: BHA?.satelliteScaleFactor?.() ?? 0,
          floorLeft: floor?.left ?? 0,
          floorW: floor?.width ?? 0,
          floorTop: floor?.top ?? 0,
          floorH: floor?.height ?? 0,
          hudTop: playerHud?.top ?? 0,
          enemyHudTop: enemyHud?.top ?? 0,
          playerHudBottom: playerHud?.bottom ?? 0,
          playerEmojiCy: playerBody ? playerBody.top + playerBody.height / 2 : (playerSlot ? playerSlot.top + playerSlot.height / 2 : 0),
          chromeTop: document.getElementById("bottom-chrome")?.getBoundingClientRect().top ?? 0,
          stageBottom: playerStage?.bottom ?? 0,
          stageTop: playerStage?.top ?? 0,
          stageH: playerStage?.height ?? 0,
          heroTop,
          playerZoneW: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--battle-player-zone-width")) || 0,
          vw: window.innerWidth,
          playerSlotCx: playerSlot ? playerSlot.left + playerSlot.width / 2 : 0,
          enemySlotCx: enemySlot ? enemySlot.left + enemySlot.width / 2 : 0,
          playerColCx: playerPanel ? playerPanel.left + playerPanel.width / 2 : 0,
          anchorCx: aboveAnchor?.cx ?? 0,
          anchorCy: aboveAnchor?.cy ?? 0,
          thoughtAboveHero: document.documentElement.dataset.thoughtAboveHero === "true",
          thoughtHeadBadge: document.documentElement.dataset.thoughtHeadBadge === "true",
        };
      });
      assert(m.profile === "tablet-landscape-side", `profile: ${m.profile}`);
      assert(m.headBadge === false, "tablet landscape should not anchor emoji on portrait head");
      assert(m.thoughtAboveHero, "emoji layer should be above-hero mode");
      assert(m.thoughtHeadBadge, "above-hero emoji should use floating badge chrome");
      assert(m.heroBelow === false, "above-hero anchor replaces below-hero");
      assert(m.emojiPx >= 88 && m.emojiPx <= 175, `emoji size out of range: ${m.emojiPx}px`);
      assert(Math.abs(m.satScale - 0.62) < 0.06, `satellite scale: ${m.satScale}`);
      assert(m.floorH >= 100, `combat floor too small: ${m.floorH}px`);
      assert(Math.abs(m.hudTop - m.enemyHudTop) <= 16, `HUD misaligned: player=${m.hudTop} enemy=${m.enemyHudTop}`);
      assert(m.playerZoneW >= m.vw * 0.24, `hero column too narrow: ${m.playerZoneW}px`);
      assert(m.heroTop > 0, "hero top missing");
      assert(m.playerEmojiCy < m.heroTop - 8, `emoji should sit above hero: cy=${m.playerEmojiCy} heroTop=${m.heroTop}`);
      assert(m.playerEmojiCy < m.playerHudBottom - 4 || m.playerEmojiCy < m.heroTop - 8,
        `emoji should stay above HUD/hero stack: cy=${m.playerEmojiCy}`);
      assert(m.playerEmojiCy < m.chromeTop - 24, `emoji should stay above toolbar: cy=${m.playerEmojiCy}`);
      assert(m.playerColCx > 0, "player column center missing");
      assert(Math.abs(m.playerSlotCx - m.playerColCx) <= 48, `player emoji off column: slot=${m.playerSlotCx} want~=${m.playerColCx}`);
      assert(m.playerSlotCx < m.vw * 0.38, `player emoji too central: ${m.playerSlotCx}`);
      assert(m.enemySlotCx > m.vw * 0.62, `enemy emoji too central: ${m.enemySlotCx}`);
    },
  },
  {
    id: "ipad-landscape-side-by-side",
    device: { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } },
    async run(page) {
      await quickStart(page);
      const island = await box(page, "#prep-field-island");
      const shop = await box(page, "#shop-panel");
      const vw = await page.evaluate(() => window.innerWidth);
      assert(island && island.w > 100, "field missing");
      assert(shop && shop.w > 120, "shop missing");
      assert(shop.left >= island.right - 24, `shop should be right of field: shop.left=${shop.left} island.right=${island.right}`);
      assert(shop.right <= vw + 2, "shop overflows viewport");
    },
  },
  {
    id: "ipad-landscape-prep-bottom-chrome",
    device: { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } },
    async run(page) {
      await quickStart(page);
      await page.evaluate(() => {
        window.applyUiLayout?.();
      });
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const chrome = document.getElementById("bottom-chrome")?.getBoundingClientRect();
        const vv = window.visualViewport;
        const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);
        const app = document.getElementById("app")?.getBoundingClientRect();
        const pinY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-chrome-pin-y")) || 0;
        return {
          chromeBottom: chrome?.bottom ?? 0,
          viewBottom,
          innerH: window.innerHeight,
          appBottom: app?.bottom ?? 0,
          chromeTop: chrome?.top ?? 0,
          pinY,
          tier: document.documentElement.dataset.uiTier,
        };
      });
      assert(m.tier === "tablet", `expected tablet tier, got ${m.tier}`);
      assert(m.chromeBottom >= m.viewBottom - 4, `chrome above visual bottom: gap=${m.viewBottom - m.chromeBottom}px pin=${m.pinY}`);
      assert(m.appBottom <= m.chromeTop + 4, `app overlaps bottom chrome: app=${m.appBottom} chrome=${m.chromeTop}`);
    },
  },
  {
    id: "desktop-prep-hero-portrait-visibility",
    device: { viewport: { width: 1440, height: 1080 } },
    async run(page) {
      await quickStart(page);
      await page.waitForFunction(
        () => document.getElementById("prep-hero-card-portrait-frame")?.dataset.hudPortrait === "bust",
        { timeout: 8000 },
      );
      const m = await page.evaluate(async () => {
        const frame = document.getElementById("prep-hero-card-portrait-frame");
        const portrait = document.getElementById("prep-hero-card-portrait");
        const img = document.getElementById("prep-hud-hero-img");
        if (!frame || !portrait || !img) return { ok: false, reason: "missing nodes" };
        if (img.decode) {
          try { await img.decode(); } catch { /* ignore */ }
        }
        const fr = frame.getBoundingClientRect();
        const pr = portrait.getBoundingClientRect();
        const ir = img.getBoundingClientRect();
        const frameCs = getComputedStyle(frame);
        const bustScale = parseFloat(frameCs.getPropertyValue("--prep-hud-portrait-bust-scale"))
          || parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--prep-hud-portrait-bust-scale"))
          || 0;
        const interW = Math.max(0, Math.min(ir.right, fr.right) - Math.max(ir.left, fr.left));
        let bustInk = { left: false, mid: false, right: false };
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const y0 = Math.floor(img.naturalHeight * 0.04);
          const bandH = Math.max(8, Math.floor(img.naturalHeight * 0.28));
          const colHasInk = (x) => {
            const data = ctx.getImageData(x, y0, 1, bandH).data;
            for (let i = 3; i < data.length; i += 4) {
              if (data[i] > 24) return true;
            }
            return false;
          };
          bustInk = {
            left: colHasInk(Math.floor(img.naturalWidth * 0.18)),
            mid: colHasInk(Math.floor(img.naturalWidth * 0.5)),
            right: colHasInk(Math.floor(img.naturalWidth * 0.82)),
          };
        }
        return {
          ok: true,
          prepLayout: document.documentElement.dataset.prepLayout,
          portraitW: pr.width,
          frameW: fr.width,
          frameH: fr.height,
          hudPortrait: frame.dataset.hudPortrait || "",
          bustScale,
          imgHidden: img.hidden,
          imgW: ir.width,
          imgH: ir.height,
          interRatio: fr.width > 0 ? interW / fr.width : 0,
          bustInk,
        };
      });
      assert(m.ok, m.reason || "portrait probe failed");
      assert(m.prepLayout === "side", `expected side prep layout, got ${m.prepLayout}`);
      assert(m.portraitW >= 140, `portrait column too narrow: ${m.portraitW}px`);
      assert(m.hudPortrait === "bust", `expected bust portrait mode, got ${m.hudPortrait}`);
      assert(m.bustScale > 0 && m.bustScale <= 2.2, `bust scale out of range: ${m.bustScale}`);
      assert(!m.imgHidden && m.imgW > 48 && m.imgH > 64, `hero img not visible: ${m.imgW}x${m.imgH}`);
      assert(m.interRatio >= 0.88, `portrait horizontal crop too tight: ${(m.interRatio * 100).toFixed(0)}%`);
      assert(m.bustInk.left && m.bustInk.mid && m.bustInk.right, `bust band missing sprite ink: ${JSON.stringify(m.bustInk)}`);
    },
  },
  {
    id: "desktop-prep-shop",
    device: { viewport: { width: 1440, height: 1080 } },
    async run(page) {
      await quickStart(page);
      const shop = await box(page, "#shop-panel");
      const island = await box(page, "#prep-field-island");
      assert(shop && shop.h > 80, "desktop shop too small");
      assert(island && island.h > 80, "desktop field too small");
      assert(shop.left > island.left + island.w * 0.35, "desktop shop not beside field");
    },
  },
];

const browser = await chromium.launch();
const failures = [];

for (const testCase of CASES) {
  const context = await browser.newContext({ ...testCase.device });
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push({ id: testCase.id, error: e.message }));
  try {
    await testCase.run(page);
    console.log(`✓ ${testCase.id}`);
  } catch (e) {
    failures.push({ id: testCase.id, error: e.message });
    console.error(`✗ ${testCase.id}: ${e.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} geometry test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${CASES.length} geometry tests passed.`);
