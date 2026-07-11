/**
 * RuntimeLoader: classic-only — без lazy lobby/hardbot бандлов.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function readLoaderState(page) {
  return page.evaluate(() => ({
    hasLoader: typeof RuntimeLoader !== "undefined",
    classicBundle: RuntimeLoader?.isBundleLoaded?.("classic"),
    combatFeedStub: !!CombatLog?._stub,
    combatFeedLoaded: typeof CombatLog?.addEvent === "function" && !CombatLog?._stub,
    lobbyScripts: RuntimeLoader?.scriptsForMode?.("classic")?.length ?? 0,
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
  assert(cold.classicBundle, "classic should need no extra scripts");
  assert(cold.combatFeedStub, "combat feed stub should be active on cold start");
  assert(!cold.combatFeedLoaded, "combat-feed.js should not load on cold start");
  assert(cold.lobbyScripts === 0, "classic should not list lobby scripts");

  await quickStartPrep(page, { settleMs: 600 });
  const classic = await readLoaderState(page);
  assert(classic.hasLoader, "RuntimeLoader after classic start");
  assert(classic.combatFeedLoaded, "combat-feed.js should load after prep");

  await browser.close();
  assert(errors.length === 0, `page errors: ${errors.join("; ")}`);
  console.log("runtime-loader.test.mjs: OK (classic-only loader)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
