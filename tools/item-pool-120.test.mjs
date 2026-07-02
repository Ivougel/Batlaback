/**
 * Тесты пула v120.
 * node tools/item-pool-120.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadSandbox() {
  const sandbox = {
    console, Math, Object, Array, Map, Set, JSON, Number, String, Boolean,
    window: null, document: { documentElement: { dataset: {} } },
    localStorage: { getItem: () => null },
    location: { search: "" },
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/item-pool-120.js"), "utf8"), ctx);
  vm.runInContext(`
    Object.assign(globalThis, {
      ITEM_POOL_120_MANIFEST,
      isItemInPool120,
      getItemPool120Ids,
      getItemPool120Layer,
      filterItemsToPool120,
      setItemPool120Enabled,
    });
  `, ctx);
  return sandbox;
}

function run() {
  const s = loadSandbox();
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/item-pool-120-manifest.json"), "utf8"));
  let passed = 0;

  assert(manifest.items.length === 120, "manifest: 120 items");
  assert(new Set(manifest.items).size === 120, "manifest: unique ids");
  passed++;

  assert(s.getItemPool120Ids().length === 120, "runtime set size");
  passed++;

  assert(s.isItemInPool120("apple"), "starter apple");
  assert(s.isItemInPool120("enh_hymn_veil"), "enhancement");
  assert(s.isItemInPool120("amplify_fire"), "amplifier");
  assert(!s.isItemInPool120("artifact_stone_death"), "excluded artifact");
  passed++;

  assert(s.getItemPool120Layer("mana_crystal") === "starter", "layer starter");
  assert(s.getItemPool120Layer("fire_staff") === "triple_support", "layer triple");
  passed++;

  assert(s.isItemPool120Enabled() === true, "pool always enabled");
  passed++;

  const filtered = s.filterItemsToPool120([
    { id: "apple" }, { id: "artifact_stone_death" },
  ]);
  assert(filtered.length === 1 && filtered[0].id === "apple", "filter excludes legacy");
  passed++;

  console.log(`item-pool-120.test.mjs: ${passed}/${passed} OK`);
}

run();
