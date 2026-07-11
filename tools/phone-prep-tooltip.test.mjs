/**
 * Phone bb-stack: подсказки остаются внутри поля, не уезжают под магазин.
 * Запуск: node tools/phone-prep-tooltip.test.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import { quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 14 Pro Max"] });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");
  await quickStartPrep(page, { settleMs: 1000 });
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.refreshPrepFieldHeroPortrait?.();
  });
  await page.waitForTimeout(400);

  const m = await page.evaluate(() => {
    const dock = document.getElementById("prep-tooltip-dock");
    const field = document.getElementById("prep-field-column");
    const shop = document.getElementById("shop-panel");
    const commerce = document.querySelector(".bb-prep-commerce-bar");
    if (!dock || !field) return { ok: false, reason: "missing dock/field" };

    dock.classList.remove("hidden");
    dock.classList.add("prep-tooltip-dock--item");
    if (typeof positionPrepTooltipDock === "function") positionPrepTooltipDock();

    const dockR = dock.getBoundingClientRect();
    const fieldR = field.getBoundingClientRect();
    const shopR = shop?.getBoundingClientRect();
    const commerceR = commerce?.getBoundingClientRect();
    const shopBottom = Math.max(shopR?.bottom ?? 0, commerceR?.bottom ?? 0);

    return {
      ok: true,
      dockTop: dockR.top,
      dockBottom: dockR.bottom,
      dockH: dockR.height || parseFloat(dock.style.maxHeight) || 0,
      maxH: parseFloat(dock.style.maxHeight) || 0,
      fieldTop: fieldR.top,
      fieldBottom: fieldR.bottom,
      shopBottom,
      vw: window.innerWidth,
      dockW: dockR.width,
    };
  });

  assert(m.ok, m.reason || "measure failed");
  assert(m.dockTop >= m.shopBottom - 4, `tooltip overlaps shop: dockTop=${m.dockTop} shopBottom=${m.shopBottom}`);
  assert(m.dockTop >= m.fieldTop - 8, `tooltip above field: dockTop=${m.dockTop} fieldTop=${m.fieldTop}`);
  assert(m.dockTop + m.maxH <= m.fieldBottom + 12, `tooltip spills below field: top+maxH=${m.dockTop + m.maxH} fieldBottom=${m.fieldBottom}`);
  assert(m.dockW >= m.vw * 0.55, `tooltip too narrow: ${m.dockW}/${m.vw}`);
  assert(m.maxH >= 200, `tooltip max-height too small: ${m.maxH}`);

  const z = await page.evaluate(() => {
    const dock = document.getElementById("prep-tooltip-dock");
    return parseInt(getComputedStyle(dock).zIndex, 10) || 0;
  });
  assert(z >= 9700, `tooltip z-index too low: ${z}`);

  console.log("✓ phone-prep-tooltip", {
    dockTop: Math.round(m.dockTop),
    maxH: Math.round(m.maxH),
    fieldTop: Math.round(m.fieldTop),
    shopBottom: Math.round(m.shopBottom),
  });
} finally {
  await context.close();
  await browser.close();
}
