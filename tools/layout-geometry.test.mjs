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
      assert(prepSurface === "phone-landscape", `expected phone-landscape prep, got ${prepSurface}`);

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
