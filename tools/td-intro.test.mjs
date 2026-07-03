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

const browser = await chromium.launch();
try {
  for (const profile of PROFILES) {
    await runProfile(browser, profile);
  }
  console.log("td-intro: all ok");
} finally {
  await browser.close();
}
