/**
 * Аудит craftOnly / shop / recipes — classic BB.
 * node tools/item-craft-audit.test.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMaxAccountSandbox } from "./lib/max-account-sandbox.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const s = createMaxAccountSandbox(path.join(ROOT, ".."), "classic");
  const catalog = Object.values(s.ITEM_CATALOG);
  const outputs = new Set(s.getCraftOutputItemIds?.() || []);

  const shopLeaks = catalog.filter((item) => {
    if (!s.isShopEligibleItem(item, "warrior", 10)) return false;
    return item.craftOnly || outputs.has(item.id);
  });
  assert(shopLeaks.length === 0, `shop leaks (${shopLeaks.length}): ${shopLeaks.slice(0, 8).map((i) => i.id).join(", ")}`);

  const outputNotCraftOnly = catalog.filter((item) => outputs.has(item.id) && !item.craftOnly);
  assert(outputNotCraftOnly.length === 0, `recipe outputs without craftOnly (${outputNotCraftOnly.length}): ${outputNotCraftOnly.slice(0, 8).map((i) => i.id).join(", ")}`);

  const orphanCraftOnly = catalog.filter((item) => {
    if (!item.craftOnly) return false;
    if (outputs.has(item.id)) return false;
    return item.id !== "rainbow_goobert";
  });
  assert(orphanCraftOnly.length === 0, `craftOnly without recipe (${orphanCraftOnly.length}): ${orphanCraftOnly.slice(0, 8).map((i) => i.id).join(", ")}`);

  console.log("item-craft-audit.test.mjs: OK");
  console.log(`  craft outputs=${outputs.size} craftOnly=${catalog.filter((i) => i.craftOnly).length}`);
}

run();
