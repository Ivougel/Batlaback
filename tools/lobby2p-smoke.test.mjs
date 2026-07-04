/**
 * Smoke: lobby2p intro → split prep HUD → scheduled battle → P1/P2 tabs.
 * Запуск: npm run test:lobby2p
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quickStartLobby2p } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function readLobby2pState(page) {
  return page.evaluate(() => ({
    gameMode: document.getElementById("app")?.dataset.gameMode,
    phase: document.getElementById("app")?.dataset.phase,
    lobby2pHud: document.documentElement.hasAttribute("data-lobby2p-hud"),
    layoutVisible: !document.getElementById("lobby2p-prep-layout")?.classList.contains("hidden"),
    canvasInHost: !!document.getElementById("lobby2p-canvas-host")?.querySelector("#layer-world"),
    shopSlots0: document.getElementById("lobby2p-shop-slots-0")?.children.length ?? 0,
    shopSlots1: document.getElementById("lobby2p-shop-slots-1")?.children.length ?? 0,
    humanCount: typeof lobbyState !== "undefined" && lobbyState?.humanIds?.length,
    fighterCount: typeof lobbyState !== "undefined" ? lobbyState?.fighters?.length : 0,
    alive: typeof getAliveLobbyFighters === "function" && lobbyState
      ? getAliveLobbyFighters(lobbyState).length
      : 0,
  }));
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["iPad Mini"],
    viewport: { width: 1133, height: 744 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof selectGameMode === "function", { timeout: 10000 });
  await quickStartLobby2p(page, { settleMs: 1200 });

  const prep = await readLobby2pState(page);
  assert(prep.gameMode === "lobby2p", `gameMode lobby2p, got ${prep.gameMode}`);
  assert(prep.phase === "prep", `phase prep, got ${prep.phase}`);
  assert(prep.lobby2pHud, "data-lobby2p-hud missing");
  assert(prep.layoutVisible, "lobby2p-prep-layout hidden");
  assert(prep.canvasInHost, "canvas not mounted in lobby2p host");
  assert(prep.shopSlots0 > 0 && prep.shopSlots1 > 0, "dual shops empty");
  assert(prep.fighterCount === 16, `expected 16 fighters, got ${prep.fighterCount}`);
  assert(prep.humanCount === 2, `expected 2 humans, got ${prep.humanCount}`);

  await page.click('.lobby2p-col-actions[data-human="0"] .lobby2p-farm');
  const farmStarted = await page
    .waitForFunction(() => !!lobbyState.sideBattles[0]?.type, { timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  assert(farmStarted, "P1 farm battle not started");

  await page.evaluate(() => {
    lobbyState.sideBattles[0] = null;
    lobbyState.sideBattles[1] = null;
    lobbyState.ready[0] = true;
    lobbyState.ready[1] = true;
    tryStartLobby2pScheduledRound();
  });

  await page.waitForFunction(
    () => document.getElementById("app")?.dataset.phase === "battle",
    { timeout: 15000 },
  );
  await page.waitForTimeout(1000);

  const battle = await page.evaluate(() => {
    const p0Idx = lobbyMatches.findIndex((m) => m.isPlayerMatch && m.humanId === 0);
    const p1Idx = lobbyMatches.findIndex((m) => m.isPlayerMatch && m.humanId === 1);
    return {
      phase: document.getElementById("app")?.dataset.phase,
      matchCount: lobbyMatches.length,
      p0Idx,
      p1Idx,
      tabsVisible: !document.getElementById("lobby2p-battle-tabs")?.classList.contains("hidden"),
      spectateId: lobbySpectateMatchId,
    };
  });

  assert(battle.phase === "battle", `battle phase expected, got ${battle.phase}`);
  assert(battle.p0Idx >= 0 && battle.p1Idx >= 0, "missing human matches");
  assert(battle.tabsVisible, "lobby2p battle tabs hidden");

  await page.evaluate((p1Idx) => {
    setLobbySpectateMatch(p1Idx);
  }, battle.p1Idx);
  await page.waitForTimeout(400);

  const afterSwitch = await page.evaluate(() => ({
    spectateId: lobbySpectateMatchId,
    tab1Active: document.getElementById("lobby2p-battle-tab-1")?.classList.contains("lobby2p-battle-tab--active"),
  }));
  assert(afterSwitch.spectateId === battle.p1Idx, "P2 spectate switch failed");
  assert(afterSwitch.tab1Active, "P2 tab not active");

  if (errors.length) {
    console.warn("page errors:", errors);
  }

  console.log("lobby2p-smoke: OK", { prep, battle, afterSwitch });
  await browser.close();
}

main().catch((err) => {
  console.error("lobby2p-smoke FAILED:", err.message);
  process.exit(1);
});
