/**
 * Max-account pool — classic shop + craft reachability.
 * node tools/max-account-pool.test.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditMaxAccountPool,
  computeReachableItemIds,
  createMaxAccountSandbox,
  isClassicPlayableItem,
} from "./lib/max-account-sandbox.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const s = createMaxAccountSandbox(ROOT, "classic");

  assert(s.isMaxAccountMode(), "max account in classic");
  assert(s.isClassicMode(), "classic mode");
  assert(!s.shouldUseClassSystem(), "class combat bonuses off");
  assert(s.shouldApplyClassItemRestriction(), "class item restrictions on");

  const heroes = Object.keys(s.CLASS_CATALOG || {});
  heroes.forEach((id) => {
    assert(s.MetaProgress.isHeroUnlocked(id), `hero unlocked: ${id}`);
  });

  assert(s.MetaProgress.isItemUnlocked("katana", "warrior"), "items unlocked in max account");
  assert(!s.getItemPresentationState("katana", "warrior").locked, "no lock overlay");

  const report = auditMaxAccountPool(s);
  assert(report.shopEligible > 50, `shop pool reasonable: ${report.shopEligible}`);
  assert(report.reachable > report.shopEligible, "craft extends beyond shop");

  const playable = Object.values(s.ITEM_CATALOG).filter(isClassicPlayableItem);
  const classRestricted = playable.filter((item) => item.classRestriction);
  heroes.forEach((heroId) => {
    const reachable = computeReachableItemIds(s, 10, heroId);
    const expectedInShop = classRestricted.filter((item) =>
      item.classRestriction === heroId && s.isShopEligibleItem(item, heroId, 10));
    const bad = expectedInShop.filter((item) => !reachable.has(item.id));
    if (bad.length) {
      throw new Error(`shop class items unreachable for ${heroId} (${bad.length}): ${bad.slice(0, 8).map((i) => i.id).join(", ")}`);
    }
  });

  assert(!s.isShopEligibleItem(s.ITEM_CATALOG?.king_goobert, "warrior", 10), "craft-only not in shop");
  assert(!s.isShopEligibleItem(s.ITEM_CATALOG?.light_goobert, "rogue", 10), "craft output not in shop");

  assert(!s.isItemAllowedForHeroClass({ classRestriction: "rogue" }, "warrior"), "warrior cannot equip rogue gear");
  assert(s.isItemAllowedForHeroClass({ classRestriction: "rogue" }, "rogue"), "rogue can equip rogue gear");
  assert(s.isItemAllowedForHeroClass({ classRestriction: null }, "warrior"), "neutral gear for warrior");

  console.log("max-account-pool.test.mjs: OK");
  console.log(`  shop=${report.shopEligible} reachable(warrior)=${report.reachable} classRestricted=${classRestricted.length}`);
}

run();
