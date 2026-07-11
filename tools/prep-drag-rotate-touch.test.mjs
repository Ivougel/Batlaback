/**
 * Prep drag rotate: secondary touch / Pencil cancel must not drop the item.
 * Запуск: node tools/prep-drag-rotate-touch.test.mjs
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

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPad Mini"] });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => typeof startRunFromOverlay === "function");
  await quickStartPrep(page, { settleMs: 800 });

  const result = await page.evaluate(async () => {
    const st = typeof getSideState === "function" ? getSideState("player") : null;
    const entry = st?.shop?.[0];
    if (!entry || typeof beginPendingShopDrag !== "function") {
      return { ok: false, reason: "no shop entry" };
    }

    const card = document.querySelector(".shop-card:not(.empty)");
    if (!card) return { ok: false, reason: "no card" };
    const r = card.getBoundingClientRect();
    const x0 = r.left + r.width / 2;
    const y0 = r.top + r.height / 2;

    // ——— A: two-finger touch (secondary → rotate, then primary cancel) ———
    card.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, clientX: x0, clientY: y0,
      pointerId: 11, pointerType: "touch", isPrimary: true, button: 0, buttons: 1,
    }));
    const moveA = new PointerEvent("pointermove", {
      bubbles: true, cancelable: true, clientX: x0 + 40, clientY: y0 + 40,
      pointerId: 11, pointerType: "touch", isPrimary: true, button: 0, buttons: 1,
    });
    document.dispatchEvent(moveA);
    window.dispatchEvent(moveA);
    if (!dragPayload && typeof startShopDrag === "function") {
      startShopDrag(0, { clientX: x0 + 40, clientY: y0 + 40, preventDefault() {} }, "player");
    }
    if (!dragPayload) return { ok: false, reason: "no dragPayload A" };

    const rotA0 = dragPayload.rotation || 0;
    document.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, clientX: x0 + 80, clientY: y0 + 10,
      pointerId: 12, pointerType: "touch", isPrimary: false, button: 0, buttons: 1,
    }));
    const rotA1 = dragPayload?.rotation ?? null;
    const stillA1 = !!dragPayload;

    document.dispatchEvent(new PointerEvent("pointercancel", {
      bubbles: true, cancelable: true, clientX: x0 + 40, clientY: y0 + 40,
      pointerId: 11, pointerType: "touch", isPrimary: true,
    }));
    const stillA2 = !!dragPayload;

    // Cleanup A + cooldown поворота между сценариями
    if (dragPayload && typeof finishDragDrop === "function") {
      finishDragDrop({ clientX: x0, clientY: y0, preventDefault() {}, button: 0 });
    }
    if (typeof resetPrepTouchGesture === "function") resetPrepTouchGesture();
    await new Promise((r) => setTimeout(r, 180));

    // ——— B: Pencil hold → OS cancel FIRST → finger tap (реальный порядок iPad) ———
    card.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, clientX: x0, clientY: y0,
      pointerId: 21, pointerType: "pen", isPrimary: true, button: 0, buttons: 1,
    }));
    const moveB = new PointerEvent("pointermove", {
      bubbles: true, cancelable: true, clientX: x0 + 50, clientY: y0 + 30,
      pointerId: 21, pointerType: "pen", isPrimary: true, button: 0, buttons: 1,
    });
    document.dispatchEvent(moveB);
    window.dispatchEvent(moveB);
    if (!dragPayload && typeof startShopDrag === "function") {
      startShopDrag(0, { clientX: x0 + 50, clientY: y0 + 30, preventDefault() {} }, "player");
    }
    if (!dragPayload) return { ok: false, reason: "no dragPayload B (pen)" };
    if (typeof setPrepDragPrimaryPointerId === "function") setPrepDragPrimaryPointerId(21);

    const rotB0 = dragPayload.rotation || 0;

    // iPadOS: cancel Pencil до pointerdown пальца
    document.dispatchEvent(new PointerEvent("pointercancel", {
      bubbles: true, cancelable: true, clientX: x0 + 50, clientY: y0 + 30,
      pointerId: 21, pointerType: "pen", isPrimary: true,
    }));
    window.dispatchEvent(new PointerEvent("pointercancel", {
      bubbles: true, cancelable: true, clientX: x0 + 50, clientY: y0 + 30,
      pointerId: 21, pointerType: "pen", isPrimary: true,
    }));
    const stillAfterPenCancel = !!dragPayload;
    const orphaned = typeof isPrepDragOrphanedAfterCancel === "function"
      && isPrepDragOrphanedAfterCancel();

    // Палец → поворот (orphaned path + touchstart fallback)
    try {
      const touch = new Touch({
        identifier: 31,
        target: document.body,
        clientX: x0 + 100,
        clientY: y0 + 20,
      });
      document.dispatchEvent(new TouchEvent("touchstart", {
        bubbles: true, cancelable: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      }));
    } catch (_) {
      /* Touch ctor may be missing — pointerdown ниже достаточно */
    }
    document.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, clientX: x0 + 100, clientY: y0 + 20,
      pointerId: 31, pointerType: "touch", isPrimary: true, button: 0, buttons: 1,
    }));
    const rotB1 = dragPayload?.rotation ?? null;
    const stillB1 = !!dragPayload;

    // Поднять палец — предмет должен остаться в orphaned drag
    document.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, clientX: x0 + 100, clientY: y0 + 20,
      pointerId: 31, pointerType: "touch", isPrimary: true, button: 0, buttons: 0,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, clientX: x0 + 100, clientY: y0 + 20,
      pointerId: 31, pointerType: "touch", isPrimary: true, button: 0, buttons: 0,
    }));
    const stillAfterFingerUp = !!dragPayload;

    return {
      ok: true,
      rotA0,
      rotA1,
      stillA1,
      stillA2,
      rotatedA: rotA1 !== null && rotA1 !== rotA0,
      rotB0,
      rotB1,
      stillAfterPenCancel,
      orphaned,
      stillB1,
      stillAfterFingerUp,
      rotatedB: rotB1 !== null && rotB1 !== rotB0,
    };
  });

  assert(result.ok, result.reason || "eval failed");
  assert(result.stillA1, "A: secondary touch dropped drag");
  assert(result.rotatedA, `A: expected rotate ${result.rotA0} → ${result.rotA1}`);
  assert(result.stillA2, "A: pointercancel on primary dropped drag");

  assert(result.stillAfterPenCancel, "B: Pencil pointercancel dropped drag (bindPrepLoadout bug)");
  assert(result.orphaned, "B: expected orphaned after Pencil cancel");
  assert(result.rotatedB, `B: Pencil+finger expected rotate ${result.rotB0} → ${result.rotB1}`);
  assert(result.stillB1, "B: finger tap dropped drag");
  assert(result.stillAfterFingerUp, "B: finger up after rotate dropped orphaned drag");

  console.log("✓ prep-drag-rotate-touch", result);
} finally {
  await context.close();
  await browser.close();
}
