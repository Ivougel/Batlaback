/**
 * Профилирование лобби: 3 раунда, переключение наблюдения, замер dt.
 * Запуск: node tools/debug-lobby-rounds.mjs
 */
import { chromium } from "playwright";

const baseUrl = `file://${process.cwd()}/index.html`;

async function samplePerf(page) {
  return page.evaluate(() => {
    const matches = typeof lobbyMatches !== "undefined" ? lobbyMatches : [];
    let replayFrames = 0;
    let itemCount = 0;
    matches.forEach((m) => {
      replayFrames += m.state?.replayFrames?.length || 0;
      itemCount += (m.state?.player?.items?.length || 0) + (m.state?.enemy?.items?.length || 0);
    });
    return {
      phase: document.getElementById("app")?.dataset.phase,
      round,
      spectateId: lobbySpectateMatchId,
      matchCount: matches.length,
      replayFrames,
      itemCount,
      lastDt: typeof lastGameLoopDt === "number" ? Math.round(lastGameLoopDt * 1000) : null,
      bgAcc: typeof lobbyBackgroundSimAcc !== "undefined" ? lobbyBackgroundSimAcc.size : null,
    };
  });
}

async function skipPrepAndBattle(page) {
  await page.evaluate(() => {
    lobbyPrepTimerRemaining = 0;
    lobbyPrepTimerActive = false;
    if (typeof toggleBattlePause === "function" && typeof isBattlePaused === "function" && isBattlePaused()) {
      toggleBattlePause();
    }
    startBattle();
  });
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle", { timeout: 15000 });
  await page.waitForTimeout(600);
}

async function finishPlayerBattleAndContinue(page) {
  await page.evaluate(() => {
    const playerMatch = lobbyMatches.find((m) => m.isPlayerMatch);
    if (playerMatch?.state && !playerMatch.state.finished) {
      fastForwardLobbyMatch(playerMatch);
      if (!battleEndHandled && playerMatch.state.finished) endBattle();
    }
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    if (typeof toggleBattlePause === "function" && typeof isBattlePaused === "function" && !isBattlePaused()) {
      toggleBattlePause();
    }
    if (lobbyRoundSettling && typeof finishLobbyRoundFromContinue === "function") {
      finishLobbyRoundFromContinue();
    }
    document.getElementById("btn-battle-continue")?.click();
  });
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep", { timeout: 20000 });
  await page.waitForTimeout(400);
}

async function measureSpectateLoad(page, roundNum) {
  const spectateIdx = await page.evaluate(() => {
    const idx = lobbyMatches.findIndex((m) => !m.isPlayerMatch && !m.byeFighterId && m.state);
    if (idx >= 0) setLobbySpectateMatch(idx);
    return idx;
  });
  await page.waitForTimeout(300);

  const samples = [];
  for (let i = 0; i < 12; i += 1) {
    await page.evaluate(() => {
      if (typeof toggleBattlePause === "function" && typeof isBattlePaused === "function" && isBattlePaused()) {
        toggleBattlePause();
      }
    });
    await page.waitForTimeout(200);
    samples.push(await samplePerf(page));
  }

  const dts = samples.map((s) => s.lastDt).filter((v) => v != null);
  const avgDt = dts.length ? Math.round(dts.reduce((a, b) => a + b, 0) / dts.length) : null;
  const maxDt = dts.length ? Math.max(...dts) : null;
  console.log(`\n--- Раунд ${roundNum} (spectate idx ${spectateIdx}) ---`);
  console.log(JSON.stringify({ ...samples[samples.length - 1], avgDt, maxDt, samples: dts }, null, 2));

  await page.evaluate(() => {
    if (typeof toggleBattlePause === "function" && typeof isBattlePaused === "function" && !isBattlePaused()) {
      toggleBattlePause();
    }
  });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");

  await page.evaluate(() => {
    selectGameMode("lobby");
    selectPlayerClass("warrior");
    startRunFromOverlay();
  });
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep");

  for (let r = 1; r <= 3; r += 1) {
    const prepRound = await page.evaluate(() => round);
    console.log(`\n>>> Старт боя, prep round=${prepRound}`);
    await skipPrepAndBattle(page);
    await measureSpectateLoad(page, r);
    await finishPlayerBattleAndContinue(page);
  }

  if (errors.length) console.log("\nerrors:", errors);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
