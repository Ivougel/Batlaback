/**
 * TdBuildPanel — Legion TD: постройка, компактный магазин drag→рюкзак.
 */

const TdBuildPanel = (() => {
  let panelEl = null;
  let mainEl = null;
  let shopEl = null;
  let goldEl = null;
  let waveEl = null;
  let onRecruit = null;
  let onSelectSlot = null;
  let onShopDragStart = null;

  const RECRUIT_CLASSES = ["warrior", "rogue", "mage", "priest"];

  const SLOT_SHORT = {
    Юг: "Ю",
    Север: "С",
    Восток: "В",
    Запад: "З",
    Центр: "Ц",
  };

  function init(opts = {}) {
    panelEl = document.getElementById("td-build-panel");
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

  const CLASS_SHORT = {
    warrior: "Воин",
    rogue: "Разб",
    mage: "Маг",
    priest: "Жрец",
  };

  function shortClassLabel(classId, fullName) {
    if (CLASS_SHORT[classId]) return CLASS_SHORT[classId];
    return shortItemLabel(fullName || classId, 5);
  }

  function shortSlotLabel(label) {
    return SLOT_SHORT[label] || label?.[0] || "?";
  }

  function shortItemLabel(name, maxLen = 8) {
    if (!name) return "?";
    const text = String(name).replace(/\s+/g, " ").trim();
    if (text.length <= maxLen) return text;
    const first = text.split(" ")[0];
    if (first.length <= maxLen) return first;
    return `${text.slice(0, maxLen - 1)}…`;
  }

  function renderMain(tdState, gold, selectedSlotId) {
    if (!mainEl) return;
    if (selectedSlotId == null) {
      mainEl.innerHTML = `<p class="td-build-hint">👆 карта</p>`;
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
      const slotTag = shortSlotLabel(slot?.label);
      const classShort = shortClassLabel(tower.classId, cls?.name);
      mainEl.innerHTML = `
        <div class="td-build-tower" title="${cls?.name || tower.classId} · ${slot?.label || "Слот"} · HP ${hp}/${maxHp}">
          <span class="td-build-tower__icon">${cls?.icon || "🛡️"}</span>
          <div class="td-build-tower__body">
            <strong class="td-build-tower__name">${classShort}</strong>
            <span class="td-build-tower__meta">${slotTag} ${hp}/${maxHp} ·${items}</span>
          </div>
        </div>`;
      return;
    }

    let html = `<div class="td-build-units">`;
    RECRUIT_CLASSES.forEach((classId) => {
      const cls = typeof getClassById === "function" ? getClassById(classId) : null;
      const cost = typeof tdGetRecruitCost === "function" ? tdGetRecruitCost(classId) : 30;
      const afford = gold >= cost;
      const name = cls?.name || classId;
      html += `
        <button type="button" class="td-build-unit${afford ? "" : " td-build-unit--disabled"}"
          data-recruit-class="${classId}" ${afford ? "" : "disabled"}
          title="${name} · ${cost}💰">
          <span class="td-build-unit__icon">${cls?.icon || "?"}</span>
          <span class="td-build-unit__cost">${cost}</span>
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
      shopEl.innerHTML = `<p class="td-build-shop-empty">👆 башня</p>`;
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
      const fullName = def.name || entryId;
      const shortName = shortItemLabel(fullName, 5);
      const isBag = !!def.isContainer;
      const bagMark = isBag ? "🎒" : "";
      return `
        <div role="button" tabindex="0"
          class="td-build-shop-card${afford ? "" : " td-build-shop-card--locked"}"
          data-shop-index="${index}"
          data-item-id="${entryId}"
          ${afford ? "" : "aria-disabled=\"true\""}
          title="${fullName}${isBag ? " · сумка" : ""} · ${cost}💰">
          <span class="td-build-shop-card__icon">${def.icon || "📦"}</span>
          <span class="td-build-shop-card__name">${shortName}${bagMark}</span>
          <span class="td-build-shop-card__cost">${cost}</span>
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
    waveEl.textContent = `${wave}/${max}`;
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
    if (goldEl) goldEl.textContent = `${gold}`;
    renderWaveRow(tdState);

    const tower = selectedSlotId != null && typeof tdGetTowerAtSlot === "function"
      ? tdGetTowerAtSlot(tdState, selectedSlotId)
      : null;

    renderMain(tdState, gold, selectedSlotId);
    renderShopGrid(shop, gold, !!tower);
  }

  return { init, setVisible, render };
})();
