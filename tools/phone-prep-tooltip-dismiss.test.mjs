/**
 * Phone: tap вне карточки подсказки закрывает sidebar-tooltip.
 * Запуск: node tools/phone-prep-tooltip-dismiss.test.mjs
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

async function touchTap(page, x, y) {
  await page.touchscreen.tap(x, y);
}

async function openFirstShopTooltip(page) {
  const cardBox = await page.locator(".shop-card:not(.empty)").first().boundingBox();
  assert(cardBox, "no shop card");
  await touchTap(page, cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.waitForTimeout(80);
  const prepLayout = await page.evaluate(() => document.documentElement.dataset.prepLayout);
  const visible = await isTipVisible(page);
  return { ok: true, visible, prepLayout };
}

function isTipVisible(page) {
  return page.evaluate(() => {
    const tip = document.getElementById("sidebar-tooltip");
    return !!(tip && !tip.classList.contains("hidden"));
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 14 Pro Max"] });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");
  await quickStartPrep(page, { settleMs: 1000 });

  const opened = await openFirstShopTooltip(page);
  assert(opened.ok, opened.reason || "open failed");
  assert(opened.visible, "shop tap should open tooltip");
  assert(opened.prepLayout === "bb-stack", `expected bb-stack, got ${opened.prepLayout}`);

  const topBarPoint = await page.evaluate(() => {
    const el = document.getElementById("prep-top-bar");
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await touchTap(page, topBarPoint.x, topBarPoint.y);
  await page.waitForTimeout(80);
  assert(!(await isTipVisible(page)), "top bar tap should dismiss tooltip");

  const reopened = await openFirstShopTooltip(page);
  assert(reopened.visible, "re-open tooltip for canvas dismiss test");

  const canvasPoint = await page.evaluate(() => {
    const canvas = document.getElementById("game-canvas");
    const r = canvas.getBoundingClientRect();
    return { x: r.left + r.width * 0.2, y: r.top + r.height * 0.8 };
  });
  await touchTap(page, canvasPoint.x, canvasPoint.y);
  assert(!(await isTipVisible(page)), "canvas tap should dismiss tooltip");

  console.log("✓ phone-prep-tooltip-dismiss");
} finally {
  await context.close();
  await browser.close();
}
