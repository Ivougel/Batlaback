/**
 * TD intro: шаг сложности виден на планшете (iPad portrait/landscape, diablo theme).
 * Запуск: node tools/td-intro.test.mjs
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const PROFILES = [
  { id: "ipad-portrait", device: { ...devices["iPad Mini"], viewport: { width: 768, height: 1024 } } },
  { id: "ipad-landscape-diablo", device: { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } }, diablo: true },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function readTdDifficultyState(page) {
  return page.evaluate(() => {
    const step = document.getElementById("class-step-td-difficulty");
    const grid = document.getElementById("td-difficulty-grid");
    const cards = grid ? [...grid.querySelectorAll(".td-difficulty-card")] : [];
    const gridRect = grid?.getBoundingClientRect();
    return {
      introStep: document.getElementById("class-overlay")?.dataset.classIntroStep,
      stepHidden: step?.classList.contains("hidden"),
      cardCount: cards.length,
      gridH: gridRect?.height ?? 0,
      minCardH: cards.reduce((m, c) => Math.min(m, c.getBoundingClientRect().height || Infinity), Infinity),
      badge: document.getElementById("class-step-badge")?.textContent?.trim() ?? "",
      title: document.getElementById("class-modal-title")?.textContent?.trim() ?? "",
    };
  });
}

async function runProfile(browser, profile) {
  const page = await browser.newPage(profile.device);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof selectGameMode === "function", { timeout: 10000 });
  if (profile.diablo) {
    await page.evaluate(() => {
      document.documentElement.dataset.visualTheme = "diablo";
    });
  }
  await page.evaluate(() => {
    selectGameMode("td");
  });
  await page.waitForTimeout(600);
  const state = await readTdDifficultyState(page);
  assert(state.introStep === "tdDifficulty", `${profile.id}: intro step`);
  assert(!state.stepHidden, `${profile.id}: td difficulty step visible`);
  assert(state.cardCount === 5, `${profile.id}: expected 5 cards, got ${state.cardCount}`);
  assert(state.gridH >= 120, `${profile.id}: grid too short (${state.gridH}px)`);
  assert(Number.isFinite(state.minCardH) && state.minCardH >= 48, `${profile.id}: cards collapsed`);
  assert(state.title === "Сложность обороны", `${profile.id}: title`);
  assert(state.badge.includes("Сложность"), `${profile.id}: badge "${state.badge}"`);
  await page.evaluate(() => {
    selectTdDifficulty("hard");
  });
  await page.waitForFunction(
    () => document.getElementById("class-step-player") && !document.getElementById("class-step-player").classList.contains("hidden"),
    { timeout: 3000 },
  );
  await page.close();
  console.log(`✓ ${profile.id}`);
}

async function runTdRunStart(browser) {
  const page = await browser.newPage({ ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 10000 });
  await page.evaluate(() => {
    selectGameMode("td");
    selectTdDifficulty("normal");
    selectPlayerClass("priest");
    const c = document.querySelector("[data-companion]");
    if (c) { c.click(); c.click(); }
    startRunFromOverlay();
  });
  await page.waitForFunction(
    () => document.getElementById("app")?.dataset.phase === "battle",
    { timeout: 8000 },
  );
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => {
    const mount = document.getElementById("td-arena-mount");
    const canvas = document.getElementById("td-arena-canvas");
    const fieldCol = document.getElementById("prep-field-column");
    const buildPanel = document.getElementById("td-build-panel");
    const shopPanel = document.getElementById("shop-panel");
    const mountRect = mount?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const fieldRect = fieldCol?.getBoundingClientRect();
    const buildRect = buildPanel?.getBoundingClientRect();
    const arena = document.querySelector(".battle-arena")?.getBoundingClientRect();
    const mapShare = fieldRect && buildRect && buildRect.width > 0
      ? fieldRect.width / (fieldRect.width + buildRect.width)
      : 0;
    return {
      phase: document.getElementById("app")?.dataset.phase,
      tdRunLive: document.getElementById("app")?.dataset.tdRunLive,
      tdArenaHidden: mount?.classList.contains("hidden"),
      fightHidden: document.getElementById("btn-fight")?.classList.contains("hidden"),
      buildPanelHidden: buildPanel?.classList.contains("hidden"),
      shopVisible: shopPanel && getComputedStyle(shopPanel).display !== "none",
      mountH: mountRect?.height ?? 0,
      canvasH: canvasRect?.height ?? 0,
      fieldH: fieldRect?.height ?? 0,
      buildH: buildRect?.height ?? 0,
      mapShare,
      towerCols: window.TD_TOWER_COLS,
      slotButtons: buildPanel?.querySelectorAll(".td-build-slot")?.length ?? 0,
    };
  });
  assert(state.phase === "battle", "td run should enter battle phase");
  assert(state.tdRunLive === "true", "td run live flag");
  assert(!state.tdArenaHidden, "td arena visible");
  assert(state.fightHidden, "fight hidden during td run");
  assert(!state.buildPanelHidden, "td build panel visible");
  assert(!state.shopVisible, "old shop hidden during td run");
  assert(state.slotButtons === 5, `expected 5 slot buttons, got ${state.slotButtons}`);
  assert(state.towerCols === 6, `tower grid cols should be 6, got ${state.towerCols}`);
  assert(state.mapShare >= 0.47 && state.mapShare <= 0.53, `map share out of range: ${state.mapShare}`);
  assert(state.fieldH >= 180, `prep-field-column too short (${state.fieldH}px)`);
  assert(state.mountH >= 160, `td arena mount too short (${state.mountH}px)`);
  assert(state.canvasH >= 120, `td canvas too short (${state.canvasH}px)`);
  assert(state.buildH >= 120, `td build panel too short (${state.buildH}px)`);
  await page.close();
  console.log("✓ td-run-start");
}

const browser = await chromium.launch();
try {
  for (const profile of PROFILES) {
    await runProfile(browser, profile);
  }
  await runTdRunStart(browser);
  console.log("td-intro: all ok");
} finally {
  await browser.close();
}
