/**
 * Desktop prep: side layout на всю ширину, не bb-stack колонка 480px.
 * Запуск: node tools/desktop-prep-layout.test.mjs
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

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  hasTouch: false,
  isMobile: false,
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
    return {
      prepLayout: html.prepLayout,
      uiSurface: html.uiSurface,
      tier: html.uiTier,
      appW: app?.width ?? 0,
      vw: window.innerWidth,
      bbStack: typeof shouldUseBBStackPrepLayout === "function" && shouldUseBBStackPrepLayout(),
    };
  });

  assert(m.prepLayout === "side", `expected side, got ${m.prepLayout}`);
  assert(
    m.uiSurface === "desktop" || m.uiSurface === "tablet-side",
    `expected desktop/tablet-side surface, got ${m.uiSurface}`,
  );
  assert(!m.bbStack, "desktop should not use bb-stack");
  assert(m.appW >= m.vw * 0.9, `app too narrow: ${Math.round(m.appW)}/${m.vw}`);

  console.log("✓ desktop-prep-layout", {
    prepLayout: m.prepLayout,
    uiSurface: m.uiSurface,
    appW: Math.round(m.appW),
    vw: m.vw,
  });
} finally {
  await context.close();
  await browser.close();
}
