/**
 * E2E: бросок из хранилища — предмет на поле или обратно в хранилище, всегда интерактивен.
 * node tools/prep-storage-fling.test.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = process.env.PREP_TEST_URL || `http://127.0.0.1:8765/index.html`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function enterPrep(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function", null, { timeout: 20000 });
  await page.evaluate(async () => {
    selectPlayerClass("warrior");
    selectPlayerClass("warrior");
    await startRunFromOverlay();
  });
  await page.waitForSelector('#app[data-phase="prep"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.applyUiLayout?.();
    window.scheduleCanvasFit?.();
    ensureShopReady?.();
    renderShop?.();
  });
  await page.waitForTimeout(500);
}

async function buyToStorage(page, suffix) {
  return page.evaluate((tag) => {
    const st = getSideState(prepViewSide);
    const idx = st.shop.findIndex((id) => id && ITEM_CATALOG[id]);
    if (idx < 0) return { ok: false, reason: "no shop item" };
    const itemId = commitShopPurchase(idx, prepViewSide);
    if (!itemId) return { ok: false, reason: "purchase failed" };
    const entry = {
      itemId,
      uid: `bench-test-${tag}-${Date.now()}`,
      rotation: 0,
    };
    st.bench.push(entry);
    PrepStoragePhysics.sync(prepViewSide);
    renderBench(prepViewSide);
    return { ok: true, uid: entry.uid, itemId };
  }, suffix);
}

async function waitFliers(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 180; i += 1) {
      PrepStoragePhysics.tick(1 / 30);
      await new Promise((r) => setTimeout(r, 5));
      if (!PrepStoragePhysics.hasActiveScreenFliers?.()) break;
    }
  });
}

async function flingStorageItem(page, uid, targetX, targetY, { arc = 50, steps = 10 } = {}) {
  await page.evaluate(async ({ benchUid, endX, endY, arcHeight, stepCount }) => {
    const body = document.querySelector(`.prep-storage-body[data-uid="${benchUid}"]`);
    if (!body) throw new Error("storage body missing");
    const br = body.getBoundingClientRect();
    const startX = br.left + br.width / 2;
    const startY = br.top + br.height / 2;

    body.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0, pointerId: 1, pointerType: "mouse",
    }));

    for (let i = 1; i <= stepCount; i += 1) {
      const t = i / stepCount;
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t - arcHeight * Math.sin(t * Math.PI);
      window.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, cancelable: true, clientX: x, clientY: y, button: 1, pointerId: 1, pointerType: "mouse",
      }));
      await new Promise((r) => requestAnimationFrame(r));
    }

    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, clientX: endX, clientY: endY, button: 0, pointerId: 1, pointerType: "mouse",
    }));
  }, { benchUid: uid, endX: targetX, endY: targetY, arcHeight: arc, stepCount: steps });

  await waitFliers(page);

  return page.evaluate((benchUid) => {
    const st = getSideState(prepViewSide);
    const el = document.querySelector(`.prep-storage-body[data-uid="${benchUid}"]`);
    const r = el?.getBoundingClientRect();
    const onBench = st.bench.some((e) => e.uid === benchUid);
    const onBoard = st.items.length > 0;
    const hidden = !!el?.hidden;
    const hit = (onBench && r)
      ? PrepStoragePhysics.hitTestBenchIndex(r.left + r.width / 2, r.top + r.height / 2)
      : -1;
    return {
      onBench,
      onBoard,
      hidden,
      hit,
      bench: st.bench.length,
      items: st.items.length,
      fliers: PrepStoragePhysics.hasActiveScreenFliers?.() || false,
    };
  }, uid);
}

async function getTargets(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById("game-canvas");
    const mount = document.getElementById("prep-storage-mount");
    const cr = canvas.getBoundingClientRect();
    const sr = mount.getBoundingClientRect();
    return {
      board: { x: cr.left + cr.width * 0.5, y: cr.top + cr.height * 0.35 },
      storage: { x: sr.left + sr.width * 0.5, y: sr.top + sr.height * 0.55 },
    };
  });
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 834, height: 1194 } });
  try {
    await enterPrep(page);
    const targets = await getTargets(page);

    const bought = await buyToStorage(page, "a");
    assert(bought.ok, bought.reason || "buy failed");

    const toBoard = await flingStorageItem(page, bought.uid, targets.board.x, targets.board.y, { arc: 60 });
    assert(!toBoard.fliers, `flier stuck: ${JSON.stringify(toBoard)}`);
    assert(toBoard.onBoard, `board place failed: ${JSON.stringify(toBoard)}`);

    const bought2 = await buyToStorage(page, "b");
    assert(bought2.ok, bought2.reason || "buy2 failed");

    const toStorage = await flingStorageItem(
      page,
      bought2.uid,
      targets.storage.x,
      targets.storage.y,
      { arc: 10, steps: 4 },
    );
    assert(!toStorage.fliers, `storage flier stuck: ${JSON.stringify(toStorage)}`);
    assert(toStorage.onBench, `not back in bench: ${JSON.stringify(toStorage)}`);
    assert(!toStorage.hidden, `bench item hidden: ${JSON.stringify(toStorage)}`);
    assert(toStorage.hit >= 0, `bench item not clickable: ${JSON.stringify(toStorage)}`);

    const toBoard2 = await flingStorageItem(page, bought2.uid, targets.board.x, targets.board.y, { arc: 70 });
    assert(toBoard2.onBoard || toBoard2.onBench, `second board throw lost item: ${JSON.stringify(toBoard2)}`);
    assert(!toBoard2.fliers, `second flier stuck`);

    console.log("prep-storage-fling.test.mjs: OK", JSON.stringify({ toBoard, toStorage, toBoard2 }));
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("prep-storage-fling.test.mjs: FAIL", err.message);
  process.exit(1);
});
