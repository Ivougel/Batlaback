import { chromium } from "playwright";

const baseUrl = `file://${process.cwd()}/index.html`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1133, height: 744 } });
const page = await context.newPage();

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof startRunFromOverlay === "function");
await page.evaluate(() => {
  selectGameMode("solo");
  selectPlayerClass("warrior");
  if (typeof selectCompanion === "function") {
    selectCompanion(
      typeof defaultCompanionForClass === "function" ? defaultCompanionForClass("warrior") : "s_stranger",
    );
  }
  selectOpponentClass("mage");
  startRunFromOverlay();
});
await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep");
await page.waitForTimeout(1000);
await page.evaluate(() => startBattle());
await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle", { timeout: 15000 });
await page.waitForFunction(
  () => !document.getElementById("battle-countdown-overlay")?.classList.contains("battle-countdown-overlay-visible"),
  { timeout: 12000 },
);
await page.waitForTimeout(1200);
await page.evaluate(() => {
  window.applyUiLayout?.();
  window.syncHeroEmotionSlotAnchors?.();
  if (typeof toggleBattlePause === "function" && !isBattlePaused()) toggleBattlePause();
});
await page.waitForTimeout(500);

const metrics = await page.evaluate(() => {
  const read = (side) => {
    const prep = document.getElementById(side === "player" ? "prep-character-player" : "prep-character-enemy");
    const prepImg = prep?.querySelector(".prep-character-img, .prep-character-emoji") || prep;
    const thought = document.getElementById(side === "player" ? "player-thought-slot" : "enemy-thought-slot");
    const body = thought?.querySelector(".battle-thought-body");
    const spec = document.getElementById(
      side === "player" ? "prep-character-spec-slot" : "prep-character-spec-slot-enemy",
    );
    const anchor = window.BattleHeroAnchor?.getThoughtSlotAnchor?.(side);
    const prepAnchor = window.BattleHeroAnchor?.getPrepSpecSlotThoughtAnchor?.(side);
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        x: Math.round(b.x),
        y: Math.round(b.y),
        w: Math.round(b.width),
        h: Math.round(b.height),
        cx: Math.round(b.x + b.width / 2),
        cy: Math.round(b.y + b.height / 2),
      };
    };
    return {
      prep: r(prepImg),
      spec: r(spec),
      thought: r(thought),
      body: r(body),
      anchor,
      prepAnchor,
      glyph: body?.textContent?.trim() || null,
    };
  };
  return {
    profile: document.documentElement.dataset.battleProfile,
    prepHeroLayer: document.documentElement.dataset.battlePrepHeroLayer,
    thoughtAboveHero: document.documentElement.dataset.thoughtAboveHero,
    player: read("player"),
    enemy: read("enemy"),
    vv: { w: window.innerWidth, h: window.innerHeight },
  };
});

console.log(JSON.stringify(metrics, null, 2));
await page.screenshot({ path: "tools/debug-thought-anchor.png", fullPage: false });
await browser.close();
