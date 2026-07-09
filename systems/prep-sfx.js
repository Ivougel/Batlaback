// Transpiled from TypeScript — npm run compile:ts

(function initPrepSfxHelpers(global) {
  function play(id, opts) {
    if (typeof playGameSfx === "function") playGameSfx(id, opts);
  }
  function rarityTier(def) {
    const r = def?.rarity || "common";
    if (r === "legendary" || r === "godly" || r === "unique") return "legendary";
    if (r === "epic") return "epic";
    if (r === "rare") return "rare";
    return "common";
  }
  function playPrepCommerceSfx(kind, phase) {
    const map = {
      shop: { open: "prep_shop_open", close: "prep_shop_close" },
      bench: { open: "prep_bench_open", close: "prep_bench_close" },
      doll: { open: "prep_doll_open", close: "prep_doll_close" },
      recipe: { open: "prep_recipe_open", close: "prep_recipe_close" }
    };
    const id = map[kind]?.[phase];
    if (id) play(id);
  }
  function playPrepBuyFanfare(def) {
    const tier = rarityTier(def);
    if (tier === "legendary") play("prep_buy_legendary");
    else if (tier === "epic") play("prep_buy_epic");
    else if (tier === "rare") play("prep_buy_rare");
  }
  function playPrepItemPlacedSfx(item, def) {
    const itemDef = def || (typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[item?.itemId ?? ""] : null);
    const heavy = (itemDef?.shape?.length || 0) > 3;
    play("prep_place", heavy ? { heavy: true } : void 0);
  }
  global.playPrepCommerceSfx = playPrepCommerceSfx;
  global.playPrepBuyFanfare = playPrepBuyFanfare;
  global.playPrepItemPlacedSfx = playPrepItemPlacedSfx;
})(typeof window !== "undefined" ? window : globalThis);
