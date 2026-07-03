/**
 * TdBuildPanel — Legion TD: слоты, постройка, магазин с drag→рюкзак.
 */

const TdBuildPanel = (() => {
  let panelEl = null;
  let slotsEl = null;
  let mainEl = null;
  let shopEl = null;
  let goldEl = null;
  let waveEl = null;
  let onRecruit = null;
  let onSelectSlot = null;
  let onShopDragStart = null;

  const RECRUIT_CLASSES = ["warrior", "rogue", "mage", "priest"];

  function init(opts = {}) {
    panelEl = document.getElementById("td-build-panel");
    slotsEl = document.getElementById("td-build-slots");
    mainEl = document.getElementById("td-build-main");
    shopEl = document.getElementById("td-build-shop");
    goldEl = document.getElementById("td-build-gold");
    waveEl = document.getElementById("td-build-wave");
    onRecruit = opts.onRecruit || null;
    onSelectSlot = opts.onSelectSlot || null;
    onShopDragStart = opts.onShopDragStart || null;
  }

  function setVisible(visible) {
    if (!panelEl) init();
    if (!panelEl) return;
    panelEl.classList.toggle("hidden", !visible);
    panelEl.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function renderSlotRow(tdState, selectedSlotId) {
    if (!slotsEl) return;
    const slots = tdState?.map?.slots || TD_MAP_SLOTS || [];
    slotsEl.innerHTML = slots.map((slot) => {
      const tower = typeof tdGetTowerAtSlot === "function"
        ? tdGetTowerAtSlot(tdState, slot.id)
        : (tdState?.towers || []).find((t) => t.slotId === slot.id && t.alive);
      const selected = slot.id === selectedSlotId;
      const cls = tower && typeof getClassById === "function" ? getClassById(tower.classId) : null;
      const icon = tower ? (cls?.icon || "🛡️") : "+";
      const hp = tower ? Math.ceil(tower.hero?.hp || 0) : 0;
      const maxHp = tower?.hero?.maxHp || 0;
      return `
        <button type="button"
          class="td-build-slot${selected ? " td-build-slot--selected" : ""}${tower ? " td-build-slot--built" : ""}"
          data-slot-id="${slot.id}"
          title="${slot.label}${tower ? ` · ${cls?.name || ""} ${hp}/${maxHp}` : " · пусто"}">
          <span class="td-build-slot__icon" aria-hidden="true">${icon}</span>
          <span class="td-build-slot__label">${slot.label}</span>
        </button>`;
    }).join("");

    slotsEl.querySelectorAll("[data-slot-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-slot-id"));
        if (typeof onSelectSlot === "function") onSelectSlot(id);
      });
    });
  }

  function renderMain(tdState, gold, selectedSlotId) {
    if (!mainEl) return;
    if (selectedSlotId == null) {
      mainEl.innerHTML = `<p class="td-build-hint">👆 Кликните слот на карте или кнопку выше</p>`;
      return;
    }

    const slot = (tdState?.map?.slots || TD_MAP_SLOTS).find((s) => s.id === selectedSlotId);
    const tower = typeof tdGetTowerAtSlot === "function"
      ? tdGetTowerAtSlot(tdState, selectedSlotId)
      : null;

    if (tower) {
      const cls = typeof getClassById === "function" ? getClassById(tower.classId) : null;
      const hp = Math.ceil(tower.hero?.hp || 0);
      const maxHp = tower.hero?.maxHp || 0;
      const items = tower.items?.length || 0;
      mainEl.innerHTML = `
        <div class="td-build-tower">
          <span class="td-build-tower__icon">${cls?.icon || "🛡️"}</span>
          <div class="td-build-tower__body">
            <strong>${cls?.name || tower.classId}</strong>
            <span class="td-build-tower__meta">${slot?.label || "Слот"} · HP ${hp}/${maxHp} · 📦 ${items}</span>
          </div>
        </div>
        <p class="td-build-hint td-build-hint--compact">🎒 Рюкзак 6×6 под картой. Из магазина — <b>перетащите дугой</b> (сумки тоже). ZR — поворот.</p>`;
      return;
    }

    let html = `<p class="td-build-hint">Построить на «${slot?.label || "слот"}»:</p><div class="td-build-units">`;
    RECRUIT_CLASSES.forEach((classId) => {
      const cls = typeof getClassById === "function" ? getClassById(classId) : null;
      const cost = typeof tdGetRecruitCost === "function" ? tdGetRecruitCost(classId) : 30;
      const afford = gold >= cost;
      html += `
        <button type="button" class="td-build-unit${afford ? "" : " td-build-unit--disabled"}"
          data-recruit-class="${classId}" ${afford ? "" : "disabled"}>
          <span class="td-build-unit__icon">${cls?.icon || "?"}</span>
          <span class="td-build-unit__name">${cls?.name || classId}</span>
          <span class="td-build-unit__cost">${cost}💰</span>
        </button>`;
    });
    html += `</div>`;
    mainEl.innerHTML = html;

    mainEl.querySelectorAll("[data-recruit-class]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const classId = btn.getAttribute("data-recruit-class");
        if (typeof onRecruit === "function") onRecruit(classId);
      });
    });
  }

  function renderShopGrid(shop, gold, hasTower) {
    if (!shopEl) return;
    const slots = shop || [];
    if (!hasTower) {
      shopEl.innerHTML = `<p class="td-build-shop-empty">Постройте или выберите башню — затем тащите предметы в рюкзак.</p>`;
      return;
    }

    shopEl.innerHTML = slots.map((entryId, index) => {
      if (!entryId) {
        return `<div class="td-build-shop-card td-build-shop-card--empty" aria-hidden="true"></div>`;
      }
      const meta = typeof resolveShopEntryMeta === "function"
        ? resolveShopEntryMeta(entryId)
        : { def: ITEM_CATALOG[entryId] || {}, cost: ITEM_CATALOG[entryId]?.cost ?? 0 };
      const def = meta.def || ITEM_CATALOG[entryId] || {};
      const cost = meta.cost ?? def.cost ?? 0;
      const afford = gold >= cost;
      const isBag = !!def.isContainer;
      return `
        <div role="button" tabindex="0"
          class="td-build-shop-card${afford ? "" : " td-build-shop-card--locked"}"
          data-shop-index="${index}"
          data-item-id="${entryId}"
          ${afford ? "" : "aria-disabled=\"true\""}
          title="${def.name || entryId} · ${cost}💰 · перетащите на рюкзак">
          <span class="td-build-shop-card__icon">${def.icon || "📦"}</span>
          <span class="td-build-shop-card__name">${def.name || entryId}${isBag ? " 🎒" : ""}</span>
          <span class="td-build-shop-card__cost">${cost}💰</span>
        </div>`;
    }).join("");

    shopEl.querySelectorAll("[data-shop-index]").forEach((card) => {
      if (card.classList.contains("td-build-shop-card--locked")) return;
      card.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const idx = Number(card.getAttribute("data-shop-index"));
        if (typeof onShopDragStart === "function") onShopDragStart(idx, e);
      });
    });
  }

  function renderWaveRow(tdState) {
    if (!waveEl || !tdState) return;
    const wave = tdState.wave || 1;
    const max = typeof TD_MAX_WAVES === "number" ? TD_MAX_WAVES : 99;
    const killed = tdState.pigsKilled || 0;
    const total = tdState.totalPigs || 0;
    waveEl.textContent = `🌊 ${wave}/${max} · 🐷 ${killed}/${total}`;
  }

  function render(ctx) {
    if (!panelEl) init();
    if (!panelEl) return;

    const {
      tdState,
      gold = 0,
      shop = [],
      selectedSlotId = null,
    } = ctx || {};

    if (!tdState) {
      setVisible(false);
      return;
    }

    setVisible(true);
    if (goldEl) goldEl.textContent = `${gold} 💰`;
    renderWaveRow(tdState);

    const tower = selectedSlotId != null && typeof tdGetTowerAtSlot === "function"
      ? tdGetTowerAtSlot(tdState, selectedSlotId)
      : null;

    renderSlotRow(tdState, selectedSlotId);
    renderMain(tdState, gold, selectedSlotId);
    renderShopGrid(shop, gold, !!tower);
  }

  return { init, setVisible, render };
})();
