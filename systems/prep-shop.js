// Transpiled from TypeScript — npm run compile:ts

const MAX_BENCH = 6;
function getMaxShopSlots() {
  return typeof getPrepShopSlotCount === "function" ? getPrepShopSlotCount() : 5;
}
let rt;
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
    hasUniqueInLoadout: typeof loadoutHasUniqueItem === "function" ? loadoutHasUniqueItem(loadoutItems) : false,
    shopModifiers: typeof collectShopPoolModifiers === "function" ? collectShopPoolModifiers(loadoutItems) : null,
    bonusUniqueGranted: rt.getSideState(side).bonusUniqueGranted,
    companionId: typeof rt.getSideCompanionId === "function" ? rt.getSideCompanionId(side) : null,
    mutationId: typeof rt.getSideMutationId === "function" ? rt.getSideMutationId(side) : null,
    mutationFormId: typeof rt.getSideMutationFormId === "function" ? rt.getSideMutationFormId(side) : null,
    unlockedBuilds: typeof collectUnlockedBuilds === "function" ? collectUnlockedBuilds(loadoutItems) : /* @__PURE__ */ new Set(),
    applyMetaUnlockFilter: typeof rt.shouldApplyMetaUnlockForSide === "function" ? rt.shouldApplyMetaUnlockForSide(side) : false
  };
}
function getShopContext() {
  return getShopContextForSide("player");
}
function ensureSideShopArrays(st) {
  const maxShop = getMaxShopSlots();
  if (st.shop.length !== maxShop) st.shop.length = maxShop;
  if (st.shopFrozen.length !== maxShop) st.shopFrozen.length = maxShop;
  for (let i = 0; i < maxShop; i++) {
    if (st.shop[i] === void 0) st.shop[i] = null;
    if (st.shopFrozen[i] === void 0) st.shopFrozen[i] = false;
  }
}
function isLobby2pSplitPrep() {
  return typeof rt.isLobby2pSplitPrep === "function" && rt.isLobby2pSplitPrep();
}
function resolveShopContainer(side, containerEl) {
  if (containerEl) return containerEl;
  return document.getElementById("shop-slots");
}
function resolveBenchContainer(side, containerEl) {
  if (containerEl) return containerEl;
  if (isLobby2pSplitPrep()) {
    if (typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen()) {
      return document.getElementById("bench-slots");
    }
    return null;
  }
  return document.getElementById("bench-slots");
}
function renderCommerceForMode(affectedSide) {
  if (isLobby2pSplitPrep()) {
    const shopOpen = typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen();
    if (shopOpen) {
      renderShop(rt.getPrepViewSide(), document.getElementById("shop-slots"));
    }
    const benchOpen = typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen();
    if (benchOpen) {
      renderBench(rt.getPrepViewSide(), document.getElementById("bench-slots"));
    }
    if (typeof window.syncLobby2pBenchFabBadges === "function") window.syncLobby2pBenchFabBadges();
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
  const maxShop = getMaxShopSlots();
  const unfrozen = [];
  for (let i = 0; i < maxShop; i++) {
    if (st.shopFrozen[i] && st.shop[i]) continue;
    unfrozen.push(i);
  }
  if (!unfrozen.length) return [];
  const rolled = rollShopBatch(unfrozen.length, ctx);
  if ((ctx.shopModifiers?.bonusUnique ?? 0) > 0 && ctx.bonusUniqueGranted) {
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
}
function shouldHideShopHints() {
  const root = document.documentElement;
  return root.dataset.uiSurface === "tablet-side" || root.dataset.prepLayout === "side" && root.dataset.touch === "true";
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
  const entryId = st.shop[index];
  const name = typeof resolveShopEntryMeta === "function" ? resolveShopEntryMeta(entryId ?? "")?.def?.name || entryId : ITEM_CATALOG[entryId ?? ""]?.name || entryId;
  rt.log(st.shopFrozen[index] ? `\u{1F4CC} \u0417\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E: ${name}` : `\u{1F4CC} \u0421\u043D\u044F\u0442\u043E \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0435: ${name}`);
  rt.playPrepSfx("prep_freeze");
  renderCommerceForMode(side);
}
function commitShopPurchase(index, side = rt.getPrepViewSide()) {
  const st = rt.getSideState(side);
  const entryId = st.shop[index];
  if (!entryId) return null;
  const meta = typeof resolveShopEntryMeta === "function" ? resolveShopEntryMeta(entryId) : null;
  const def = meta?.def || ITEM_CATALOG[entryId];
  const cost = meta?.cost ?? def?.cost ?? 0;
  const purchasedId = meta?.entryId || entryId;
  if (!def || st.gold < cost) return null;
  st.gold -= cost;
  if (side === "player") rt.addGoldSpent(cost);
  st.shop[index] = null;
  st.shopFrozen[index] = false;
  if (typeof applyShopBuyMeta === "function") {
    const ctx = getShopContextForSide(side);
    applyShopBuyMeta(side, st.items, purchasedId, st, ctx, (msg) => rt.log(msg));
  }
  if (rt.getPhase() === "prep" && !rt.getGameOver()) {
    const dragActive = typeof rt.isPrepCommerceDragActive === "function" && rt.isPrepCommerceDragActive();
    if (!dragActive) renderShop(side);
  }
  return purchasedId;
}
function buyFromShop(index, side = rt.getPrepViewSide()) {
  if (rt.getPhase() !== "prep" || rt.getGameOver() || !rt.canEditPrepSide(side)) return;
  const st = rt.getSideState(side);
  if (!st.shop[index]) return;
  if (st.bench.length >= MAX_BENCH) {
    rt.log("\u0421\u043A\u0430\u043C\u0435\u0439\u043A\u0430 \u043F\u043E\u043B\u043D\u0430!");
    return;
  }
  const itemId = commitShopPurchase(index, side);
  if (!itemId) return;
  st.bench.push({ itemId, uid: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
  rt.playPrepSfx("prep_buy");
  const boughtDef = ITEM_CATALOG[itemId];
  if (typeof playPrepBuyFanfare === "function") playPrepBuyFanfare(boughtDef);
  if (side === rt.getPrepViewSide() && typeof CombatLog !== "undefined") {
    CombatLog.notifyPurchase(ITEM_CATALOG[itemId]);
  }
  renderCommerceForMode(side);
  rt.updateUI();
}
function buyFromShopForTdTower(index, side, applyEntry) {
  if (rt.getPhase() !== "prep" || rt.getGameOver() || !rt.canEditPrepSide(side)) return false;
  const st = rt.getSideState(side);
  const entryId = st.shop[index];
  if (!entryId) return false;
  const def = ITEM_CATALOG[entryId];
  if (!def || st.gold < (def.cost ?? 0)) {
    rt.log("\u041D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u0437\u043E\u043B\u043E\u0442\u0430");
    rt.playPrepSfx("ui_error");
    return false;
  }
  const entry = {
    itemId: entryId,
    uid: `td-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
  };
  if (typeof applyEntry !== "function" || !applyEntry(entry)) {
    rt.log("\u041D\u0435\u0442 \u043C\u0435\u0441\u0442\u0430 \u0432 \u0431\u0430\u0448\u043D\u0435 \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044E \u0438\u043B\u0438 \u043E\u0441\u0432\u043E\u0431\u043E\u0434\u0438\u0442\u0435 \u0441\u043B\u043E\u0442\u044B");
    rt.playPrepSfx("ui_error");
    return false;
  }
  st.gold -= def.cost;
  if (side === "player") rt.addGoldSpent(def.cost);
  st.shop[index] = null;
  st.shopFrozen[index] = false;
  if (typeof applyShopBuyMeta === "function") {
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
  const mult = typeof getSellBonusMultiplier === "function" ? getSellBonusMultiplier(rt.getSideState(side).items) : 1;
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
  const label = frozen ? "\u041E\u0442\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u2014 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0441\u043D\u043E\u0432\u0430 \u043C\u043E\u0436\u0435\u0442 \u0438\u0441\u0447\u0435\u0437\u043D\u0443\u0442\u044C \u043F\u0440\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0438" : "\u0417\u0430\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u2014 \u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435 \u043F\u043E\u0441\u043B\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F";
  return `<button type="button" class="shop-pin${frozen ? " active" : ""}" data-pin="${index}" title="${label}" aria-label="${label}" aria-pressed="${frozen ? "true" : "false"}"><span class="shop-pin-glyph" aria-hidden="true">${frozen ? "\u{1F4CC}" : "\u{1F4CD}"}</span></button>`;
}
function renderShopCostHTML(cost) {
  return `<div class="cost shop-item-cost" aria-label="\u0426\u0435\u043D\u0430 ${cost}"><span class="cost-value">${cost}</span><span class="cost-coin" aria-hidden="true">\u{1F4B0}</span></div>`;
}
function renderShopCardHTML(def, {
  extraClasses = "",
  innerBefore = "",
  dataAttrs = "",
  shapeSize = "md",
  showShape = true,
  trackItemId = null
} = {}) {
  const trackId = trackItemId || def?.id || "";
  const trackClass = typeof getShopCardTrackExtraClasses === "function" ? getShopCardTrackExtraClasses(trackId) : "";
  const trackBadge = typeof renderShopTrackBadge === "function" ? renderShopTrackBadge(trackId) : "";
  const classes = getRarityCardClasses(def.rarity ?? "common", ["shop-card", extraClasses, trackClass].filter(Boolean).join(" "));
  const shapeHtml = showShape ? renderItemShapeMiniHTML(def, { size: shapeSize }).replace(
    'class="item-shape-mini',
    'class="item-shape-mini item-shape-mini--shop-overlay'
  ) : "";
  const rarityColor = getRarityNameColor(def.rarity ?? "common");
  return `<div class="${classes}"${dataAttrs ? ` ${dataAttrs}` : ""} style="--shop-rarity-color:${rarityColor};--item-rarity-color:${rarityColor}">
    <div class="shop-item-main">
      <div class="shop-item-stack">
        ${trackBadge}${innerBefore}
        <div class="shop-item-hero">
          <div class="shop-item-visual">
            <div class="${getItemIconShellClass(def)}">${renderItemIconsHTML(def)}</div>
          </div>
          ${shapeHtml}
        </div>
        ${renderShopCostHTML(def.cost ?? 0)}
      </div>
    </div>
  </div>`;
}
function getShopDisplayEntries(side = rt.getPrepViewSide()) {
  const st = rt.getSideState(side);
  return st.shop.map((entryId, index) => {
    const meta = entryId && typeof resolveShopEntryMeta === "function" ? resolveShopEntryMeta(entryId) : null;
    const cost = meta?.cost ?? (entryId ? ITEM_CATALOG[entryId]?.cost ?? 0 : -1);
    return { index, entryId, itemId: entryId, cost };
  }).sort((a, b) => {
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
  }
  const editable = rt.canEditPrepSide(side);
  let html = "";
  try {
    const entries = getShopDisplayEntries(side).filter((entry) => Boolean(entry.itemId));
    if (entries.length) {
      html = entries.map(({ itemId, index }) => {
        try {
          const def = ITEM_CATALOG[itemId];
          if (!def) return "";
          if (def.isBuildKey) {
            const frozen2 = st.shopFrozen[index];
            const affordable2 = st.gold >= (def.cost ?? 0);
            const pinBtn2 = renderShopPinButton(index, frozen2, editable);
            return renderShopCardHTML(def, {
              extraClasses: ["shop-card--build-key", frozen2 ? "frozen" : "", affordable2 || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
              innerBefore: pinBtn2,
              shapeSize: "sm",
              showShape: false,
              trackItemId: itemId,
              dataAttrs: `data-index="${index}" data-item-id="${itemId}" data-build-key="1"${affordable2 || !editable ? "" : ' data-unaffordable="1" title="\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0437\u043E\u043B\u043E\u0442\u0430"'}`
            });
          }
          if (def.isAmplifierItem) {
            const frozen2 = st.shopFrozen[index];
            const affordable2 = st.gold >= (def.cost ?? 0);
            const pinBtn2 = renderShopPinButton(index, frozen2, editable);
            return renderShopCardHTML(def, {
              extraClasses: ["shop-card--amplifier", frozen2 ? "frozen" : "", affordable2 || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
              innerBefore: pinBtn2,
              shapeSize: "sm",
              showShape: false,
              trackItemId: itemId,
              dataAttrs: `data-index="${index}" data-item-id="${itemId}" data-amplifier="1"${affordable2 || !editable ? "" : ' data-unaffordable="1" title="\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0437\u043E\u043B\u043E\u0442\u0430"'}`
            });
          }
          const frozen = st.shopFrozen[index];
          const affordable = st.gold >= (def.cost ?? 0);
          const pinBtn = renderShopPinButton(index, frozen, editable);
          return renderShopCardHTML(def, {
            extraClasses: [frozen ? "frozen" : "", affordable || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
            innerBefore: pinBtn,
            shapeSize: "md",
            trackItemId: itemId,
            dataAttrs: `data-index="${index}" data-item-id="${itemId}"${affordable || !editable ? "" : ' data-unaffordable="1" title="\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0437\u043E\u043B\u043E\u0442\u0430"'}`
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
    bindItemTooltipEvents(card, card.dataset.itemId ?? "", null, "shop");
  });
  if (!editable) return;
  el.querySelectorAll(".shop-pin").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleShopFreeze(+btn.dataset.pin, side);
    });
  });
  if (typeof syncBuildTrackShopBar === "function") syncBuildTrackShopBar();
  el.querySelectorAll(".shop-card:not(.empty)").forEach((card) => {
    const htmlCard = card;
    if (!htmlCard.dataset.unaffordable) {
      htmlCard.addEventListener("mousedown", (e) => {
        const me = e;
        if (rt.isSyntheticMouseFromTouch()) return;
        if (me.button !== 0 || me.target.closest(".shop-pin")) return;
        rt.beginPendingShopDrag(+htmlCard.dataset.index, me, side);
      });
      htmlCard.addEventListener("click", (e) => {
        const me = e;
        const popoverTapBuy = document.documentElement.dataset.prepShopPopover === "true";
        if (rt.isTouchUi() && !popoverTapBuy) return;
        if (Date.now() < rt.getSuppressShopClickUntil()) return;
        if (e.target.closest(".shop-pin") || rt.getShopDidDrag()) {
          rt.setShopDidDrag(false);
          return;
        }
        buyFromShop(+htmlCard.dataset.index, side);
      });
    }
  });
  if (typeof refreshGamepadPrepFocus === "function") refreshGamepadPrepFocus();
  if (typeof restoreDomSparkleFromTooltipSource === "function") restoreDomSparkleFromTooltipSource();
}
function renderBench(side = rt.getPrepViewSide(), containerEl = null) {
  const el = resolveBenchContainer(side, containerEl);
  if (!el) return;
  const st = rt.getSideState(side);
  el.innerHTML = Array.from({ length: MAX_BENCH }, (_, i) => {
    const b = st.bench[i];
    if (!b) return `<div class="bench-card empty">\u043F\u0443\u0441\u0442\u043E</div>`;
    const def = ITEM_CATALOG[b.itemId];
    if (!def) return `<div class="bench-card empty">\u043F\u0443\u0441\u0442\u043E</div>`;
    return buildItemCardHTML(def, {
      cardType: "bench-card",
      extraClasses: i === rt.getSelectedBench() ? "selected" : "",
      shapeSize: "sm",
      showShape: false,
      dataAttrs: `data-bench="${i}" data-item-id="${b.itemId}"`
    });
  }).join("");
  el.querySelectorAll(".bench-card:not(.empty)").forEach((card) => {
    const idx = +card.dataset.bench;
    bindItemTooltipEvents(card, st.bench[idx]?.itemId ?? "", null, "bench");
  });
  if (!rt.canEditPrepSide(side)) return;
  el.querySelectorAll(".bench-card:not(.empty)").forEach((card) => {
    const idx = +card.dataset.bench;
    card.addEventListener("mousedown", (e) => {
      const me = e;
      if (rt.isSyntheticMouseFromTouch()) return;
      if (me.button !== 0) return;
      rt.beginPendingBenchDrag(idx, me, side);
    });
  });
  if (typeof refreshGamepadPrepFocus === "function") refreshGamepadPrepFocus();
  if (typeof window.syncPrepBenchFabBadge === "function") window.syncPrepBenchFabBadge();
  if (typeof restoreDomSparkleFromTooltipSource === "function") restoreDomSparkleFromTooltipSource();
}
window.registerPrepShopRuntime = registerPrepShopRuntime;
window.buyFromShopForTdTower = buyFromShopForTdTower;
window.syncShopHintsVisibility = syncShopHintsVisibility;
