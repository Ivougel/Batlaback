/**
 * Контракт UI: режимы, фазы, overlay DOM, layout-профили.
 * Запуск: npm run test:structure
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "tools/ui-structure-manifest.json"), "utf8"),
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function boot(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof selectGameMode === "function", { timeout: 10000 });
}

async function startPrep(page, mode) {
  await page.evaluate((gameMode) => {
    selectGameMode(gameMode);
    if (gameMode === "td" && typeof selectTdDifficulty === "function") {
      selectTdDifficulty("normal");
    }
    if (gameMode === "campaign" && typeof selectCampaignTrial === "function") {
      selectCampaignTrial("build-trial");
    }
    selectPlayerClass("priest");
    if (typeof selectCompanion === "function") {
      selectCompanion(
        typeof defaultCompanionForClass === "function"
          ? defaultCompanionForClass("priest")
          : "s_stranger",
      );
    }
    if (gameMode === "versus") selectOpponentClass("warrior");
    else if (gameMode !== "lobby" && gameMode !== "td" && gameMode !== "campaign") selectOpponentClass("mage");
    startRunFromOverlay();
  }, mode);
  await page.waitForFunction(
    (gameMode) => {
      const app = document.getElementById("app");
      if (!app) return false;
      if (gameMode === "td") return app.dataset.gameMode === "td";
      return app.dataset.phase === "prep";
    },
    mode,
    { timeout: 12000 },
  );
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
  });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();
const failures = [];

try {
  const page = await browser.newPage();
  await boot(page);
  const domCheck = await page.evaluate((ids) => {
    const missing = ids.filter((id) => !document.getElementById(id));
    return { missing, total: ids.length };
  }, [
    ...manifest.overlays.map((o) => o.id),
    ...manifest.appSheets.map((s) => s.id),
    ...manifest.gamePanels.map((p) => p.id),
    ...manifest.classIntroSteps.map((s) => s.elementId),
    "app",
    "bottom-chrome",
    "game-canvas",
    "battle-scene-ui",
    "battle-thought-arena",
  ]);

  if (domCheck.missing.length) {
    failures.push(`Missing DOM ids: ${domCheck.missing.join(", ")}`);
  } else {
    console.log(`✓ DOM contract (${domCheck.total} elements)`);
  }

  for (const profile of manifest.layoutProfiles) {
    const ctx = await browser.newContext({
      ...(profile.id.startsWith("iphone") ? devices["iPhone 14 Pro Max"] : {}),
      ...(profile.id.startsWith("ipad") ? devices["iPad Mini"] : {}),
      viewport: profile.viewport,
      isMobile: profile.id !== "desktop",
      hasTouch: profile.id !== "desktop",
    });
    const p = await ctx.newPage();
    try {
      await boot(p);
      await p.evaluate(() => window.applyUiLayout?.());
      await p.waitForTimeout(300);
      const state = await p.evaluate(() => ({
        prepLayout: document.documentElement.dataset.prepLayout,
        uiSurface: document.documentElement.dataset.uiSurface,
        layoutProfile: document.documentElement.dataset.layoutProfile,
        battleProfile: document.documentElement.dataset.battleProfile,
        tier: document.documentElement.dataset.uiTier,
      }));
      const exp = profile.expect;
      for (const [key, val] of Object.entries(exp)) {
        if (state[key] !== val) {
          failures.push(`${profile.id}: ${key}=${state[key]} expected ${val}`);
        }
      }
      if (!failures.some((f) => f.startsWith(profile.id))) {
        console.log(`✓ layout ${profile.id}`, JSON.stringify(state));
      }
    } finally {
      await ctx.close();
    }
  }

  const modePage = await browser.newPage({
    viewport: manifest.layoutProfiles.find((p) => p.id === "ipad-landscape").viewport,
  });
  await boot(modePage);

  for (const mode of manifest.gameModes) {
    await boot(modePage);
    await startPrep(modePage, mode);
    const state = await modePage.evaluate(() => ({
      phase: document.getElementById("app")?.dataset.phase,
      gameMode: document.getElementById("app")?.dataset.gameMode,
      tdHintHidden: document.getElementById("td-hint-bar")?.classList.contains("hidden"),
      tdHintDisplay: document.getElementById("td-hint-bar")
        ? getComputedStyle(document.getElementById("td-hint-bar")).display
        : null,
      campaignHintHidden: document.getElementById("campaign-hint-bar")?.classList.contains("hidden"),
      campaignHintDisplay: document.getElementById("campaign-hint-bar")
        ? getComputedStyle(document.getElementById("campaign-hint-bar")).display
        : null,
      lobbyRoster: document.getElementById("lobby-prep-roster-panel")?.classList.contains("hidden"),
    }));

    assert(state.gameMode === mode, `${mode}: gameMode`);

    if (mode === "td") {
      assert(state.phase === "prep" || state.phase === "battle", `${mode}: phase ${state.phase}`);
    } else {
      assert(state.phase === "prep", `${mode}: phase`);
    }

    if (mode === "lobby") {
      assert(!state.lobbyRoster, `${mode}: lobby roster should be visible`);
    }
    if (mode !== "td") {
      assert(state.tdHintHidden, `${mode}: td-hint should have hidden class`);
      assert(state.tdHintDisplay === "none", `${mode}: td-hint display none, got ${state.tdHintDisplay}`);
    }
    if (mode === "campaign") {
      assert(!state.campaignHintHidden, `${mode}: campaign-hint should be visible in prep`);
      assert(state.campaignHintDisplay !== "none", `${mode}: campaign-hint display, got ${state.campaignHintDisplay}`);
    } else {
      assert(state.campaignHintHidden, `${mode}: campaign-hint should have hidden class`);
      assert(state.campaignHintDisplay === "none", `${mode}: campaign-hint display none, got ${state.campaignHintDisplay}`);
    }
    console.log(`✓ prep mode ${mode}`, JSON.stringify(state));
  }
} catch (err) {
  failures.push(err.message);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("\n✗ ui-structure failures:\n", failures.join("\n"));
  process.exit(1);
}
console.log("\n✓ ui-structure: all checks passed");
