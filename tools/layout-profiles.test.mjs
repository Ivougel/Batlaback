/**
 * Регрессия адаптивной раскладки — 5 профилей viewport.
 * Запуск: node tools/layout-profiles.test.mjs
 */
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexUrl = `file://${root}/index.html`;

const PROFILES = [
  {
    id: "iphone-portrait",
    device: devices["iPhone 14 Pro Max"],
    expect: {
      prepLayout: "mobile",
      uiSurface: "phone-drawer",
      htmlDisplay: "block",
      htmlNotNone: true,
      overlayVisible: true,
    },
  },
  {
    id: "iphone-landscape",
    device: {
      ...devices["iPhone 14 Pro Max"],
      viewport: { width: 932, height: 430 },
      isMobile: true,
      hasTouch: true,
    },
    expect: {
      orientation: "landscape",
      htmlNotNone: true,
    },
  },
  {
    id: "ipad-portrait",
    device: devices["iPad Mini"],
    expect: {
      prepLayoutNot: "mobile",
      uiSurfaceNot: "phone-drawer",
      tier: "tablet",
      htmlNotNone: true,
      overlayVisible: true,
    },
  },
  {
    id: "ipad-landscape",
    device: {
      ...devices["iPad Mini"],
      viewport: { width: 1024, height: 768 },
      isMobile: true,
      hasTouch: true,
    },
    expect: {
      orientation: "landscape",
      tier: "tablet",
      htmlNotNone: true,
    },
  },
  {
    id: "desktop",
    device: { viewport: { width: 1440, height: 1080 } },
    expect: {
      tier: "desktop",
      htmlNotNone: true,
      overlayVisible: true,
    },
  },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function readState(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const overlay = document.getElementById("class-overlay");
    const htmlCs = getComputedStyle(html);
    const overlayCs = overlay ? getComputedStyle(overlay) : null;
    return {
      prepLayout: html.dataset.prepLayout,
      uiSurface: html.dataset.uiSurface,
      layoutProfile: html.dataset.layoutProfile,
      tier: html.dataset.uiTier,
      orientation: html.dataset.orientation,
      htmlDisplay: htmlCs.display,
      htmlHeight: html.offsetHeight,
      overlayHidden: overlay?.classList.contains("hidden"),
      overlayDisplay: overlayCs?.display ?? null,
      overlayHeight: overlay?.offsetHeight ?? 0,
      modalHeight: document.querySelector("#class-overlay .class-modal")?.offsetHeight ?? 0,
      appH: htmlCs.getPropertyValue("--app-h").trim(),
      zoneUsedH: htmlCs.getPropertyValue("--zone-used-h").trim(),
      modalTitle: document.querySelector(".class-modal h2, .class-modal-eyebrow")?.textContent?.trim() ?? "",
    };
  });
}

const browser = await chromium.launch();
const failures = [];

for (const profile of PROFILES) {
  const context = await browser.newContext({ ...profile.device });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await page.goto(indexUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1800);
    const state = await readState(page);
    const exp = profile.expect;

    if (exp.prepLayout) assert(state.prepLayout === exp.prepLayout, `prepLayout: ${state.prepLayout} !== ${exp.prepLayout}`);
    if (exp.prepLayoutNot) assert(state.prepLayout !== exp.prepLayoutNot, `prepLayout should not be ${exp.prepLayoutNot}`);
    if (exp.uiSurface) assert(state.uiSurface === exp.uiSurface, `uiSurface: ${state.uiSurface} !== ${exp.uiSurface}`);
    if (exp.uiSurfaceNot) assert(state.uiSurface !== exp.uiSurfaceNot, `uiSurface should not be ${exp.uiSurfaceNot}`);
    if (exp.tier) assert(state.tier === exp.tier, `tier: ${state.tier} !== ${exp.tier}`);
    if (exp.orientation) assert(state.orientation === exp.orientation, `orientation: ${state.orientation}`);
    if (exp.htmlDisplay) assert(state.htmlDisplay === exp.htmlDisplay, `html display: ${state.htmlDisplay}`);
    if (exp.htmlNotNone) {
      assert(state.htmlDisplay !== "none", "html must not be display:none");
      assert(state.htmlHeight > 100, `html height too small: ${state.htmlHeight}`);
    }
    if (exp.overlayVisible) {
      assert(!state.overlayHidden, "class-overlay should be visible on boot");
      assert(state.overlayDisplay !== "none", "overlay display:none");
      assert(state.overlayHeight > 100, `overlay height: ${state.overlayHeight}`);
      assert(state.modalHeight > 120, `class-modal collapsed: ${state.modalHeight}px`);
    }
    if (errors.length) throw new Error(`JS errors: ${errors.join("; ")}`);

    console.log(`✓ ${profile.id}`, JSON.stringify({
      prepLayout: state.prepLayout,
      uiSurface: state.uiSurface,
      layoutProfile: state.layoutProfile,
      htmlDisplay: state.htmlDisplay,
    }));
  } catch (e) {
    failures.push({ id: profile.id, error: e.message });
    console.error(`✗ ${profile.id}: ${e.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} profile(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${PROFILES.length} layout profiles passed.`);
