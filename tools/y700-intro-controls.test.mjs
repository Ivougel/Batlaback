/**
 * Lenovo Legion Y700 (8.8", 2560×1600) — intro controls geometry + tap flow.
 * CSS viewports at DPR 2–2.5: landscape 1280×800 / 1024×640, portrait 800×1280 / 640×1024.
 * Запуск: node tools/y700-intro-controls.test.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const TOUCH_MIN = 44;

const Y700_PROFILES = [
  {
    id: "y700-landscape-1280",
    device: {
      ...devices["Galaxy Tab S9"],
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    expectTier: "tablet",
    expectLayout: "tablet-landscape",
  },
  {
    id: "y700-landscape-1024",
    device: {
      ...devices["Galaxy Tab S9"],
      viewport: { width: 1024, height: 640 },
      deviceScaleFactor: 2.5,
      isMobile: true,
      hasTouch: true,
    },
    expectTier: "tablet",
    expectLayout: "tablet-landscape",
  },
  {
    id: "y700-portrait-800",
    device: {
      ...devices["Galaxy Tab S9"],
      viewport: { width: 800, height: 1280 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    expectTier: "tablet",
    expectLayout: "tablet-portrait",
  },
  {
    id: "y700-portrait-640",
    device: {
      ...devices["Galaxy Tab S9"],
      viewport: { width: 640, height: 1024 },
      deviceScaleFactor: 2.5,
      isMobile: true,
      hasTouch: true,
    },
    expectTier: "phone",
    expectLayout: "phone-portrait",
  },
  {
    id: "y700-landscape-pwa-gap",
    device: {
      ...devices["Galaxy Tab S9"],
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    expectTier: "tablet",
    expectLayout: "tablet-landscape",
    visualGap: 52,
  },
  {
    id: "y700-native-landscape",
    device: {
      viewport: { width: 2560, height: 1600 },
      isMobile: true,
      hasTouch: true,
    },
    expectTier: "tablet",
    expectLayout: "tablet-landscape",
  },
  {
    id: "y700-native-portrait",
    device: {
      viewport: { width: 1600, height: 2560 },
      isMobile: true,
      hasTouch: true,
    },
    expectTier: "tablet",
    expectLayout: "tablet-portrait",
  },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function emulatePwaStandalone(page) {
  await page.addInitScript(() => {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = orig(query);
      if (query.includes("display-mode: standalone")) {
        return {
          ...result,
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      }
      return result;
    };
  });
}

function measureIntroControls() {
  const root = document.documentElement;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const vv = window.visualViewport;
  const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? vh);
  const screenBottom = Math.max(vh, viewBottom);

  const overlay = document.getElementById("class-overlay");
  const chrome = document.getElementById("bottom-chrome");
  const playBtn = document.getElementById("btn-bb-intro-play");
  const backBtn = document.getElementById("btn-class-back");
  const playerStep = document.getElementById("class-step-player");
  const summaryStep = document.getElementById("class-step-summary");
  const modal = document.querySelector("#class-overlay .class-modal");

  const rect = (el) => el?.getBoundingClientRect() ?? { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  const cs = (el) => (el ? getComputedStyle(el) : null);

  const chromeR = rect(chrome);
  const playR = rect(playBtn);
  const overlayR = rect(overlay);
  const modalR = rect(modal);
  const playerR = rect(playerStep);
  const summaryR = rect(summaryStep);

  const pinY = parseFloat(root.style.getPropertyValue("--bottom-chrome-pin-y"))
    || parseFloat(getComputedStyle(root).getPropertyValue("--bottom-chrome-pin-y"))
    || 0;
  const liftY = parseFloat(root.style.getPropertyValue("--bottom-chrome-lift-y"))
    || parseFloat(getComputedStyle(root).getPropertyValue("--bottom-chrome-lift-y"))
    || 0;
  const chromeReserve = parseFloat(getComputedStyle(root).getPropertyValue("--class-intro-chrome-h")) || 0;

  const playCs = cs(playBtn);
  const overlayCs = cs(overlay);

  return {
    vw,
    vh,
    screenBottom,
    tier: root.dataset.uiTier,
    layoutProfile: root.dataset.layoutProfile,
    prepLayout: root.dataset.prepLayout,
    bbIntro: root.dataset.bbIntro,
    step: overlay?.dataset.classIntroStep,
    pinY,
    liftY,
    chromeReserve,
    chromeShare: chromeR.height / vh,
    chromeBottomGap: screenBottom - chromeR.bottom,
    chromeVisualGap: viewBottom - chromeR.bottom,
    chromeTop: chromeR.top,
    chromeH: chromeR.height,
    play: playBtn
      ? {
          hidden: playBtn.hidden || playCs?.display === "none",
          disabled: playBtn.disabled,
          text: playBtn.textContent?.trim(),
          w: playR.width,
          h: playR.height,
          top: playR.top,
          bottom: playR.bottom,
          pointerEvents: playCs?.pointerEvents,
        }
      : null,
    back: backBtn
      ? {
          w: rect(backBtn).width,
          h: rect(backBtn).height,
        }
      : null,
    overlayPointerEvents: overlayCs?.pointerEvents,
    hitTarget: playBtn
      ? document.elementFromPoint(playR.left + playR.width / 2, playR.top + playR.height / 2)?.id
      : null,
    modalBottom: modalR.bottom,
    modalLeft: modalR.left,
    modalWidth: modalR.width,
    playerBottom: playerR.bottom,
    summaryBottom: summaryR.bottom,
    overlayBottom: overlayR.bottom,
    overlayPaddingBottom: parseFloat(overlayCs?.paddingBottom) || 0,
  };
}

async function runProfile(testCase) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...testCase.device });
  const page = await context.newPage();
  await emulatePwaStandalone(page);

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => typeof selectPlayerClass === "function");
    if (testCase.visualGap) {
      await page.evaluate((gap) => {
        const vvH = window.innerHeight - gap;
        const mock = {
          height: vvH,
          width: window.innerWidth,
          offsetTop: 0,
          offsetLeft: 0,
          scale: 1,
          pageTop: 0,
          pageLeft: 0,
          addEventListener: () => {},
          removeEventListener: () => {},
        };
        Object.defineProperty(window, "visualViewport", { value: mock, configurable: true });
      }, testCase.visualGap);
    }
    await page.evaluate(() => {
      window.applyUiLayout?.();
      window.syncBBIntroLayout?.();
    });
    await page.waitForTimeout(300);

    // ── Player step: hero selected ──
    await page.evaluate(() => {
      selectPlayerClass("warrior");
      window.applyUiLayout?.();
      window.syncClassOverlayAnchors?.();
      window.syncBBIntroLayout?.();
    });
    await page.waitForTimeout(400);

    const player = await page.evaluate(measureIntroControls);

    assert(player.tier === testCase.expectTier, `tier: expected ${testCase.expectTier}, got ${player.tier}`);
    assert(player.layoutProfile === testCase.expectLayout, `layout: expected ${testCase.expectLayout}, got ${player.layoutProfile}`);
    assert(player.bbIntro, "BB intro layout not active");
    if (testCase.device?.viewport?.width >= 2000) {
      assert(player.modalWidth > 400, `modal too narrow at native res: ${player.modalWidth}px`);
      assert(
        player.modalLeft + player.modalWidth / 2 > player.vw * 0.25
          && player.modalLeft + player.modalWidth / 2 < player.vw * 0.75,
        `modal off-center at native res: left=${player.modalLeft} w=${player.modalWidth} vw=${player.vw}`,
      );
    }
    assert(player.play && !player.play.hidden, "btn-bb-intro-play hidden on player step");
    assert(!player.play.disabled, "btn-bb-intro-play disabled after hero pick");
    assert(player.play.text === "Продолжить", `play label: ${player.play.text}`);
    assert(player.play.h >= TOUCH_MIN - 2, `play btn too short: ${player.play.h}px`);
    assert(player.play.w >= 72, `play btn too narrow: ${player.play.w}px`);
    assert(player.chromeH >= 32, `chrome too short: ${player.chromeH}px`);
    assert(player.chromeShare <= 0.22, `chrome eats viewport: ${(player.chromeShare * 100).toFixed(1)}%`);
    const chromeMinShare = Math.max(
      testCase.device?.viewport?.width ?? 0,
      testCase.device?.viewport?.height ?? 0,
    ) >= 1400 ? 0.018 : 0.04;
    assert(player.chromeShare >= chromeMinShare, `chrome too tiny: ${(player.chromeShare * 100).toFixed(1)}%`);
    assert(
      Math.abs(player.chromeVisualGap) <= 4,
      `chrome not aligned to visual bottom: gap=${player.chromeVisualGap}px pin=${player.pinY} lift=${player.liftY}`,
    );
    if (!testCase.visualGap) {
      assert(player.chromeBottomGap <= 4, `chrome gap from layout bottom: ${player.chromeBottomGap}px`);
    }
    if (testCase.visualGap) {
      assert(player.liftY >= testCase.visualGap - 2, `expected lift ~${testCase.visualGap}px, got ${player.liftY}`);
      assert(player.hitTarget === "btn-bb-intro-play", `tap hits ${player.hitTarget} not play btn`);
      assert(player.overlayPointerEvents === "none", `overlay should not block chrome taps: ${player.overlayPointerEvents}`);
    }
    assert(player.playerBottom <= player.chromeTop + 8, `player step overlaps chrome: ${player.playerBottom} > ${player.chromeTop}`);
    assert(
      player.play.bottom <= player.vh + 2 && player.play.top >= player.chromeTop - 2,
      "play btn outside chrome band",
    );

    // Tap flow: continue → summary
    const continued = await page.evaluate(() => {
      const btn = document.getElementById("btn-bb-intro-play");
      if (!btn || btn.disabled) return false;
      btn.click();
      return document.getElementById("class-overlay")?.dataset.classIntroStep === "summary";
    });
    assert(continued, "click Продолжить did not reach summary step");
    await page.waitForTimeout(300);

    const summary = await page.evaluate(measureIntroControls);
    assert(summary.step === "summary", `step after continue: ${summary.step}`);
    assert(summary.play && !summary.play.hidden, "play btn hidden on summary");
    assert(!summary.play.disabled, "play btn disabled on summary");
    assert(summary.play.text === "Играть", `summary play label: ${summary.play.text}`);
    assert(summary.play.h >= TOUCH_MIN - 2, `summary play btn too short: ${summary.play.h}px`);
    assert(summary.summaryBottom <= summary.chromeTop + 8, `summary overlaps chrome: ${summary.summaryBottom} > ${summary.chromeTop}`);

    // Tap Играть → run starts
    const started = await page.evaluate(async () => {
      document.getElementById("btn-bb-intro-play")?.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return document.getElementById("class-overlay")?.classList.contains("hidden")
        || document.body.classList.contains("screen-app-visible");
    });
    assert(started, "click Играть did not start run");

    console.log(`✓ ${testCase.id}`, {
      tier: player.tier,
      layout: player.layoutProfile,
      chromePct: `${(player.chromeShare * 100).toFixed(1)}%`,
      play: `${Math.round(player.play.w)}×${Math.round(player.play.h)}`,
      pinY: player.pinY,
      liftY: player.liftY,
      overlayPE: player.overlayPointerEvents,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

const failures = [];
for (const testCase of Y700_PROFILES) {
  try {
    await runProfile(testCase);
  } catch (e) {
    failures.push({ id: testCase.id, error: e.message });
    console.error(`✗ ${testCase.id}: ${e.message}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} Y700 intro test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${Y700_PROFILES.length} Y700 intro control tests passed.`);
