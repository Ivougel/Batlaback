/**
 * Legion Y700 prep — landscape native 2560×1600 не должен быть узкой bb-stack колонкой.
 * Запуск: node tools/y700-prep-layout.test.mjs
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

const CASES = [
  { id: "y700-native-landscape-prep", viewport: { width: 2560, height: 1600 }, prepLayout: "side", uiSurface: "tablet-side" },
  { id: "y700-scaled-landscape-prep", viewport: { width: 1280, height: 800 }, prepLayout: "side", uiSurface: "tablet-side" },
  { id: "y700-native-portrait-prep", viewport: { width: 1600, height: 2560 }, prepLayout: "stacked", uiSurface: "tablet-stacked" },
];

const browser = await chromium.launch();
const failures = [];

for (const testCase of CASES) {
  const context = await browser.newContext({
    viewport: testCase.viewport,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function");
    await quickStartPrep(page, { settleMs: 1000 });
    await page.evaluate(() => window.applyUiLayout?.());
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
      const html = document.documentElement.dataset;
      const app = document.getElementById("app")?.getBoundingClientRect();
      const layout = document.querySelector(".game-layout")?.getBoundingClientRect();
      const shop = document.getElementById("shop-panel")?.getBoundingClientRect();
      const field = document.getElementById("prep-field-island")?.getBoundingClientRect();
      return {
        prepLayout: html.prepLayout,
        uiSurface: html.uiSurface,
        tier: html.uiTier,
        layoutProfile: html.layoutProfile,
        bbStackFn: typeof shouldUseBBStackPrepLayout === "function" && shouldUseBBStackPrepLayout(),
        appW: app?.width ?? 0,
        layoutW: layout?.width ?? 0,
        shopW: shop?.width ?? 0,
        fieldW: field?.width ?? 0,
        vw: window.innerWidth,
        uiScale: getComputedStyle(document.documentElement).getPropertyValue("--ui-scale").trim(),
      };
    });

    assert(m.prepLayout === testCase.prepLayout, `expected ${testCase.prepLayout} prep, got ${m.prepLayout}`);
    assert(m.uiSurface === testCase.uiSurface, `expected ${testCase.uiSurface}, got ${m.uiSurface}`);
    assert(m.tier === "tablet", `expected tablet tier, got ${m.tier}`);
    assert(!m.bbStackFn, "shouldUseBBStackPrepLayout should be false on tablet");
    if (testCase.prepLayout === "side") {
      assert(m.appW >= m.vw * 0.88, `app too narrow: ${m.appW}/${m.vw}px`);
      assert(m.layoutW >= m.vw * 0.75, `game-layout too narrow: ${m.layoutW}/${m.vw}px`);
      if (m.shopW > 0 && m.fieldW > 0) {
        assert(m.shopW + m.fieldW >= m.vw * 0.55, `shop+field underusing width: ${m.shopW}+${m.fieldW}`);
      }
    } else {
      assert(m.appW >= m.vw * 0.85, `stacked app too narrow: ${m.appW}/${m.vw}px`);
    }

    console.log(`✓ ${testCase.id}`, {
      prepLayout: m.prepLayout,
      uiSurface: m.uiSurface,
      appW: Math.round(m.appW),
      vw: m.vw,
      uiScale: m.uiScale,
    });
  } catch (e) {
    failures.push({ id: testCase.id, error: e.message });
    console.error(`✗ ${testCase.id}: ${e.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} Y700 prep test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${CASES.length} Y700 prep layout tests passed.`);
