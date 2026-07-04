/**
 * Стабильность layout во время drag и phase-transition.
 * Запуск: npm run test:drag-stability
 */
import { chromium, devices } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quickStartPrep } from "./lib/quick-start.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["iPad Mini"],
  viewport: { width: 1024, height: 768 },
});
const page = await context.newPage();

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof startRunFromOverlay === "function");
await quickStartPrep(page, { playerClass: "priest" });

const baseline = await page.evaluate(() => {
  const island = document.getElementById("prep-field-island");
  const r = island?.getBoundingClientRect();
  return {
    w: Math.round(r?.width ?? 0),
    h: Math.round(r?.height ?? 0),
    cell: Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell-size")) || 0),
  };
});

assert(baseline.w > 80 && baseline.h > 80, `bad baseline island: ${JSON.stringify(baseline)}`);

const dragMetrics = await page.evaluate(async () => {
  ensureShopReady();
  renderShop();
  const card = document.querySelector("#shop-slots .shop-card:not(.empty)");
  const island = document.getElementById("prep-field-island");
  if (!card || !island) return { error: "missing card or island" };
  const rect = card.getBoundingClientRect();
  const sx = rect.left + rect.width * 0.5;
  const sy = rect.top + rect.height * 0.5;
  const samples = [];
  const sample = () => {
    const r = island.getBoundingClientRect();
    samples.push({
      w: Math.round(r.width),
      h: Math.round(r.height),
      dragging: document.body.classList.contains("is-ui-dragging"),
      cell: Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell-size")) || 0),
    });
  };
  sample();
  card.dispatchEvent(new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    clientX: sx,
    clientY: sy,
    buttons: 1,
  }));
  sample();
  for (let i = 1; i <= 8; i += 1) {
    document.dispatchEvent(new MouseEvent("mousemove", {
      bubbles: true,
      cancelable: true,
      clientX: sx + i * 18,
      clientY: sy + i * 12,
      buttons: 1,
    }));
    sample();
    await new Promise((r) => requestAnimationFrame(r));
  }
  document.dispatchEvent(new MouseEvent("mouseup", {
    bubbles: true,
    cancelable: true,
    clientX: sx + 144,
    clientY: sy + 96,
    buttons: 0,
  }));
  sample();
  return { samples, hadDragging: samples.some((s) => s.dragging) };
});

if (dragMetrics.error) throw new Error(dragMetrics.error);
assert(dragMetrics.hadDragging, "drag state never activated");

const draggingSamples = dragMetrics.samples.filter((s) => s.dragging);
assert(draggingSamples.length >= 3, "not enough in-drag samples");

const maxWDelta = Math.max(...draggingSamples.map((s) => Math.abs(s.w - baseline.w)));
const maxHDelta = Math.max(...draggingSamples.map((s) => Math.abs(s.h - baseline.h)));
const maxCellDelta = Math.max(...draggingSamples.map((s) => Math.abs(s.cell - baseline.cell)));

assert(maxWDelta <= 2, `island width jumped during drag: ${maxWDelta}px`);
assert(maxHDelta <= 2, `island height jumped during drag: ${maxHDelta}px`);
assert(maxCellDelta <= 1, `cell-size changed during drag: ${maxCellDelta}px`);

await page.evaluate(() => startBattle());
await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle", { timeout: 10000 });
await page.waitForTimeout(500);

const phaseLock = await page.evaluate(() => ({
  screenTransitioning: document.body.classList.contains("screen-transitioning"),
  phaseTransitioning: document.querySelector(".game-layout")?.classList.contains("phase-transitioning"),
  overlayHidden: document.getElementById("class-overlay")?.classList.contains("hidden"),
}));

assert(phaseLock.overlayHidden, "class-overlay must stay hidden in battle");
assert(!phaseLock.screenTransitioning, "screen-transitioning stuck after battle start");

console.log("✓ layout-drag-stability", JSON.stringify({
  baseline,
  maxWDelta,
  maxHDelta,
  maxCellDelta,
  sampleCount: dragMetrics.samples.length,
}));

await browser.close();
