import { chromium, devices } from "playwright";

const baseUrl = `file://${process.cwd()}/index.html`;

const viewports = [
  { name: "iPad Mini landscape", ...devices["iPad Mini"], viewport: { width: 1133, height: 744 } },
  { name: "iPad Mini portrait", ...devices["iPad Mini"], viewport: { width: 744, height: 1133 } },
  { name: "iPad Mini PW landscape", ...devices["iPad Mini"], viewport: { width: 1024, height: 768 } },
];

function readType(el) {
  if (!el) return null;
  const cs = getComputedStyle(el);
  const b = el.getBoundingClientRect();
  return {
    text: (el.textContent || "").trim().slice(0, 40),
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
}

async function auditPage(page, label) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.applyUiLayout === "function");
  await page.evaluate(() => window.applyUiLayout?.());
  await page.waitForTimeout(300);

  const data = await page.evaluate(() => {
    const read = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return {
        text: (el.textContent || "").trim().slice(0, 48),
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        w: Math.round(b.width),
        h: Math.round(b.height),
      };
    };
    const root = getComputedStyle(document.documentElement);
    return {
      vv: { w: innerWidth, h: innerHeight },
      attrs: {
        uiTier: document.documentElement.dataset.uiTier,
        uiSurface: document.documentElement.dataset.uiSurface,
        layoutProfile: document.documentElement.dataset.layoutProfile,
        prepLayout: document.documentElement.dataset.prepLayout,
        uiCompact: document.documentElement.dataset.uiCompact,
      },
      scales: {
        uiScale: root.getPropertyValue("--ui-scale").trim(),
        typeScale: root.getPropertyValue("--type-scale").trim(),
        fontRoot: root.getPropertyValue("--font-root").trim(),
      },
      elements: {
        title: read("#class-overlay .class-modal-title"),
        stepBadge: read("#class-overlay .class-step-badge"),
        actionHint: read("#class-overlay .class-action-hint"),
        modeName: read("#class-overlay .game-mode-card .class-name"),
        modeDesc: read("#class-overlay .game-mode-card .class-desc"),
        modeBadge: read("#class-overlay .game-mode-card .class-badge"),
        rosterLabel: read("#class-overlay .class-hero-roster-label"),
        rosterHint: read("#class-overlay .class-hero-roster-hint"),
        footer: read("#class-overlay .class-modal-footer"),
        chromeStep: read(".bottom-chrome-intro-step"),
        chromeHint: read(".bottom-chrome-intro-hint"),
        chromeStart: read(".bottom-chrome-intro .btn-glass-start"),
      },
    };
  });

  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
  await page.screenshot({ path: `tools/audit-intro-${label.replace(/\s+/g, "-").toLowerCase()}.png`, fullPage: true });
}

const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({
    ...vp,
    viewport: vp.viewport,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await auditPage(page, vp.name);
  await context.close();
}
await browser.close();
