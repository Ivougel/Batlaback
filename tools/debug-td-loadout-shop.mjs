/**
 * Debug: TD tower backpack — buy + place multiple shop items via drag arc.
 * Usage: node tools/debug-td-loadout-shop.mjs
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3457);

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.join(ROOT, rel);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
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

async function dragShopToBackpack(page, shopIndex, cellCol, cellRow) {
  const result = await page.evaluate(async ({ shopIndex, cellCol, cellRow }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const getTower = () => {
      if (!tdState || selectedTdSlotId == null) return null;
      return tdGetTowerAtSlot(tdState, selectedTdSlotId);
    };

    const placedCount = () => {
      const tower = getTower();
      return tower?.items?.length || 0;
    };
    const goldBefore = gold;
    const itemsBefore = placedCount();
    const shopBefore = [...(getSideState("player").shop || [])];

    if (!isTdLoadoutEditPhase()) {
      return { ok: false, step: "not_td_edit", goldBefore, itemsBefore };
    }
    if (!tdLoadoutSheetOpen) openTdLoadoutSheet();
    await sleep(120);

    const card = document.querySelector(`.td-build-shop-card[data-shop-index="${shopIndex}"]`);
    if (!card || card.classList.contains("td-build-shop-card--locked") || card.classList.contains("td-build-shop-card--empty")) {
      return {
        ok: false,
        step: "no_shop_card",
        shopIndex,
        shopBefore,
        goldBefore,
      };
    }

    const cardBox = card.getBoundingClientRect();
    const drop = boardCellClientCenter(cellCol, cellRow);
    if (!drop) return { ok: false, step: "no_drop_center", cellCol, cellRow };

    const down = {
      clientX: cardBox.left + cardBox.width / 2,
      clientY: cardBox.top + cardBox.height / 2,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      preventDefault() {},
      stopPropagation() {},
    };
    const move = {
      clientX: drop.x,
      clientY: drop.y,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      preventDefault() {},
      stopPropagation() {},
    };
    const up = { ...move };

    beginPendingShopDrag(shopIndex, down, "player");
    updatePendingShopDrag(move);
    await sleep(80);

    const mid = {
      dragActive: !!dragPayload,
      dropState: typeof getPrepArcDropState === "function" ? getPrepArcDropState() : null,
      hoverSlot,
      placement: typeof getPrepDropPlacement === "function"
        ? getPrepDropPlacement(getLoadoutEditState("player"), "player")
        : null,
    };

    finishDragDrop(up);
    await sleep(200);

    const towerAfter = getTower();
    const itemsAfter = placedCount();
    const socketedGems = (towerAfter?.items || []).reduce((n, item) => {
      const gems = item.socketedGems?.filter(Boolean) || [];
      return n + gems.length;
    }, 0);
    const goldAfter = gold;
    const shopAfter = [...(getSideState("player").shop || [])];

    return {
      ok: itemsAfter > itemsBefore || (goldBefore - goldAfter > 0 && socketedGems > 0),
      step: itemsAfter > itemsBefore ? "placed" : (goldBefore > goldAfter ? "purchased_or_socketed" : "drop_failed"),
      goldBefore,
      goldAfter,
      goldSpent: goldBefore - goldAfter,
      itemsBefore,
      itemsAfter,
      shopSlotCleared: shopBefore[shopIndex] && !shopAfter[shopIndex],
      mid,
      towerItems: (towerAfter?.items || []).map((i) => ({ id: i.itemId, col: i.col, row: i.row })),
    };
  }, { shopIndex, cellCol, cellRow });

  return result;
}

async function run() {
  const server = await startStaticServer();
  const url = `http://127.0.0.1:${PORT}/index.html`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  const logs = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") logs.push(`[console.error] ${msg.text()}`);
  });
  page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 20000 });

    await page.evaluate(() => {
      selectGameMode("td");
      selectTdDifficulty("normal");
      selectPlayerClass("mage");
      const c = document.querySelector("[data-companion]");
      if (c) { c.click(); c.click(); }
      startRunFromOverlay();
    });

    await page.waitForFunction(
      () => document.getElementById("app")?.dataset.phase === "battle",
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(1200);

    // Commander already at slot 0 — select tower for loadout edit
    await page.evaluate(() => {
      selectTdSlot(0);
    });
    await page.waitForTimeout(500);

    const setup = await page.evaluate(() => {
      const tower = tdGetTowerAtSlot(tdState, selectedTdSlotId);
      const st = getSideState("player");
      return {
        gold,
        shop: st.shop,
        towerItems: tower?.items?.length || 0,
        slotCells: tower ? buildSlotSet(tower.containers).size : 0,
        loadoutOpen: tdLoadoutSheetOpen,
        canEdit: isTdLoadoutEditPhase(),
      };
    });

    const attempts = [];
    const targets = [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
    ];

    for (let shopIndex = 0; shopIndex < 5; shopIndex += 1) {
      const cardInfo = await page.evaluate((idx) => {
        const card = document.querySelector(`.td-build-shop-card[data-shop-index="${idx}"]`);
        if (!card || card.classList.contains("td-build-shop-card--empty") || card.classList.contains("td-build-shop-card--locked")) {
          return null;
        }
        const itemId = card.getAttribute("data-item-id");
        const def = ITEM_CATALOG[itemId];
        const isGem = typeof isGemItem === "function" ? isGemItem(itemId) : def?.tags?.includes("gem");
        return { itemId, isGem };
      }, shopIndex);
      if (!cardInfo) {
        attempts.push({ shopIndex, skipped: true, reason: "empty_or_locked" });
        continue;
      }
      if (cardInfo.isGem) {
        attempts.push({ shopIndex, skipped: true, reason: "gem_skip", itemId: cardInfo.itemId });
        continue;
      }

      const emptyCell = await page.evaluate(() => {
        const tower = tdGetTowerAtSlot(tdState, selectedTdSlotId);
        if (!tower) return null;
        const cols = typeof TD_TOWER_COLS === "number" ? TD_TOWER_COLS : 6;
        const rows = typeof TD_TOWER_ROWS === "number" ? TD_TOWER_ROWS : 6;
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            if (!isSlotCell(tower.containers, col, row)) continue;
            if (findItemAtSlot(tower.items, col, row)) continue;
            if (canPlaceInLoadout("apple", col, row, 0, tower.containers, tower.items)) {
              return [col, row];
            }
          }
        }
        return null;
      });
      if (!emptyCell) {
        attempts.push({ shopIndex, skipped: true, reason: "no_empty_cell" });
        break;
      }

      const result = await dragShopToBackpack(page, shopIndex, emptyCell[0], emptyCell[1]);
      attempts.push({ shopIndex, target: emptyCell, ...result });
      if (!result.ok) break;
      await page.waitForTimeout(250);
    }

    const final = await page.evaluate(() => {
      const tower = tdGetTowerAtSlot(tdState, selectedTdSlotId);
      return {
        gold,
        shop: getSideState("player").shop,
        items: (tower?.items || []).map((i) => i.itemId),
        containers: (tower?.containers || []).length,
      };
    });

    await page.screenshot({ path: path.join(ROOT, "tools/debug-td-loadout-shop.png"), fullPage: true });

    const placed = attempts.filter((a) => a.ok).length;
    const report = {
      setup,
      attempts,
      final,
      placed,
      logs,
      pass: placed >= 2,
    };

    console.log(JSON.stringify(report, null, 2));
    if (!report.pass) process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
