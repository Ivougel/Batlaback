/**
 * E2E: призрак и тень prep-drag под иконкой (BB stack).
 * npm run test:prep-drag-alignment
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

async function runAlignmentProbe(page, probePoints) {
  return page.evaluate(async (points) => {
    ensureShopReady();
    renderShop();
    const card = document.querySelector("#shop-slots .shop-card:not(.empty)");
    const canvas = document.getElementById("game-canvas");
    if (!card || !canvas) return { error: "missing shop card or canvas" };

    const start = card.getBoundingClientRect();
    card.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: start.left + start.width * 0.5,
      clientY: start.top + start.height * 0.5,
      buttons: 1,
    }));

    const canvasRect = canvas.getBoundingClientRect();
    const samples = [];

    for (const pt of points) {
      const clientX = canvasRect.left + canvasRect.width * pt.nx;
      const clientY = canvasRect.top + canvasRect.height * pt.ny;

      for (let i = 0; i < 8; i += 1) {
        document.dispatchEvent(new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          buttons: 1,
        }));
        await new Promise((r) => requestAnimationFrame(r));
      }

      if (!dragPayload) {
        samples.push({ pt, error: "drag not active" });
        continue;
      }

      const ghostPos = typeof getPrepDragGhostClientPos === "function"
        ? getPrepDragGhostClientPos(lastPointerClient.x, lastPointerClient.y)
        : null;
      const hover = ghostPos && typeof findPrepBoardHoverCellFromGhostClient === "function"
        ? findPrepBoardHoverCellFromGhostClient(ghostPos.x, ghostPos.y, prepViewSide)
        : null;
      const shadow = typeof getPrepDragShadowPlacement === "function"
        ? getPrepDragShadowPlacement(getLoadoutEditState(prepViewSide), prepViewSide)
        : null;

      let cellCenter = null;
      let dist = Infinity;
      if (hover && ghostPos && typeof boardCellClientCenter === "function") {
        cellCenter = boardCellClientCenter(hover.col, hover.row, prepViewSide);
        dist = Math.hypot(cellCenter.x - ghostPos.x, cellCenter.y - ghostPos.y);
      }

      samples.push({
        pt,
        hover,
        shadow: shadow ? { col: shadow.col, row: shadow.row, valid: shadow.valid } : null,
        dist,
        ghostInsideCanvas: typeof isClientPointInsideCanvas === "function" && ghostPos
          ? isClientPointInsideCanvas(ghostPos.x, ghostPos.y)
          : null,
      });
    }

    document.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      clientX: canvasRect.left + canvasRect.width * 0.5,
      clientY: canvasRect.top + canvasRect.height * 0.5,
      buttons: 0,
    }));

    return {
      cellSize: typeof uiPx === "function" ? uiPx(106) : 106,
      ghostOffset: typeof getPrepDragGhostOffsetY === "function" ? getPrepDragGhostOffsetY() : null,
      samples,
    };
  }, probePoints);
}

function assertSamples(label, result) {
  if (result.error) throw new Error(result.error);
  assert(result.samples?.length, `${label}: no samples`);
  const maxDist = result.cellSize * 0.85;
  for (const sample of result.samples) {
    if (sample.error) throw new Error(`${label} @ ${JSON.stringify(sample.pt)}: ${sample.error}`);
    if (sample.pt.expectShadow === false) {
      assert(!sample.shadow, `${label} @ ${JSON.stringify(sample.pt)}: shadow should be hidden`);
      continue;
    }
    assert(sample.hover, `${label} @ ${JSON.stringify(sample.pt)}: no hover under ghost`);
    assert(sample.shadow, `${label} @ ${JSON.stringify(sample.pt)}: no shadow`);
    assert(Number.isFinite(sample.dist), `${label} @ ${JSON.stringify(sample.pt)}: no distance`);
    assert(sample.dist <= maxDist,
      `${label} @ ${JSON.stringify(sample.pt)}: misaligned by ${Math.round(sample.dist)}px`);
  }
  return result;
}

const profiles = [
  {
    label: "ipad-mini",
    context: {
      ...devices["iPad Mini"],
      viewport: { width: 1024, height: 768 },
    },
    points: [
      { nx: 0.62, ny: 0.42 },
      { nx: 0.85, ny: 0.18 },
      { nx: 0.15, ny: 0.22 },
    ],
  },
  {
    label: "desktop-chrome",
    context: {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    },
    points: [
      { nx: 0.72, ny: 0.12 },
      { nx: 0.88, ny: 0.08 },
      { nx: 0.55, ny: 0.15 },
      { nx: 0.25, ny: 0.35 },
    ],
  },
];

const browser = await chromium.launch();

for (const profile of profiles) {
  const context = await browser.newContext(profile.context);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");
  await quickStartPrep(page, { playerClass: "priest" });

  const result = await runAlignmentProbe(page, profile.points);
  assertSamples(profile.label, result);

  console.log(`prep-drag-alignment.test.mjs: OK ${profile.label}`, {
    ghostOffset: result.ghostOffset,
    samples: result.samples.map((s) => ({
      pt: s.pt,
      hover: s.hover,
      dist: Math.round(s.dist),
    })),
  });

  await context.close();
}

await browser.close();
