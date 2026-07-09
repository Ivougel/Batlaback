/**
 * RuntimeLoader: solo не тянет lobby/hardbot; lobby2p подгружает бандл при старте.
 * Запуск: npm run test:runtime-loader
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { quickStartLobby2p, quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function readLoaderState(page) {
  return page.evaluate(() => ({
    hasLoader: typeof RuntimeLoader !== "undefined",
    soloBundle: RuntimeLoader?.isBundleLoaded?.("solo"),
    lobbyBundle: RuntimeLoader?.isBundleLoaded?.("lobby2p"),
    hardbotBundle: RuntimeLoader?.isBundleLoaded?.("hardbot"),
    combatFeedStub: !!CombatLog?._stub,
    combatFeedLoaded: typeof CombatLog?.addEvent === "function" && !CombatLog?._stub,
    hasLobbyOpponents: typeof initLobby === "function" && typeof initLobby2p === "function",
    hasLobbyBridge: typeof wireLobbyRuntimeBindings === "function" && !!wireLobbyRuntimeBindings._done,
    hasHardBot: typeof createInitialHardBotState === "function",
    hasLobby2pHud: typeof Lobby2pHud !== "undefined",
    lobbyScripts: RuntimeLoader?.scriptsForMode?.("lobby2p")?.length ?? 0,
  }));
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof RuntimeLoader !== "undefined", { timeout: 10000 });

  const cold = await readLoaderState(page);
  assert(cold.hasLoader, "RuntimeLoader missing");
  assert(cold.soloBundle, "solo should need no extra scripts");
  assert(cold.combatFeedStub, "combat feed stub should be active on cold start");
  assert(!cold.combatFeedLoaded, "combat-feed.js should not load on cold start");
  assert(!cold.hasLobbyOpponents, "lobby-opponents should not load on cold start");
  assert(!cold.hasLobbyBridge, "lobby-runtime bridge should not wire on cold start");
  assert(!cold.hasHardBot, "hard-bot-engine should not load on cold start");
  assert(cold.lobbyScripts >= 6, "lobby2p bundle should list lobby scripts");

  await quickStartPrep(page, { mode: "solo", settleMs: 600 });
  const solo = await readLoaderState(page);
  assert(solo.hasLoader, "RuntimeLoader after solo start");
  assert(solo.combatFeedLoaded, "combat-feed.js should load after solo prep");
  assert(!solo.hasLobbyOpponents, "solo run must not load lobby-opponents");
  assert(!solo.hasHardBot, "solo run must not load hard-bot-engine");

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof RuntimeLoader !== "undefined", { timeout: 10000 });
  await quickStartLobby2p(page, { settleMs: 600 });

  const lobby = await readLoaderState(page);
  assert(lobby.lobbyBundle, "lobby2p bundle should be loaded after start");
  assert(lobby.hasLobbyOpponents, "lobby-opponents must load for lobby2p");
  assert(lobby.hasLobbyBridge, "lobby-runtime bridge must wire for lobby2p");
  assert(lobby.hasLobby2pHud, "Lobby2pHud missing after lobby bundle");

  await browser.close();
  assert(errors.length === 0, `page errors: ${errors.join("; ")}`);
  console.log("runtime-loader.test.mjs: OK (solo lean, lobby2p lazy bundle)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
