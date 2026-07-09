import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = `file://${root}/index.html`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices["iPad Mini"],
  viewport: { width: 1024, height: 768 },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const state = await page.evaluate(() => {
  const html = document.documentElement;
  const overlay = document.getElementById("class-overlay");
  const app = document.getElementById("app");
  const modal = overlay?.querySelector(".class-modal");
  const step = overlay?.querySelector(".class-step:not(.hidden)");
  return {
    vexp: html.dataset.visualExperiment,
    prepLayout: html.dataset.prepLayout,
    uiSurface: html.dataset.uiSurface,
    htmlDisplay: getComputedStyle(html).display,
    overlayHidden: overlay?.classList.contains("hidden"),
    overlayDisplay: overlay ? getComputedStyle(overlay).display : null,
    overlayH: overlay?.offsetHeight,
    modalH: modal?.offsetHeight,
    modalDisplay: modal ? getComputedStyle(modal).display : null,
    stepH: step?.offsetHeight,
    stepText: step?.textContent?.slice(0, 80),
    appVis: app ? getComputedStyle(app).visibility : null,
    appH: app?.offsetHeight,
    bodyChildren: [...document.body.children].map((el) => ({
      id: el.id,
      cls: el.className?.slice?.(0, 40),
      h: el.offsetHeight,
      display: getComputedStyle(el).display,
      vis: getComputedStyle(el).visibility,
    })),
  };
});
console.log(JSON.stringify(state, null, 2));
if (errors.length) console.log("errors", errors);
await page.screenshot({ path: "tools/debug-ipad-landscape.png", fullPage: true });
await browser.close();
