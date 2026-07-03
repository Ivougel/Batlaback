/** Measure TD loadout grid display size. */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3459;

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent((req.url || "/").split("?")[0]) || "/";
      const file = path.join(ROOT, rel === "/" ? "/index.html" : rel);
      const data = await readFile(file);
      res.writeHead(200);
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  return server;
}

async function run() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function");
    await page.evaluate(() => {
      selectGameMode("td");
      selectTdDifficulty("normal");
      selectPlayerClass("mage");
      const c = document.querySelector("[data-companion]");
      if (c) { c.click(); c.click(); }
      startRunFromOverlay();
    });
    await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle");
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      selectTdSlot(0);
      openTdLoadoutSheet();
      syncTdLoadoutLayout();
    });
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
      const canvas = document.getElementById("game-canvas");
      const body = document.getElementById("td-loadout-sheet-body");
      const island = document.getElementById("prep-field-island");
      const cr = canvas?.getBoundingClientRect();
      const br = body?.getBoundingClientRect();
      const ir = island?.getBoundingClientRect();
      const cell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell-size")) || 0;
      return {
        cellSize: cell,
        canvasBitmap: { w: canvas?.width, h: canvas?.height },
        canvasDisplay: cr ? { w: cr.width, h: cr.height } : null,
        body: br ? { w: br.width, h: br.height } : null,
        island: ir ? { w: ir.width, h: ir.height } : null,
        cssDisplay: {
          w: getComputedStyle(document.documentElement).getPropertyValue("--battle-canvas-display-w"),
          h: getComputedStyle(document.documentElement).getPropertyValue("--battle-canvas-display-h"),
        },
      };
    });
    console.log(JSON.stringify(metrics, null, 2));
    const cellOk = metrics.cellSize >= 56;
    const displayOk = metrics.canvasDisplay && metrics.canvasDisplay.w >= 320;
    if (!cellOk || !displayOk) process.exitCode = 1;
    await page.screenshot({ path: path.join(ROOT, "tools/debug-td-loadout-scale.png") });
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
