/**
 * Prep-phase shop & bench: stock, purchase, sell, DOM render.
 * State lives in game.js — register via registerPrepShopRuntime() before init.
 */

const MAX_BENCH = 6;
const MAX_SHOP = 5;

let rt = null;

function registerPrepShopRuntime(deps) {
  rt = deps;
}

function getShopContextForSide(side = rt.getPrepViewSide(), opts = {}) {
  const st = rt.getSideState(side);
  const otherItems = side === "player" ? rt.getEnemyItems() : rt.getPlayerItems();
  const loadoutItems = st.items;
  return {
    round: rt.getRound(),
    gold: st.gold,
    goldSpentTotal: side === "player" ? rt.getGoldSpentTotal() : 0,
    goldEarnedTotal: side === "player" ? rt.getGoldEarnedTotal() : 0,
    recentResults: rt.getRecentBattleResults().slice(-3),
    playerClass: st.classId,
    loadoutTags: collectLoadoutTags(loadoutItems),
    loadoutItems,
    opponentLoadoutTags: collectLoadoutTags(otherItems),
    isReroll: !!opts.isReroll,
    hasUniqueInLoadout: typeof loadoutHasUniqueItem === "function"
      ? loadoutHasUniqueItem(loadoutItems)
      : false,
    shopModifiers: typeof collectShopPoolModifiers === "function"
      ? collectShopPoolModifiers(loadoutItems)
      : null,
    bonusUniqueGranted: rt.getSideState(side).bonusUniqueGranted,
    enhancements: typeof rt.getSideEnhancements === "function" ? rt.getSideEnhancements(side) : null,
    companionId: typeof rt.getSideCompanionId === "function" ? rt.getSideCompanionId(side) : null,
    mutationId: typeof rt.getSideMutationId === "function" ? rt.getSideMutationId(side) : null,
    mutationFormId: typeof rt.getSideMutationFormId === "function" ? rt.getSideMutationFormId(side) : null,
    unlockedBuilds: typeof collectUnlockedBuilds === "function"
      ? collectUnlockedBuilds(loadoutItems)
      : new Set(),
  };
}

function getShopContext() {
  return getShopContextForSide("player");
}

function ensureSideShopArrays(st) {
  if (st.shop.length !== MAX_SHOP) st.shop.length = MAX_SHOP;
  if (st.shopFrozen.length !== MAX_SHOP) st.shopFrozen.length = MAX_SHOP;
  for (let i = 0; i < MAX_SHOP; i++) {
    if (st.shop[i] === undefined) st.shop[i] = null;
    if (st.shopFrozen[i] === undefined) st.shopFrozen[i] = false;
    if (st.shop[i] && typeof parseEnhancementShopId === "function") {
      const legacyId = parseEnhancementShopId(st.shop[i]);
      if (legacyId) st.shop[i] = legacyId;
    }
  }
}

function isLobby2pSplitPrep() {
  return typeof rt.isLobby2pSplitPrep === "function" && rt.isLobby2pSplitPrep();
}

function resolveShopContainer(side, containerEl) {
  if (containerEl) return containerEl;
  if (isLobby2pSplitPrep()) {
    return document.getElementById(side === "player" ? "lobby2p-shop-slots-0" : "lobby2p-shop-slots-1");
  }
  return document.getElementById("shop-slots");
}

function resolveBenchContainer(side, containerEl) {
  if (containerEl) return containerEl;
  if (isLobby2pSplitPrep()) {
    return document.getElementById(side === "player" ? "lobby2p-bench-slots-0" : "lobby2p-bench-slots-1");
  }
  return document.getElementById("bench-slots");
}

function renderCommerceForMode(affectedSide) {
  if (isLobby2pSplitPrep()) {
    renderShop("player", resolveShopContainer("player"));
    renderShop("enemy", resolveShopContainer("enemy"));
    renderBench("player", resolveBenchContainer("player"));
    renderBench("enemy", resolveBenchContainer("enemy"));
  } else if (affectedSide) {
    renderShop(affectedSide);
    renderBench(affectedSide);
  } else {
    renderShop();
    renderBench();
  }
}

function refreshShopSlotsForSide(side = rt.getPrepViewSide(), opts = {}) {
  const st = rt.getSideState(side);
  ensureSideShopArrays(st);
  const ctx = getShopContextForSide(side, opts);
  const unfrozen = [];
  for (let i = 0; i < MAX_SHOP; i++) {
    if (st.shopFrozen[i] && st.shop[i]) continue;
    unfrozen.push(i);
  }
  if (!unfrozen.length) return [];
  const rolled = rollShopBatch(unfrozen.length, ctx);
  if (ctx.shopModifiers?.bonusUnique > 0 && ctx.bonusUniqueGranted) {
    st.bonusUniqueGranted = true;
  }
  unfrozen.forEach((shopIndex, j) => {
    st.shop[shopIndex] = rolled[j] || rollShopItemGuaranteed(ctx);
  });
  if (opts.isReroll && typeof applyShopRefreshMeta === "function") {
    applyShopRefreshMeta(side, st.items, unfrozen, st, ctx, (msg) => rt.log(msg));
  }
  return unfrozen;
}

function resetShopForNewRoundForSide(side = rt.getPrepViewSide()) {
  if (rt.getGameOver()) return;
  const st = rt.getSideState(side);
  if (typeof rt.shouldUseFixedShop === "function" && rt.shouldUseFixedShop(side)) {
    rt.applyFixedShop?.(side);
    st.shopReadyForRound = rt.getRound();
    return;
  }
  const wasNewRound = st.shopReadyForRound !== rt.getRound();
  refreshShopSlotsForSide(side);
  if (wasNewRound && typeof applyShopEnterMeta === "function") {
    const loadoutChanged = applyShopEnterMeta(side, st.items, (msg) => rt.log(msg));
    if (loadoutChanged && side === rt.getPrepViewSide()) {
      rt.recalcSynergies();
      rt.draw();
      renderCommerceForMode(side);
    }
  }
  rt.getSideState(side).shopReadyForRound = rt.getRound();
}

function ensureShopReadyForSide(side = rt.getPrepViewSide()) {
  if (rt.getGameOver()) return;
  const st = rt.getSideState(side);
  ensureSideShopArrays(st);
  if (st.shopReadyForRound !== rt.getRound()) resetShopForNewRoundForSide(side);
  else ensureShopHasStock(side);
}

function ensureShopHasStock(side = rt.getPrepViewSide()) {
  if (rt.getPhase() !== "prep" || rt.getGameOver()) return;
  const st = rt.getSideState(side);
  ensureSideShopArrays(st);
  if (st.shop.some(Boolean)) return;
  refreshShopSlotsForSide(side);
  st.shopReadyForRound = rt.getRound();
}

function shouldHideShopHints() {
  const root = document.documentElement;
  return root.dataset.uiSurface === "tablet-side"
    || (root.dataset.prepLayout === "side" && root.dataset.touch === "true");
}

function syncShopHintsVisibility() {
  const hide = shouldHideShopHints();
  document.getElementById("shop-panel-hint")?.toggleAttribute("hidden", hide);
  document.querySelector("#shop-panel .shop-hint-touch")?.toggleAttribute("hidden", hide);
  document.querySelector("#shop-panel .shop-sell-hint")?.toggleAttribute("hidden", hide);
}

function refillShopSlots() {
  const st = rt.getSideState("player");
  ensureSideShopArrays(st);
  refreshShopSlotsForSide("player");
}

function refreshShopSlots() {
  const st = rt.getSideState("player");
  ensureSideShopArrays(st);
  refreshShopSlotsForSide("player");
}

function resetShopForNewRound() {
  resetShopForNewRoundForSide("player");
}

function ensureShopReady() {
  ensureShopReadyForSide("player");
}

function refreshShop(pay = false, side = rt.getPrepViewSide()) {
  if (rt.getGameOver() || !rt.canEditPrepSide(side)) return;
  if (typeof rt.canRefreshShop === "function" && !rt.canRefreshShop(side)) return;
  const st = rt.getSideState(side);
  if (pay) {
    if (rt.getPhase() !== "prep") return;
    if (st.gold < 1) return;
    st.gold -= 1;
    if (side === "player") rt.addGoldSpent(1);
  }
  refreshShopSlotsForSide(side, { isReroll: pay });
  if (pay) rt.playPrepSfx("prep_refresh");
  if (rt.getPhase() === "prep") {
    renderCommerceForMode(side);
    if (typeof rt.renderTdBuildPanel === "function") rt.renderTdBuildPanel();
    rt.updateUI();
  }
}

function toggleShopFreeze(index, side = rt.getPrepViewSide()) {
  if (rt.getPhase() !== "prep" || rt.getGameOver() || !rt.canEditPrepSide(side) || !rt.getSideState(side).shop[index]) return;
  const st = rt.getSideState(side);
  st.shopFrozen[index] = !st.shopFrozen[index];
  const name = typeof resolveShopEntryMeta === "function"
    ? (resolveShopEntryMeta(st.shop[index])?.def?.name || st.shop[index])
    : (ITEM_CATALOG[st.shop[index]]?.name || st.shop[index]);
  rt.log(st.shopFrozen[index] ? `📌 Закреплено: ${name}` : `📌 Снято закрепление: ${name}`);
  rt.playPrepSfx("prep_freeze");
  renderCommerceForMode(side);
}

function commitShopPurchase(index, side = rt.getPrepViewSide()) {
  const st = rt.getSideState(side);
  const entryId = st.shop[index];
  if (!entryId) return null;
  const meta = typeof resolveShopEntryMeta === "function"
    ? resolveShopEntryMeta(entryId)
    : null;
  const def = meta?.def || ITEM_CATALOG[entryId];
  const cost = meta?.cost ?? def?.cost ?? 0;
  const purchasedId = meta?.entryId || entryId;
  if (!def || st.gold < cost) return null;
  st.gold -= cost;
  if (side === "player") rt.addGoldSpent(cost);
  st.shop[index] = null;
  st.shopFrozen[index] = false;
  const isEnhancement = meta?.kind === "enhancement" || !!def.isEnhancementItem;
  if (typeof applyShopBuyMeta === "function" && !isEnhancement) {
    const ctx = getShopContextForSide(side);
    applyShopBuyMeta(side, st.items, purchasedId, st, ctx, (msg) => rt.log(msg));
  }
  return purchasedId;
}

function buyFromShop(index, side = rt.getPrepViewSide()) {
  if (rt.getPhase() !== "prep" || rt.getGameOver() || !rt.canEditPrepSide(side)) return;
  const st = rt.getSideState(side);
  if (!st.shop[index]) return;
  if (st.bench.length >= MAX_BENCH) { rt.log("Скамейка полна!"); return; }
  const itemId = commitShopPurchase(index, side);
  if (!itemId) return;
  st.bench.push({ itemId, uid: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
  rt.playPrepSfx("prep_buy");
  if (side === rt.getPrepViewSide() && typeof CombatLog !== "undefined") {
    CombatLog.notifyPurchase(ITEM_CATALOG[itemId]);
  }
  renderCommerceForMode(side);
  rt.updateUI();
}

/** TD: купить и сразу положить в башню (без скамейки). applyEntry(entry) → true если успех. */
function buyFromShopForTdTower(index, side, applyEntry) {
  if (rt.getPhase() !== "prep" || rt.getGameOver() || !rt.canEditPrepSide(side)) return false;
  const st = rt.getSideState(side);
  const entryId = st.shop[index];
  if (!entryId) return false;
  const def = ITEM_CATALOG[entryId];
  if (!def || st.gold < (def.cost ?? 0)) {
    rt.log("Не хватает золота");
    rt.playPrepSfx("ui_error");
    return false;
  }
  const entry = {
    itemId: entryId,
    uid: `td-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  };
  if (typeof applyEntry !== "function" || !applyEntry(entry)) {
    rt.log("Нет места в башне — выберите другую или освободите слоты");
    rt.playPrepSfx("ui_error");
    return false;
  }
  st.gold -= def.cost;
  if (side === "player") rt.addGoldSpent(def.cost);
  st.shop[index] = null;
  st.shopFrozen[index] = false;
  if (typeof applyShopBuyMeta === "function" && !def.isEnhancementItem) {
    const ctx = getShopContextForSide(side);
    applyShopBuyMeta(side, st.items, entryId, st, ctx, (msg) => rt.log(msg));
  }
  rt.playPrepSfx("prep_buy");
  if (side === rt.getPrepViewSide() && typeof CombatLog !== "undefined") {
    CombatLog.notifyPurchase(ITEM_CATALOG[entryId]);
  }
  renderShop();
  if (typeof rt.renderTdBuildPanel === "function") rt.renderTdBuildPanel();
  rt.updateUI();
  return true;
}

function getSellRefund(itemId, side = rt.getPrepViewSide()) {
  const base = ITEM_CATALOG[itemId]?.cost || 0;
  const mult = typeof getSellBonusMultiplier === "function"
    ? getSellBonusMultiplier(rt.getSideState(side).items)
    : 1;
  return Math.max(0, Math.round(base * mult));
}

function creditItemSale(itemId, side = rt.getPrepViewSide()) {
  if (!itemId) return;
  const refund = getSellRefund(itemId, side);
  rt.getSideState(side).gold += refund;
  rt.playPrepSfx("prep_sell");
  if (side === rt.getPrepViewSide() && typeof CombatLog !== "undefined") {
    CombatLog.notifySell(ITEM_CATALOG[itemId], refund);
  }
}

function sellBenchEntry(index, side = rt.getPrepViewSide()) {
  const st = rt.getSideState(side);
  const entry = st.bench[index];
  if (!entry) return false;
  creditItemSale(entry.itemId, side);
  (entry.carriedItems || []).forEach((ci) => creditItemSale(ci.itemId, side));
  st.bench.splice(index, 1);
  if (side === rt.getPrepViewSide()) {
    const selected = rt.getSelectedBench();
    if (selected === index) rt.setSelectedBench(-1);
    else if (selected > index) rt.setSelectedBench(selected - 1);
  }
  return true;
}

function sellSelected(side = rt.getPrepViewSide()) {
  if (typeof rt.canSellShop === "function" && !rt.canSellShop(side)) return;
  const st = rt.getSideState(side);
  const selected = rt.getSelectedBench();
  if (selected < 0 || !st.bench[selected]) return;
  sellBenchEntry(selected, side);
  renderCommerceForMode(side);
  rt.updateUI();
}

function renderShopPinButton(index, frozen, editable) {
  if (!editable) return "";
  const label = frozen
    ? "Открепить — предмет снова может исчезнуть при обновлении"
    : "Закрепить — оставить в магазине после обновления";
  return `<button type="button" class="shop-pin${frozen ? " active" : ""}" data-pin="${index}" title="${label}" aria-label="${label}" aria-pressed="${frozen ? "true" : "false"}"><span class="shop-pin-glyph" aria-hidden="true">${frozen ? "📌" : "📍"}</span></button>`;
}

function renderShopCostHTML(cost) {
  return `<div class="cost shop-item-cost" aria-label="Цена ${cost}"><span class="cost-value">${cost}</span><span class="cost-coin" aria-hidden="true">💰</span></div>`;
}

function renderShopCardHTML(def, { extraClasses = "", innerBefore = "", dataAttrs = "", shapeSize = "md", showShape = true } = {}) {
  const classes = getRarityCardClasses(def.rarity, ["shop-card", extraClasses].filter(Boolean).join(" "));
  const shapeHtml = showShape
    ? renderItemShapeMiniHTML(def, { size: shapeSize }).replace(
      'class="item-shape-mini',
      'class="item-shape-mini item-shape-mini--shop-overlay',
    )
    : "";
  const rarityColor = getRarityNameColor(def.rarity);
  return `<div class="${classes}"${dataAttrs ? ` ${dataAttrs}` : ""} style="--shop-rarity-color:${rarityColor}">
    <div class="shop-item-main">
      <div class="shop-item-stack">
        ${innerBefore}
        <div class="shop-item-visual">
          <div class="${getItemIconShellClass(def)}">${renderItemIconsHTML(def)}</div>
          ${shapeHtml}
        </div>
        ${renderShopCostHTML(def.cost)}
      </div>
    </div>
  </div>`;
}

function getShopDisplayEntries(side = rt.getPrepViewSide()) {
  const st = rt.getSideState(side);
  return st.shop
    .map((entryId, index) => {
      const meta = typeof resolveShopEntryMeta === "function" ? resolveShopEntryMeta(entryId) : null;
      const cost = meta?.cost ?? (entryId ? (ITEM_CATALOG[entryId]?.cost ?? 0) : -1);
      return { index, entryId, itemId: entryId, cost };
    })
    .sort((a, b) => {
      if (a.cost !== b.cost) return b.cost - a.cost;
      return a.index - b.index;
    });
}

function renderShop(side = rt.getPrepViewSide(), containerEl = null) {
  const el = resolveShopContainer(side, containerEl);
  if (!el) return;
  const st = rt.getSideState(side);
  ensureSideShopArrays(st);
  if (rt.getPhase() === "prep" && !rt.getGameOver()) {
    if (st.shopReadyForRound !== rt.getRound()) resetShopForNewRoundForSide(side);
    else ensureShopHasStock(side);
  }
  const editable = rt.canEditPrepSide(side);
  let html = "";
  try {
    const entries = getShopDisplayEntries(side).filter(({ itemId }) => itemId);
    if (entries.length) {
      html = entries.map(({ itemId, index }) => {
        try {
          const def = ITEM_CATALOG[itemId];
          if (!def) return "";
          if (def.isBuildKey) {
            const frozen = st.shopFrozen[index];
            const affordable = st.gold >= (def.cost ?? 0);
            const pinBtn = renderShopPinButton(index, frozen, editable);
            return renderShopCardHTML(def, {
              extraClasses: ["shop-card--build-key", frozen ? "frozen" : "", affordable || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
              innerBefore: pinBtn,
              shapeSize: "sm",
              showShape: false,
              dataAttrs: `data-index="${index}" data-item-id="${itemId}" data-build-key="1"${affordable || !editable ? "" : ' data-unaffordable="1" title="Недостаточно золота"'}`,
            });
          }
          if (def.isAmplifierItem) {
            const frozen = st.shopFrozen[index];
            const affordable = st.gold >= (def.cost ?? 0);
            const pinBtn = renderShopPinButton(index, frozen, editable);
            return renderShopCardHTML(def, {
              extraClasses: ["shop-card--amplifier", frozen ? "frozen" : "", affordable || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
              innerBefore: pinBtn,
              shapeSize: "sm",
              showShape: false,
              dataAttrs: `data-index="${index}" data-item-id="${itemId}" data-amplifier="1"${affordable || !editable ? "" : ' data-unaffordable="1" title="Недостаточно золота"'}`,
            });
          }
          if (def.isEnhancementItem) {
            const enhDef = typeof getEnhancementDef === "function"
              ? getEnhancementDef(def.enhancementId || itemId)
              : def;
            const frozen = st.shopFrozen[index];
            const affordable = st.gold >= (def.cost ?? 0);
            const pinBtn = renderShopPinButton(index, frozen, editable);
            return renderEnhancementShopCardHTML(enhDef || def, {
              extraClasses: [frozen ? "frozen" : "", affordable || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
              innerBefore: pinBtn,
              dataAttrs: `data-index="${index}" data-item-id="${itemId}" data-enhancement="1"${affordable || !editable ? "" : ' data-unaffordable="1" title="Недостаточно золота"'}`,
            });
          }
          const frozen = st.shopFrozen[index];
          const affordable = st.gold >= (def.cost ?? 0);
          const pinBtn = renderShopPinButton(index, frozen, editable);
          return renderShopCardHTML(def, {
            extraClasses: [frozen ? "frozen" : "", affordable || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
            innerBefore: pinBtn,
            shapeSize: "md",
            dataAttrs: `data-index="${index}" data-item-id="${itemId}"${affordable || !editable ? "" : ' data-unaffordable="1" title="Недостаточно золота"'}`, 
          });
        } catch (itemErr) {
          console.error("renderShop item failed:", itemId, itemErr);
          return "";
        }
      }).filter(Boolean).join("");
    }
  } catch (err) {
    console.error("renderShop failed:", err);
    html = "";
  }
  el.innerHTML = html;
  el.querySelectorAll(".shop-card:not(.empty)").forEach((card) => {
    if (card.dataset.enhancement === "1" && typeof bindEnhancementTooltipEvents === "function") {
      const enhId = typeof getEnhancementIdFromItem === "function"
        ? getEnhancementIdFromItem(card.dataset.itemId)
        : card.dataset.itemId;
      bindEnhancementTooltipEvents(card, enhId, "shop");
      return;
    }
    bindItemTooltipEvents(card, card.dataset.itemId, null, "shop");
  });
  if (!editable) return;
  el.querySelectorAll(".shop-pin").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleShopFreeze(+btn.dataset.pin, side);
    });
  });
  el.querySelectorAll(".shop-card:not(.empty)").forEach((card) => {
    if (!card.dataset.unaffordable) {
      card.addEventListener("mousedown", (e) => {
        if (rt.isSyntheticMouseFromTouch()) return;
        if (e.button !== 0 || e.target.closest(".shop-pin")) return;
        rt.beginPendingShopDrag(+card.dataset.index, e, side);
      });
      card.addEventListener("click", (e) => {
        if (rt.isTouchUi()) return;
        if (Date.now() < rt.getSuppressShopClickUntil()) return;
        if (e.target.closest(".shop-pin") || rt.getShopDidDrag()) {
          rt.setShopDidDrag(false);
          return;
        }
        buyFromShop(+card.dataset.index, side);
      });
    }
  });
  if (typeof refreshGamepadPrepFocus === "function") refreshGamepadPrepFocus();
}

function renderBench(side = rt.getPrepViewSide(), containerEl = null) {
  const el = resolveBenchContainer(side, containerEl);
  if (!el) return;
  const st = rt.getSideState(side);
  el.innerHTML = Array.from({ length: MAX_BENCH }, (_, i) => {
    const b = st.bench[i];
    if (!b) return `<div class="bench-card empty">пусто</div>`;
    const def = ITEM_CATALOG[b.itemId];
    return buildItemCardHTML(def, {
      cardType: "bench-card",
      extraClasses: i === rt.getSelectedBench() ? "selected" : "",
      shapeSize: "sm",
      showShape: false,
      dataAttrs: `data-bench="${i}" data-item-id="${b.itemId}"`,
    });
  }).join("");
  el.querySelectorAll(".bench-card:not(.empty)").forEach((card) => {
    const idx = +card.dataset.bench;
    bindItemTooltipEvents(card, st.bench[idx]?.itemId, null, "bench");
  });
  if (!rt.canEditPrepSide(side)) return;
  el.querySelectorAll(".bench-card:not(.empty)").forEach((card) => {
    const idx = +card.dataset.bench;
    card.addEventListener("mousedown", (e) => {
      if (rt.isSyntheticMouseFromTouch()) return;
      rt.startBenchDrag(idx, e, side);
    });
  });
  if (typeof refreshGamepadPrepFocus === "function") refreshGamepadPrepFocus();
  if (typeof window.syncPrepBenchFabBadge === "function") window.syncPrepBenchFabBadge();
}

window.registerPrepShopRuntime = registerPrepShopRuntime;
window.buyFromShopForTdTower = buyFromShopForTdTower;
window.syncShopHintsVisibility = syncShopHintsVisibility;
