/**
 * Расширенный QA-аудит геометрии UI — все ключевые экраны.
 * Запуск: node tools/layout-qa-audit.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

import { quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const PROFILES = [
  { id: "iphone-portrait", device: devices["iPhone 14 Pro Max"] },
  {
    id: "iphone-landscape",
    device: {
      ...devices["iPhone 14 Pro Max"],
      viewport: { width: 932, height: 430 },
      isMobile: true,
      hasTouch: true,
    },
  },
  { id: "ipad-portrait", device: devices["iPad Mini"] },
  {
    id: "ipad-landscape",
    device: {
      ...devices["iPad Mini"],
      viewport: { width: 1024, height: 768 },
      isMobile: true,
      hasTouch: true,
    },
  },
  {
    id: "desktop",
    device: {
      viewport: { width: 1440, height: 900 },
      isMobile: false,
      hasTouch: false,
      userAgent: devices["Desktop Chrome"].userAgent,
    },
  },
];

async function prepStart(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");
  await quickStartPrep(page, { settleMs: 800 });
}

async function battleStart(page) {
  await prepStart(page);
  await page.evaluate(() => startBattle());
  await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
  await page.waitForTimeout(800);
  await page.evaluate(() => window.applyUiLayout?.());
  await page.waitForTimeout(400);
}

function issue(profile, screen, msg, severity = "warn") {
  return { profile, screen, msg, severity };
}

async function auditProfile(browser, profile) {
  const found = [];
  const context = await browser.newContext({ ...profile.device });
  const page = await context.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));

  const vh = profile.device.viewport?.height ?? 900;

  // ── Class overlay: summary step (mobile dock) ──
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof selectPlayerClass === "function");
  await page.evaluate(() => {
    selectPlayerClass("warrior");
    selectPlayerClass("warrior");
    window.applyUiLayout?.();
    window.syncClassOverlayAnchors?.();
  });
  await page.waitForTimeout(400);
  const classDock = await page.evaluate(() => {
    function rect(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
    }
    function touchOk(el, min = 44) {
      if (!el) return { ok: false, reason: "missing" };
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return { ok: true, skip: true };
      const r = el.getBoundingClientRect();
      return { ok: r.width >= min - 2 && r.height >= min - 2, w: r.width, h: r.height };
    }
    const dock = document.getElementById("class-mobile-dock");
    const step = document.querySelector("#class-step-summary:not(.hidden)");
    const dr = rect(dock);
    const sr = rect(step);
    return {
      prepLayout: document.documentElement.dataset.prepLayout,
      dockVisible: dock && !dock.classList.contains("hidden"),
      dockTop: dr?.top ?? 0,
      stepBottom: sr?.bottom ?? 0,
      vh: window.innerHeight,
      startBtn: touchOk(document.getElementById("btn-start-run")),
    };
  });
  if (classDock.dockVisible && classDock.stepBottom > classDock.dockTop + 8) {
    found.push(
      issue(profile.id, "class-summary", `step overlaps dock: ${classDock.stepBottom} > ${classDock.dockTop}`, "fail"),
    );
  }
  if (classDock.dockVisible && !classDock.startBtn.ok && !classDock.startBtn.skip) {
    found.push(
      issue(
        profile.id,
        "class-summary",
        `start btn too small: ${classDock.startBtn.w}x${classDock.startBtn.h}`,
        "fail",
      ),
    );
  }

  // ── Prep ──
  await prepStart(page);
  const prep = await page.evaluate(() => {
    function rect(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, w: r.width, h: r.height };
    }
    function touchOk(el, min = 44) {
      if (!el) return { ok: false };
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return { ok: true, skip: true };
      const r = el.getBoundingClientRect();
      return { ok: r.width >= min - 2 && r.height >= min - 2, w: r.width, h: r.height };
    }
    const html = document.documentElement;
    const app = document.getElementById("app");
    const canvas = rect(document.getElementById("game-canvas"));
    const island = rect(document.getElementById("prep-field-island"));
    const hero = rect(document.querySelector(".prep-character-layer"));
    const bar = rect(document.getElementById("bottom-chrome"));
    const fight = rect(document.getElementById("btn-fight"));
    const shopFab = rect(document.getElementById("btn-mobile-shop"));
    const zoneUsed = parseFloat(getComputedStyle(html).getPropertyValue("--zone-used-h")) || 0;
    const appH = parseFloat(getComputedStyle(html).getPropertyValue("--app-h")) || window.innerHeight;
    return {
      phase: app?.dataset.phase,
      prepLayout: html.dataset.prepLayout,
      uiSurface: html.dataset.uiSurface,
      canvasH: canvas?.h ?? 0,
      islandBottom: island?.bottom ?? 0,
      heroTop: hero?.top ?? 0,
      barTop: bar?.top ?? 0,
      fightTouch: touchOk(document.getElementById("btn-fight")),
      shopFabTouch: touchOk(document.getElementById("btn-mobile-shop")),
      zoneUsed,
      appH,
      vh: window.innerHeight,
      overflow: zoneUsed > appH + 4,
    };
  });
  if (prep.canvasH < 80) found.push(issue(profile.id, "prep", `canvas too small: ${prep.canvasH}px`, "fail"));
  if (prep.overflow)
    found.push(issue(profile.id, "prep", `zone overflow: used=${prep.zoneUsed} appH=${prep.appH}`, "fail"));
  if (prep.barTop > prep.vh + 2) found.push(issue(profile.id, "prep", "toolbar below viewport", "fail"));
  if (!prep.fightTouch.ok && !prep.fightTouch.skip) {
    found.push(issue(profile.id, "prep", `fight btn touch: ${prep.fightTouch.w}x${prep.fightTouch.h}`, "warn"));
  }
  if (prep.prepLayout === "mobile" && prep.shopFabTouch.skip === undefined && !prep.shopFabTouch.ok) {
    found.push(issue(profile.id, "prep", `shop FAB touch: ${prep.shopFabTouch.w}x${prep.shopFabTouch.h}`, "fail"));
  }
  if (prep.prepLayout === "mobile" && prep.heroTop > 0 && prep.islandBottom > prep.heroTop + 4) {
    found.push(
      issue(profile.id, "prep", `hero overlaps canvas: island=${prep.islandBottom} hero=${prep.heroTop}`, "warn"),
    );
  }

  // ── Shop open (mobile only) ──
  if (prep.prepLayout === "mobile") {
    await page.evaluate(() => window.toggleMobilePrepShop?.());
    await page.waitForTimeout(400);
    await page.evaluate(() => window.syncMobileOverlayAnchors?.({ phase: "prep" }));
    const shop = await page.evaluate(() => {
      function rect(el) {
        if (!el) return null;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, w: r.width, h: r.height };
      }
      const panel = rect(document.getElementById("shop-panel"));
      const bar = rect(document.getElementById("bottom-chrome"));
      return {
        open: document.documentElement.hasAttribute("data-prep-shop-open"),
        shopBottom: panel?.bottom ?? 0,
        barTop: bar?.top ?? 0,
        shopH: panel?.h ?? 0,
        maxH: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--prep-shop-sheet-max-h")) || 0,
      };
    });
    if (shop.open && shop.shopBottom > shop.barTop + 8) {
      found.push(issue(profile.id, "prep-shop", `shop overlaps toolbar: ${shop.shopBottom} > ${shop.barTop}`, "fail"));
    }
    if (shop.open && shop.shopH > shop.maxH + 4) {
      found.push(issue(profile.id, "prep-shop", `shop taller than max-h: ${shop.shopH} > ${shop.maxH}`, "fail"));
    }
    await page.evaluate(() => window.closeMobilePrepShop?.());
    await page.waitForTimeout(200);
  }

  // ── Battle ──
  await battleStart(page);
  const battle = await page.evaluate(() => {
    function rect(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, w: r.width, h: r.height };
    }
    function touchOk(el, min = 44) {
      if (!el) return { ok: false, skip: true };
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return { ok: true, skip: true };
      const r = el.getBoundingClientRect();
      return { ok: r.width >= min - 2 && r.height >= min - 2, w: r.width, h: r.height };
    }
    const html = document.documentElement;
    const stage = rect(document.querySelector(".avatar-hero-stage"));
    const hud = rect(document.querySelector(".battle-hud-html"));
    const hp = rect(document.querySelector(".battle-hud-html .hp-bar, .battle-hud-html .battle-hp-bar"));
    const floor = rect(document.querySelector(".battle-thought-arena"));
    const floorH = floor?.h ?? (parseFloat(getComputedStyle(html).getPropertyValue("--battle-combat-floor-h")) || 0);
    const bar = rect(document.getElementById("bottom-chrome"));
    const buildFab = rect(document.getElementById("battle-build-stats"));
    return {
      phase: document.getElementById("app")?.dataset.phase,
      battleProfile: html.dataset.battleProfile,
      htmlHud: html.dataset.battleHtmlHud,
      stageBottom: stage?.bottom ?? 0,
      hudTop: hud?.top ?? 0,
      hpTop: hp?.top ?? 0,
      floorH,
      barTop: bar?.top ?? 0,
      buildFabTouch: touchOk(document.getElementById("battle-build-stats")),
      vh: window.innerHeight,
    };
  });
  if (battle.floorH < 60) found.push(issue(profile.id, "battle", `combat floor too small: ${battle.floorH}px`, "fail"));
  if (battle.barTop > battle.vh + 2) found.push(issue(profile.id, "battle", "battle toolbar off-screen", "fail"));
  if (battle.htmlHud === "true" && battle.hudTop > 0 && battle.hudTop < battle.stageBottom - 12) {
    found.push(
      issue(profile.id, "battle", `HUD overlaps portrait: hud=${battle.hudTop} stage=${battle.stageBottom}`, "fail"),
    );
  }
  if (battle.htmlHud === "true" && battle.hpTop > 0 && battle.hpTop < battle.stageBottom - 8) {
    found.push(
      issue(profile.id, "battle", `HP bar overlaps portrait: hp=${battle.hpTop} stage=${battle.stageBottom}`, "fail"),
    );
  }
  if (battle.buildFabTouch.skip === undefined && battle.buildFabTouch.ok === false) {
    found.push(
      issue(profile.id, "battle", `build-stats FAB touch: ${battle.buildFabTouch.w}x${battle.buildFabTouch.h}`, "warn"),
    );
  }

  // ── Inventory popover + tooltip (touch profiles) ──
  if (profile.device.hasTouch) {
    await page
      .waitForFunction(
        () =>
          !document.getElementById("battle-countdown-overlay")?.classList.contains("battle-countdown-overlay-visible"),
        { timeout: 12000 },
      )
      .catch(() => {});
    await page.evaluate(() => {
      window.openBattleInventoryPopover?.("player");
    });
    await page.waitForTimeout(400);

    const pop = await page.evaluate(() => {
      const el = document.getElementById("battle-inventory-popover-player");
      const popRect = (() => {
        if (!el || el.classList.contains("hidden")) return null;
        const r = el.getBoundingClientRect();
        return { bottom: r.bottom };
      })();
      const bar = document.getElementById("bottom-chrome")?.getBoundingClientRect();
      return {
        popOpen: !!popRect,
        popBottom: popRect?.bottom ?? 0,
        barTop: bar?.top ?? 0,
      };
    });
    if (pop.popOpen && pop.popBottom > pop.barTop + 8) {
      found.push(
        issue(profile.id, "battle-inventory", `popover overlaps toolbar: ${pop.popBottom} > ${pop.barTop}`, "fail"),
      );
    }

    const tipState = await page.evaluate(() => {
      const cell = document.querySelector("#battle-inventory-popover-player .bp-cell.bp-has-item[data-item-id]");
      if (!cell || typeof showSidebarTooltipAt !== "function") return { skip: true };
      const r = cell.getBoundingClientRect();
      showSidebarTooltipAt(r.left + r.width / 2, r.top + r.height / 2, cell.dataset.itemId, null, "inventory", cell, {
        pinned: true,
      });
      const tip = document.getElementById("sidebar-tooltip");
      return {
        visible: !!(tip && !tip.classList.contains("hidden")),
        source: typeof sidebarTooltipSource !== "undefined" ? sidebarTooltipSource : null,
      };
    });
    if (!tipState.skip && !tipState.visible) {
      found.push(issue(profile.id, "battle-inventory", "inventory tooltip not visible", "fail"));
    } else if (!tipState.skip && tipState.source !== "inventory") {
      found.push(issue(profile.id, "battle-inventory", `tooltip wrong source: ${tipState.source}`, "warn"));
    }
    await page.evaluate(() => window.toggleBattleInventoryPopover?.());
  }

  if (jsErrors.length) {
    found.push(issue(profile.id, "js", jsErrors.join("; "), "fail"));
  }

  await context.close();
  return found;
}

const browser = await chromium.launch();
const all = [];
for (const profile of PROFILES) {
  const items = await auditProfile(browser, profile);
  all.push(...items);
}
await browser.close();

const fails = all.filter((i) => i.severity === "fail");
const warns = all.filter((i) => i.severity === "warn");

console.log(`\nQA audit: ${fails.length} fail(s), ${warns.length} warn(s)\n`);
for (const i of fails) console.log(`✗ [${i.profile}] ${i.screen}: ${i.msg}`);
for (const i of warns) console.log(`⚠ [${i.profile}] ${i.screen}: ${i.msg}`);
if (!fails.length && !warns.length) console.log("✓ All checks passed");

process.exit(fails.length ? 1 : 0);
