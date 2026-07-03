/**
 * Real pointer drag path for TD shop → tower backpack (Playwright mouse).
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3458);

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.join(ROOT, rel);
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": contentType(filePath) });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  return server;
}

async function readState(page) {
  return page.evaluate(() => {
    const tower = tdGetTowerAtSlot(tdState, selectedTdSlotId);
    return {
      gold,
      items: (tower?.items || []).map((i) => i.itemId),
      shop: getSideState("player").shop,
      drag: !!dragPayload,
      pending: !!pendingShopDrag,
    };
  });
}

async function mouseDragShopToCell(page, shopIndex, col, row) {
  const boxes = await page.evaluate(({ shopIndex, col, row }) => {
    const card = document.querySelector(`.td-build-shop-card[data-shop-index="${shopIndex}"]`);
    if (!card) return null;
    const cardBox = card.getBoundingClientRect();
    const cell = boardCellClientCenter(col, row);
    return {
      card: { x: cardBox.left + cardBox.width / 2, y: cardBox.top + cardBox.height / 2 },
      cell,
      itemId: card.getAttribute("data-item-id"),
    };
  }, { shopIndex, col, row });
  if (!boxes) return { ok: false, reason: "no_card" };

  const before = await readState(page);
  await page.mouse.move(boxes.card.x, boxes.card.y);
  await page.mouse.down();
  await page.mouse.move(boxes.cell.x, boxes.cell.y, { steps: 16 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(350);

  const after = await readState(page);
  return {
    ok: after.items.length > before.items.length || after.gold < before.gold,
    itemId: boxes.itemId,
    before,
    after,
  };
}

async function run() {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function");
    await page.evaluate(() => {
      selectGameMode("td");
      selectTdDifficulty("normal");
      selectPlayerClass("mage");
      const c = document.querySelector("[data-companion]");
      if (c) { c.click(); c.click(); }
      startRunFromOverlay();
    });
    await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "battle", null, { timeout: 30000 });
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      selectTdSlot(0);
      openTdLoadoutSheet();
    });
    await page.waitForTimeout(400);

    const attempts = [];
    for (let i = 0; i < 5; i += 1) {
      const slot = await page.evaluate(() => {
        const tower = tdGetTowerAtSlot(tdState, selectedTdSlotId);
        const st = getSideState("player");
        for (let si = 0; si < st.shop.length; si += 1) {
          const entryId = st.shop[si];
          if (!entryId) continue;
          if (typeof isGemItem === "function" && isGemItem(entryId)) continue;
          const def = ITEM_CATALOG[entryId];
          if (!def || def.isContainer) continue;
          for (let row = 0; row < TD_TOWER_ROWS; row += 1) {
            for (let col = 0; col < TD_TOWER_COLS; col += 1) {
              if (!isSlotCell(tower.containers, col, row)) continue;
              if (findItemAtSlot(tower.items, col, row)) continue;
              if (canPlaceInLoadout(entryId, col, row, 0, tower.containers, tower.items)) {
                return { shopIndex: si, col, row, itemId: entryId };
              }
            }
          }
        }
        return null;
      });
      if (!slot) break;
      const result = await mouseDragShopToCell(page, slot.shopIndex, slot.col, slot.row);
      attempts.push({ ...slot, ...result });
      if (!result.ok) break;
    }

    const report = { attempts, final: await readState(page), pass: attempts.filter((a) => a.ok).length >= 2 };
    console.log(JSON.stringify(report, null, 2));
    await page.screenshot({ path: path.join(ROOT, "tools/debug-td-loadout-shop-mouse.png"), fullPage: true });
    if (!report.pass) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
