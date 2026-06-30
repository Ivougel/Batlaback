/**
 * Геометрия ключевых зон — без pixel-snapshots (стабильно в CI).
 * Запуск: npm run test:geometry
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html?vexp=0`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function quickStart(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");
  await page.evaluate(() => {
    selectGameMode("solo");
    selectPlayerClass("warrior");
    selectOpponentClass("mage");
    startRunFromOverlay();
  });
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep");
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
    window.syncMobileShopFabPosition?.();
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
    id: "iphone-portrait-prep-vexp",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await page.goto(baseUrl.replace("vexp=0", "vexp=1"), { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(() => typeof startRunFromOverlay === "function");
      await page.evaluate(() => {
        localStorage.setItem("bb_visual_experiment", "1");
        document.documentElement.dataset.visualExperiment = "true";
        selectGameMode("solo");
        selectPlayerClass("warrior");
        selectOpponentClass("mage");
        startRunFromOverlay();
      });
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep");
      await page.waitForTimeout(800);
      await page.evaluate(() => { window.applyUiLayout?.(); window.scheduleCanvasFit?.(); });
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const canvas = document.getElementById("game-canvas")?.getBoundingClientRect();
        const hero = document.querySelector(".prep-character-layer")?.getBoundingClientRect();
        const pos = getComputedStyle(document.querySelector(".prep-character-layer")).position;
        return {
          canvasH: canvas?.height ?? 0,
          voidBelow: hero && canvas ? hero.top - canvas.bottom : 999,
          heroPos: pos,
        };
      });
      assert(m.canvasH >= 260, `canvas too small: ${m.canvasH}px`);
      assert(m.voidBelow <= 48, `vexp hero gap below canvas: ${m.voidBelow}px`);
      assert(m.heroPos === "absolute", `vexp hero should be absolute, got ${m.heroPos}`);
    },
  },
  {
    id: "iphone-portrait-battle-vexp-gap",
    device: devices["iPhone 14 Pro Max"],
    async run(page) {
      await page.goto(baseUrl.replace("vexp=0", "vexp=1"), { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(() => typeof startRunFromOverlay === "function");
      await page.evaluate(() => {
        localStorage.setItem("bb_visual_experiment", "1");
        document.documentElement.dataset.visualExperiment = "true";
        selectGameMode("solo");
        selectPlayerClass("warrior");
        selectOpponentClass("mage");
        startRunFromOverlay();
      });
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep");
      await page.evaluate(() => startBattle());
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
      await page.waitForFunction(
        () => !document.getElementById("battle-countdown-overlay")
          ?.classList.contains("battle-countdown-overlay-visible"),
        { timeout: 12000 },
      );
      await page.waitForTimeout(800);
      await page.evaluate(() => { window.applyUiLayout?.(); window.scheduleCanvasFit?.(); });
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const thought = document.getElementById("battle-thought-arena")?.getBoundingClientRect();
        const chrome = document.querySelector(".bottom-chrome")?.getBoundingClientRect();
        return {
          gap: thought && chrome ? chrome.top - thought.bottom : 999,
          floorH: thought?.height ?? 0,
        };
      });
      assert(m.gap <= 72, `dead zone below combat floor: ${m.gap}px`);
      assert(m.floorH >= 120, `combat floor too small: ${m.floorH}px`);
    },
  },
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
        return {
          fightW: fight?.width ?? 0,
          barW: bar?.width ?? 0,
          labelHidden,
          fightOnOwnRow: fight && bar ? fight.width >= bar.width * 0.92 : false,
        };
      });
      assert(m.labelHidden, "prep side labels should be icon-only on mobile");
      assert(m.fightOnOwnRow, `fight btn not full width: ${m.fightW}/${m.barW}`);
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
        const stage = document.querySelector("#player-avatar-slot .avatar-hero-stage")?.getBoundingClientRect();
        return {
          floorH: floor?.height ?? 0,
          emojiPx,
          floorRatio: floor && emojiPx ? emojiPx / floor.height : 0,
          hudTop: playerHud?.top ?? 0,
          stageBottom: stage?.bottom ?? 0,
        };
      });
      assert(m.floorH > 48, "combat floor too small");
      assert(m.emojiPx >= 68, `emoji too small: ${m.emojiPx}px`);
      if (m.floorH > 280) {
        assert(m.emojiPx >= 100, `emoji should use headroom on tall floor: ${m.emojiPx}px`);
      } else {
        assert(m.floorRatio >= 0.38, `emoji/floor ratio low: ${m.floorRatio.toFixed(2)}`);
      }
      assert(m.hudTop >= m.stageBottom - 4, `HUD overlaps portrait: hud=${m.hudTop} stage=${m.stageBottom}`);
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
      assert(m.fightW <= m.barW * 0.42, `toolbar too wide/spread: fight=${m.fightW} bar=${m.barW}`);
      if (m.heroImgH > 0 && m.heroLayerH > 0) {
        assert(m.heroImgH <= m.heroLayerH * 1.08, `hero image cropped: img=${m.heroImgH} layer=${m.heroLayerH}`);
      }
    },
  },
  {
    id: "iphone-landscape-prep-vexp",
    device: {
      ...devices["iPhone 14 Pro Max"],
      viewport: { width: 932, height: 430 },
      isMobile: true,
      hasTouch: true,
    },
    async run(page) {
      await page.goto(baseUrl.replace("vexp=0", "vexp=1"), { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(() => typeof startRunFromOverlay === "function");
      await page.evaluate(() => {
        localStorage.setItem("bb_visual_experiment", "1");
        document.documentElement.dataset.visualExperiment = "true";
        selectGameMode("solo");
        selectPlayerClass("warrior");
        selectOpponentClass("mage");
        startRunFromOverlay();
      });
      await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep");
      await page.waitForTimeout(800);
      await page.evaluate(() => { window.applyUiLayout?.(); window.scheduleCanvasFit?.(); });
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const hero = document.querySelector(".prep-character-layer")?.getBoundingClientRect();
        const island = document.getElementById("prep-field-island")?.getBoundingClientRect();
        const shop = document.getElementById("shop-panel")?.getBoundingClientRect();
        const fieldCol = document.querySelector(".prep-field-column")?.getBoundingClientRect();
        const top = parseFloat(getComputedStyle(document.querySelector(".prep-character-layer")).top) || 0;
        return {
          surface: document.documentElement.dataset.uiSurface,
          prepLayout: document.documentElement.dataset.prepLayout,
          heroTop: hero?.top ?? 0,
          islandBottom: island?.bottom ?? 0,
          shopLeft: shop?.left ?? 0,
          fieldRight: fieldCol?.right ?? 0,
          cssTop: top,
        };
      });
      assert(m.surface === "tablet-side", `vexp landscape surface: ${m.surface}`);
      assert(m.prepLayout === "side", `vexp prep layout: ${m.prepLayout}`);
      assert(m.shopLeft >= m.fieldRight - 12, `vexp shop not on right: ${m.shopLeft} vs ${m.fieldRight}`);
      assert(m.heroTop >= m.islandBottom - 12, `vexp hero not below canvas: ${m.heroTop} vs ${m.islandBottom}`);
      assert(m.cssTop < 200, `vexp hero css top too large: ${m.cssTop}px`);
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
    id: "ipad-portrait-shop-scroll",
    device: devices["iPad Mini"],
    async run(page) {
      await quickStart(page);
      const surface = await page.evaluate(() => document.documentElement.dataset.uiSurface);
      assert(surface === "tablet-stacked", `expected tablet-stacked, got ${surface}`);

      const shop = await page.evaluate(() => {
        const panel = document.getElementById("shop-panel");
        const slots = panel?.querySelector(".shop-slots");
        if (!panel || !slots) return null;
        const panelCs = getComputedStyle(panel);
        const slotsCs = getComputedStyle(slots);
        const pr = panel.getBoundingClientRect();
        return {
          panelOverflow: panelCs.overflowY,
          slotsOverflow: slotsCs.overflowY,
          scrollable: slots.scrollHeight > slots.clientHeight + 2,
          panelBottom: pr.bottom,
          vh: window.innerHeight,
        };
      });

      assert(shop, "shop panel missing");
      assert(shop.slotsOverflow === "auto" || shop.slotsOverflow === "scroll", `shop-slots overflow: ${shop.slotsOverflow}`);
      assert(shop.panelBottom <= shop.vh + 6, `shop overflows viewport: bottom=${shop.panelBottom} vh=${shop.vh}`);

      const layout = await page.evaluate(() => {
        const shopEl = document.getElementById("shop-panel");
        const sr = shopEl?.getBoundingClientRect();
        return { shopW: sr?.width ?? 0, vw: window.innerWidth };
      });
      assert(layout.shopW >= layout.vw * 0.88, `shop too narrow: ${layout.shopW}px vs vw ${layout.vw}`);
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

      const m = await page.evaluate(() => ({
        profile: document.documentElement.dataset.battleProfile,
        emojiPx: window.BattleHeroAnchor?.thoughtSlotEmojiSize?.() ?? 0,
        floorH: document.getElementById("battle-thought-arena")?.offsetHeight ?? 0,
        hudTop: document.getElementById("battle-hud-player")?.getBoundingClientRect().top ?? 0,
        stageBottom: document.querySelector("#player-avatar-slot .avatar-hero-stage")?.getBoundingClientRect().bottom ?? 0,
      }));
      assert(m.profile === "tablet-landscape-side", `profile: ${m.profile}`);
      assert(m.emojiPx >= 80, `emoji too small: ${m.emojiPx}px`);
      assert(m.floorH >= 80, `combat floor too small: ${m.floorH}px`);
      assert(m.hudTop >= m.stageBottom - 4, `HUD on portrait: hud=${m.hudTop} stage=${m.stageBottom}`);
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
