/**
 * E2E: prep и battle после быстрого старта забега.
 * Запуск: npm run test:phases
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const PHASE_PROFILES = [
  { id: "iphone-portrait", device: devices["iPhone 14 Pro Max"] },
  {
    id: "iphone-landscape",
    device: {
      ...devices["iPhone 14 Pro Max"],
      viewport: { width: 932, height: 430 },
      isMobile: true,
      hasTouch: true,
    },
    expectUiSurface: "tablet-side",
    expectBattleProfile: "phone-landscape",
  },
  {
    id: "ipad-portrait",
    device: { ...devices["iPad Mini"], viewport: { width: 768, height: 1024 } },
  },
  {
    id: "ipad-landscape",
    device: { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } },
  },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function quickStart(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof selectGameMode === "function", { timeout: 10000 });
  await quickStartPrep(page, { settleMs: 1200 });
}

async function readPrepState(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const canvas = document.getElementById("game-canvas");
    const island = document.getElementById("prep-field-island");
    const cs = getComputedStyle(html);
    const appH = parseFloat(cs.getPropertyValue("--app-h")) || document.getElementById("app")?.offsetHeight || 0;
    const used = parseFloat(cs.getPropertyValue("--zone-used-h")) || 0;
    return {
      phase: document.getElementById("app")?.dataset.phase,
      prepLayout: html.dataset.prepLayout,
      uiSurface: html.dataset.uiSurface,
      canvasH: canvas?.offsetHeight ?? 0,
      islandH: island?.offsetHeight ?? 0,
      appH: Math.round(appH),
      zoneUsedH: Math.round(used),
      overlayHidden: document.getElementById("class-overlay")?.classList.contains("hidden"),
    };
  });
}

async function readBattleState(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const floor = document.getElementById("battle-thought-arena");
    const scene = document.getElementById("battle-scene-ui");
    return {
      phase: document.getElementById("app")?.dataset.phase,
      battleProfile: html.dataset.battleProfile,
      heroPlacement: html.dataset.battleHeroPlacement,
      arenaLayout: html.dataset.battleArenaLayout,
      floorH: floor?.offsetHeight ?? 0,
      sceneH: scene?.offsetHeight ?? 0,
      heroZoneH: parseFloat(getComputedStyle(html).getPropertyValue("--battle-hero-zone-h")) || 0,
      arenaMinH: parseFloat(getComputedStyle(html).getPropertyValue("--battle-thought-arena-min-h")) || 0,
      zoneFloorH: parseFloat(getComputedStyle(html).getPropertyValue("--zone-battle-floor-h")) || 0,
    };
  });
}

const browser = await chromium.launch();
const failures = [];

for (const profile of PHASE_PROFILES) {
  const context = await browser.newContext({ ...profile.device });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await quickStart(page);
    const prep = await readPrepState(page);

    assert(prep.phase === "prep", `expected prep, got ${prep.phase}`);
    assert(prep.overlayHidden, "class-overlay should be hidden in prep");
    assert(prep.canvasH > 48, `canvas too small in prep: ${prep.canvasH}px`);
    assert(prep.islandH > 48, `field island too small: ${prep.islandH}px`);
    if (prep.zoneUsedH > 0 && prep.appH > 0) {
      assert(prep.zoneUsedH <= prep.appH + 36, `zones overflow: used=${prep.zoneUsedH} app=${prep.appH}`);
    }
    if (errors.length) throw new Error(errors.join("; "));

    if (profile.expectUiSurface) {
      assert(prep.uiSurface === profile.expectUiSurface, `uiSurface: ${prep.uiSurface} !== ${profile.expectUiSurface}`);
    }

    console.log(`✓ ${profile.id} prep`, JSON.stringify({
      uiSurface: prep.uiSurface,
      canvasH: prep.canvasH,
      zoneUsedH: prep.zoneUsedH,
      appH: prep.appH,
    }));

    await page.evaluate(() => startBattle());
    await page.waitForFunction(
      () => document.getElementById("app")?.dataset.phase === "battle",
      { timeout: 10000 },
    );
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.applyUiLayout?.();
      window.fitCanvasDisplaySize?.();
      window.scheduleCanvasFit?.();
    });
    await page.waitForTimeout(800);

      const battle = await readBattleState(page);
      assert(battle.phase === "battle", `expected battle, got ${battle.phase}`);
      const fxScale = await page.evaluate(() => parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--fx-float-scale"),
      ) || 0);
      assert(fxScale > 0 && fxScale <= 1.05, `fx-float-scale missing: ${fxScale}`);
    assert(battle.heroPlacement === "flank-arena", `hero placement: ${battle.heroPlacement}`);
    assert(battle.arenaLayout === "true", `arena layout not active: ${battle.arenaLayout}`);
    assert(battle.floorH > 36, `combat floor too small: ${battle.floorH}px`);
    assert(battle.heroZoneH >= 80, `hero zone too small: ${battle.heroZoneH}px`);
    if (profile.expectBattleProfile) {
      assert(battle.battleProfile === profile.expectBattleProfile, `battleProfile: ${battle.battleProfile}`);
    }

    const inViewport = await page.evaluate(() => {
      const vh = window.innerHeight;
      const floor = document.getElementById("battle-thought-arena")?.getBoundingClientRect();
      const scene = document.getElementById("battle-scene-ui")?.getBoundingClientRect();
      return {
        floorBottom: floor?.bottom ?? 0,
        sceneTop: scene?.top ?? 0,
        vh,
      };
    });
    assert(inViewport.floorBottom <= inViewport.vh + 4, `combat floor below viewport: ${inViewport.floorBottom} > ${inViewport.vh}`);
    assert(inViewport.sceneTop >= -8, `battle scene clipped above: top=${inViewport.sceneTop}`);

    console.log(`✓ ${profile.id} battle`, JSON.stringify({
      battleProfile: battle.battleProfile,
      floorH: battle.floorH,
      heroZoneH: battle.heroZoneH,
    }));
  } catch (e) {
    failures.push({ id: profile.id, error: e.message });
    console.error(`✗ ${profile.id}: ${e.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} phase test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${PHASE_PROFILES.length} phase profiles passed (prep + battle).`);
