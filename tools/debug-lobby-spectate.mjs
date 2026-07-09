import { chromium, devices } from "playwright";

const baseUrl = `file://${process.cwd()}/index.html`;

async function inspectPortraits(page, _label) {
  return page.evaluate(() => {
    const readSlot = (id) => {
      const slot = document.getElementById(id);
      const shell = slot?.querySelector(".avatar-hero-shell");
      const stage = shell?.querySelector(".avatar-hero-stage");
      const avatar = shell?.querySelector(".profile-avatar");
      const img = shell?.querySelector(".profile-avatar-img");
      const stageRect = stage?.getBoundingClientRect();
      const panelRect = document.getElementById(id.replace("-slot", "-panel"))?.getBoundingClientRect();
      return {
        hasShell: !!shell,
        hasStage: !!stage,
        hasAvatar: !!avatar,
        imgSrc: img?.getAttribute("src") || null,
        avatarText: avatar?.textContent?.trim()?.slice(0, 20) || null,
        stageW: stageRect ? Math.round(stageRect.width) : 0,
        stageH: stageRect ? Math.round(stageRect.height) : 0,
        panelH: panelRect ? Math.round(panelRect.height) : 0,
        shellSig: slot?.dataset.heroShellSig || null,
      };
    };
    return {
      phase: document.getElementById("app")?.dataset.phase,
      lobbySpectate: document.getElementById("app")?.dataset.lobbySpectate,
      layoutProfile: document.documentElement.dataset.layoutProfile,
      battleProfile: document.documentElement.dataset.battleProfile,
      uiSurface: document.documentElement.dataset.uiSurface,
      heroImgH: getComputedStyle(document.documentElement).getPropertyValue("--battle-hero-img-h").trim(),
      player: readSlot("player-avatar-slot"),
      enemy: readSlot("enemy-avatar-slot"),
      spectateId: typeof lobbySpectateMatchId !== "undefined" ? lobbySpectateMatchId : null,
      matchCount: typeof lobbyMatches !== "undefined" ? lobbyMatches.length : 0,
    };
  });
}

async function run(deviceName, device) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
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
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    if (typeof skipLobbyPrepTimer === "function") skipLobbyPrepTimer();
    else if (typeof forceLobbyPrepEnd === "function") forceLobbyPrepEnd();
    else {
      lobbyPrepTimerRemaining = 0;
      lobbyPrepTimerActive = false;
    }
    startBattle();
  });

  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle", { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.syncBattleSceneGridMetrics?.();
    window.scheduleBattleHeroRowSync?.(4);
    if (typeof toggleBattlePause === "function" && typeof isBattlePaused === "function" && !isBattlePaused()) {
      toggleBattlePause();
    }
  });
  await page.waitForTimeout(600);

  const own = await inspectPortraits(page, "own");
  console.log(`\n=== ${deviceName} — own battle ===`);
  console.log(JSON.stringify(own, null, 2));

  const spectateIdx = await page.evaluate(() => {
    const idx = lobbyMatches.findIndex((m) => !m.isPlayerMatch && !m.byeFighterId && m.state);
    if (idx >= 0) setLobbySpectateMatch(idx);
    return idx;
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.syncBattleSceneGridMetrics?.();
    window.scheduleBattleHeroRowSync?.(4);
    renderPlayerProfiles();
  });
  await page.waitForTimeout(600);

  const spectate = await inspectPortraits(page, "spectate");
  console.log(`\n=== ${deviceName} — spectate idx ${spectateIdx} ===`);
  console.log(JSON.stringify(spectate, null, 2));
  if (errors.length) console.log("errors:", errors);

  await page.screenshot({ path: `tools/debug-lobby-spectate-${deviceName}.png`, fullPage: false });
  await browser.close();
}

for (const [name, device] of [
  ["ipad", { ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } }],
  ["iphone-landscape", { ...devices["iPhone 14 Pro Max"], viewport: { width: 844, height: 390 } }],
]) {
  await run(name, device);
}
