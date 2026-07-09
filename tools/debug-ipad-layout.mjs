import { chromium, devices } from "playwright";

const baseUrl = `file://${process.cwd()}/index.html`;

async function enterLobbyBattle(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");
  await page.evaluate(() => {
    selectGameMode("lobby");
    selectPlayerClass("warrior");
    startRunFromOverlay();
  });
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep");
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    lobbyPrepTimerRemaining = 0;
    lobbyPrepTimerActive = false;
    startBattle();
  });
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle", { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.syncBattleSceneGridMetrics?.();
    window.scheduleBattleHeroRowSync?.(6);
    if (typeof toggleBattlePause === "function" && !isBattlePaused()) toggleBattlePause();
  });
  await page.waitForTimeout(800);
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const read = (side) => {
      const slotId = side === "player" ? "player-avatar-slot" : "enemy-avatar-slot";
      const panelId = side === "player" ? "player-avatar-panel" : "enemy-avatar-panel";
      const slot = document.getElementById(slotId);
      const panel = document.getElementById(panelId);
      const stage = slot?.querySelector(".avatar-hero-stage");
      const img = slot?.querySelector(".profile-avatar-img");
      const thought = document.getElementById(side === "player" ? "player-thought-slot" : "enemy-thought-slot");
      const hud = document.getElementById(side === "player" ? "battle-hud-player" : "battle-hud-enemy");
      const r = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: Math.round(b.x),
          y: Math.round(b.y),
          w: Math.round(b.width),
          h: Math.round(b.height),
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          overflow: cs.overflow,
          zIndex: cs.zIndex,
          clip: cs.clipPath || cs.clip,
          maxH: cs.maxHeight,
        };
      };
      return {
        panel: r(panel),
        slot: r(slot),
        stage: r(stage),
        img: r(img),
        thought: r(thought),
        hud: r(hud),
        imgVisible: img ? img.offsetParent !== null && img.getBoundingClientRect().height > 2 : false,
      };
    };
    return {
      battleProfile: document.documentElement.dataset.battleProfile,
      sceneUi: (() => {
        const el = document.getElementById("battle-scene-ui");
        const b = el?.getBoundingClientRect();
        const cs = el ? getComputedStyle(el) : null;
        return {
          rect: b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null,
          overflow: cs?.overflow,
          maxH: cs?.maxHeight,
        };
      })(),
      player: read("player"),
      enemy: read("enemy"),
      vv: { w: window.innerWidth, h: window.innerHeight },
    };
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } });
const page = await context.newPage();
await enterLobbyBattle(page);

let info = await inspectLayout(page);
console.log("OWN BATTLE:\n", JSON.stringify(info, null, 2));

await page.evaluate(() => {
  const idx = lobbyMatches.findIndex((m) => !m.isPlayerMatch && m.state);
  if (idx >= 0) setLobbySpectateMatch(idx);
});
await page.waitForTimeout(800);
info = await inspectLayout(page);
console.log("SPECTATE:\n", JSON.stringify(info, null, 2));

await page.screenshot({ path: "tools/debug-ipad-layout.png" });
await browser.close();
