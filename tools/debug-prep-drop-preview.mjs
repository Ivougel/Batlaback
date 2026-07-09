import { chromium } from "playwright";

const URL = process.env.PREP_URL || "http://127.0.0.1:3456/index.html";

async function run() {
  const profile = process.env.PREP_PROFILE || "desktop";
  const browser = await chromium.launch({ headless: true });
  const contexts = {
    desktop: { viewport: { width: 1400, height: 900 } },
    tabletSide: { viewport: { width: 1180, height: 820 } },
    tablet: { viewport: { width: 834, height: 1194 }, isMobile: true, hasTouch: true },
  };
  const ctxOpts = contexts[profile] || contexts.desktop;
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  await page.click('[data-game-mode="lobby"]');
  await page.click('.class-card[data-class="mage"]');
  await page.click("#btn-start-run");
  await page.waitForSelector('#app[data-phase="prep"]', { timeout: 15000 });
  await page.waitForTimeout(800);

  let benchCard = page.locator(".bench-card:not(.empty)").first();
  if (!(await benchCard.count())) {
    const shopCard = page.locator(".shop-card:not(.empty)").first();
    await shopCard.waitFor({ state: "visible", timeout: 10000 });
    const shopBox = await shopCard.boundingBox();
    const canvasBox0 = await page.locator("#game-canvas").boundingBox();
    if (!shopBox || !canvasBox0) throw new Error("missing shop/canvas");
    await page.mouse.move(shopBox.x + shopBox.width / 2, shopBox.y + shopBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox0.x + canvasBox0.width * 0.5, canvasBox0.y + canvasBox0.height * 0.5, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    benchCard = page.locator(".bench-card:not(.empty)").first();
  }

  const benchBox = await benchCard.boundingBox();
  const canvasBox = await page.locator("#game-canvas").boundingBox();
  if (!benchBox || !canvasBox) throw new Error("missing layout boxes");

  const targetX = canvasBox.x + canvasBox.width * 0.55;
  const targetY = canvasBox.y + canvasBox.height * 0.45;

  await page.mouse.move(benchBox.x + benchBox.width / 2, benchBox.y + benchBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 12 });

  const report = await page.evaluate(() => {
    const canvas = document.getElementById("game-canvas");
    const anchor = document.getElementById("canvas-fx-anchor");
    const col = document.getElementById("prep-field-column");
    const cr = canvas?.getBoundingClientRect();
    const ar = anchor?.getBoundingClientRect();
    const vr = col?.getBoundingClientRect();
    const fx = document.getElementById("canvas-fx");
    const main = document.getElementById("game-canvas");
    const countPixels = (el) => {
      if (!el) return null;
      const ctx = el.getContext("2d");
      const data = ctx.getImageData(0, 0, el.width, el.height).data;
      let colored = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 8) colored += 1;
      }
      return { colored, total: data.length / 4 };
    };
    return {
      layout: {
        prepLayout: document.documentElement.dataset.prepLayout,
        uiSurface: document.documentElement.dataset.uiSurface,
        uiTier: document.documentElement.dataset.uiTier,
        layoutProfile: document.documentElement.dataset.layoutProfile,
      },
      geom:
        cr && ar && vr
          ? {
              delta: {
                l: Math.abs(cr.left - ar.left),
                t: Math.abs(cr.top - ar.top),
                w: Math.abs(cr.width - ar.width),
                h: Math.abs(cr.height - ar.height),
              },
              relToCol: {
                canvas: { l: cr.left - vr.left, t: cr.top - vr.top },
                anchor: { l: ar.left - vr.left, t: ar.top - vr.top },
              },
            }
          : null,
      state: {
        dragPayload: !!dragPayload,
        hoverSlot,
        hoverCell,
        prepDropPreviewHover,
        placement:
          typeof getPrepDropPlacement === "function"
            ? getPrepDropPlacement(getSideState(prepViewSide), prepViewSide)
            : null,
        canEdit: typeof canEditPrepSide === "function" ? canEditPrepSide() : null,
      },
      fxPixels: countPixels(fx),
      mainPixels: countPixels(main),
    };
  });

  console.log(JSON.stringify({ profile, ...report }, null, 2));
  await page.screenshot({ path: `tools/debug-prep-drop-preview-${profile}.png` });
  await page.mouse.up();
  await context.close();
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
