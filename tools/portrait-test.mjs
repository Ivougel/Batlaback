import { chromium, devices } from "playwright";

const browser = await chromium.launch();
for (const [name, device] of [
  ["iphone", devices["iPhone 14 Pro Max"]],
  ["ipad", devices["iPad Mini"]],
]) {
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`file://${process.cwd()}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const html = document.documentElement;
    const cs = getComputedStyle(html);
    const overlay = document.getElementById("class-overlay");
    return {
      prepLayout: html.dataset.prepLayout,
      uiSurface: html.dataset.uiSurface,
      orientation: html.dataset.orientation,
      htmlDisplay: cs.display,
      htmlHeight: html.offsetHeight,
      htmlOverflow: cs.overflow,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      overlayHidden: overlay?.classList.contains("hidden"),
      overlayDisplay: overlay ? getComputedStyle(overlay).display : null,
      overlayBg: overlay ? getComputedStyle(overlay).backgroundColor : null,
      overlayH: overlay?.offsetHeight,
      appVis: document.getElementById("app") ? getComputedStyle(document.getElementById("app")).visibility : null,
      modalText: document.querySelector(".class-modal h2")?.textContent?.slice(0, 40),
    };
  });
  await page.screenshot({ path: `tools/shot-${name}.png`, fullPage: true });
  console.log(name, JSON.stringify(info, null, 2));
  if (errors.length) console.log("errors", errors);
  await context.close();
}
await browser.close();
