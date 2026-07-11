/**
 * Phone portrait bb-stack prep: поле/сетка крупнее (overlay-герой, без tip-колонки).
 * Доли зон % от aspect — на высоком экране поле не раздувается выше доски.
 * Запуск: node tools/phone-prep-field.test.mjs
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

async function measurePrep(page) {
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.refreshPrepFieldHeroPortrait?.();
    window.scheduleCanvasFit?.();
  });
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    const html = document.documentElement;
    const ds = html.dataset;
    const field = document.getElementById("prep-field-column")?.getBoundingClientRect();
    const grid = document.querySelector(".bb-prep-inventory-grid")?.getBoundingClientRect();
    const island = document.getElementById("prep-field-island")?.getBoundingClientRect();
    const tip = document.getElementById("bb-prep-inventory-tip");
    const tipCs = tip ? getComputedStyle(tip) : null;
    const cs = getComputedStyle(html);
    const bust = document.querySelector(".bb-prep-inventory-hero .prep-field-bust");
    const fullBodyFrame = document.querySelector(".bb-prep-inventory-hero .hero-portrait-frame:not(.prep-field-bust)");
    const heroBox = document.querySelector(".bb-prep-inventory-hero")?.getBoundingClientRect();
    const img = document.querySelector(".bb-prep-inventory-hero .prep-character-img, .bb-prep-inventory-hero .hero-portrait-media");
    return {
      prepLayout: ds.prepLayout,
      layoutProfile: ds.layoutProfile,
      phoneOverlay: ds.bbPrepPhoneOverlay === "true",
      fieldH: field?.height ?? 0,
      fieldW: field?.width ?? 0,
      gridW: grid?.width ?? 0,
      islandW: island?.width ?? 0,
      islandH: island?.height ?? 0,
      vh: window.innerHeight,
      vw: window.innerWidth,
      cell: parseFloat(cs.getPropertyValue("--cell-size")) || 0,
      fieldShare: parseFloat(html.style.getPropertyValue("--prep-zone-field-share"))
        || parseFloat(cs.getPropertyValue("--prep-zone-field-share"))
        || 0,
      shopShare: parseFloat(html.style.getPropertyValue("--prep-zone-shop-share"))
        || parseFloat(cs.getPropertyValue("--prep-zone-shop-share"))
        || 0,
      tipDisplay: tipCs?.display ?? "missing",
      tipColShare: cs.getPropertyValue("--bb-prep-tooltip-col-share").trim(),
      fillH: field && island && field.height > 0 ? island.height / field.height : 0,
      hasBust: !!bust,
      hasFullBodyFrame: !!fullBodyFrame,
      heroW: heroBox?.width ?? 0,
      heroH: heroBox?.height ?? 0,
      imgSrc: img?.getAttribute("src") || "",
    };
  });
}

function assertPhonePrep(m, label) {
  assert(m.prepLayout === "bb-stack", `${label}: expected bb-stack, got ${m.prepLayout}`);
  assert(m.phoneOverlay, `${label}: expected data-bb-prep-phone-overlay`);
  assert(m.fieldShare >= 0.40 && m.fieldShare <= 0.56, `${label}: field share out of range: ${m.fieldShare}`);
  assert(m.shopShare >= 0.15, `${label}: shop share too small: ${m.shopShare}`);
  assert(m.fieldH >= m.vh * 0.38, `${label}: field height too small: ${Math.round(m.fieldH)}/${m.vh}`);
  assert(m.gridW >= m.vw * 0.78, `${label}: grid too narrow: ${Math.round(m.gridW)}/${m.vw}`);
  assert(m.islandW >= m.vw * 0.55, `${label}: island/canvas too narrow: ${Math.round(m.islandW)}/${m.vw}`);
  assert(m.fillH >= 0.72, `${label}: board fill of field too low: ${m.fillH.toFixed(2)}`);
  assert(m.cell >= 36, `${label}: cell-size too small: ${m.cell}`);
  assert(m.tipDisplay === "none", `${label}: tip col should be hidden, got ${m.tipDisplay}`);
  assert(m.hasBust, `${label}: expected prep-field-bust portrait`);
  assert(!m.hasFullBodyFrame, `${label}: full-body frame should not render on phone field`);
  assert(m.heroW <= 110 && m.heroH <= 110, `${label}: bust overlay too large: ${Math.round(m.heroW)}×${Math.round(m.heroH)}`);
  assert(/sticker_|icon|\.png/i.test(m.imgSrc), `${label}: expected sticker/portrait src, got ${m.imgSrc}`);
}

const browser = await chromium.launch();

try {
  {
    const context = await browser.newContext({ ...devices["iPhone 14 Pro Max"] });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function");
    await quickStartPrep(page, { settleMs: 1000 });
    const m = await measurePrep(page);
    assertPhonePrep(m, "iPhone");
    console.log("✓ phone-prep-field iPhone", {
      fieldShare: m.fieldShare,
      fillH: Math.round(m.fillH * 100),
      cell: m.cell,
      vh: m.vh,
    });
    await context.close();
  }

  {
    // Xiaomi Mi 12x CSS viewport
    const context = await browser.newContext({
      viewport: { width: 393, height: 851 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 13; 2112123AG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function");
    await quickStartPrep(page, { settleMs: 1000 });
    const m = await measurePrep(page);
    assertPhonePrep(m, "Mi12x");
    console.log("✓ phone-prep-field Mi12x", {
      fieldShare: m.fieldShare,
      fillH: Math.round(m.fillH * 100),
      cell: m.cell,
      vh: m.vh,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
