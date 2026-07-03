/**
 * TdTowerPanel — рекрут героев на слот и экипировка со скамейки.
 */

const TdTowerPanel = (() => {
  let panelEl = null;
  let titleEl = null;
  let bodyEl = null;
  let onRecruit = null;
  let onEquipBench = null;

  const RECRUIT_CLASSES = ["warrior", "rogue", "mage", "priest"];

  function init(opts = {}) {
    panelEl = document.getElementById("td-tower-panel");
    titleEl = document.getElementById("td-tower-panel-title");
    bodyEl = document.getElementById("td-tower-panel-body");
    onRecruit = opts.onRecruit || null;
    onEquipBench = opts.onEquipBench || null;
  }

  function setVisible(visible) {
    if (!panelEl) init();
    if (!panelEl) return;
    panelEl.classList.toggle("hidden", !visible);
    panelEl.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function render(ctx) {
    if (!panelEl) init();
    if (!bodyEl || !titleEl) return;

    const {
      tdState,
      gold = 0,
      bench = [],
      selectedSlotId = null,
    } = ctx || {};

    if (!tdState || selectedSlotId == null) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const slot = (tdState.map?.slots || TD_MAP_SLOTS).find((s) => s.id === selectedSlotId);
    const tower = typeof tdGetTowerAtSlot === "function"
      ? tdGetTowerAtSlot(tdState, selectedSlotId)
      : (tdState.towers || []).find((t) => t.slotId === selectedSlotId && t.alive);

    titleEl.textContent = slot
      ? `Слот: ${slot.label}${tower ? "" : " · пусто"}`
      : "Слот";

    if (tower) {
      const cls = typeof getClassById === "function" ? getClassById(tower.classId) : null;
      const itemCount = tower.items?.length || 0;
      const hp = Math.ceil(tower.hero?.hp || 0);
      const maxHp = tower.hero?.maxHp || 0;
      let html = `
        <div class="td-tower-panel-hero">
          <span class="td-tower-panel-icon">${cls?.icon || "🛡️"}</span>
          <div>
            <strong>${cls?.name || tower.classId}</strong>
            <div class="td-tower-panel-meta">HP ${hp}/${maxHp} · предметов ${itemCount}</div>
          </div>
        </div>
        <p class="td-tower-panel-hint">Купите в магазине → нажмите предмет на скамейке, чтобы положить в рюкзак башни.</p>
      `;

      if (bench.length) {
        html += `<div class="td-tower-bench-list">`;
        bench.forEach((item, idx) => {
          const def = ITEM_CATALOG?.[item.itemId] || {};
          html += `
            <button type="button" class="td-tower-bench-btn" data-bench-idx="${idx}">
              <span>${def.icon || "📦"}</span>
              <span>${def.name || item.itemId}</span>
            </button>`;
        });
        html += `</div>`;
      } else {
        html += `<p class="td-tower-panel-empty">Скамейка пуста — закупитесь в магазине слева.</p>`;
      }

      bodyEl.innerHTML = html;
      bodyEl.querySelectorAll("[data-bench-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.getAttribute("data-bench-idx"));
          if (typeof onEquipBench === "function") onEquipBench(idx);
        });
      });
      return;
    }

    let html = `<p class="td-tower-panel-hint">Нанять героя на этот слот:</p><div class="td-tower-recruit-grid">`;
    RECRUIT_CLASSES.forEach((classId) => {
      const cls = typeof getClassById === "function" ? getClassById(classId) : null;
      const cost = typeof tdGetRecruitCost === "function" ? tdGetRecruitCost(classId) : 30;
      const afford = gold >= cost;
      html += `
        <button type="button" class="td-tower-recruit-btn${afford ? "" : " td-tower-recruit-btn--disabled"}"
          data-recruit-class="${classId}" ${afford ? "" : "disabled"}>
          <span class="td-tower-recruit-icon">${cls?.icon || "?"}</span>
          <span class="td-tower-recruit-name">${cls?.name || classId}</span>
          <span class="td-tower-recruit-cost">${cost}💰</span>
        </button>`;
    });
    html += `</div>`;
    bodyEl.innerHTML = html;

    bodyEl.querySelectorAll("[data-recruit-class]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const classId = btn.getAttribute("data-recruit-class");
        if (typeof onRecruit === "function") onRecruit(classId);
      });
    });
  }

  return { init, setVisible, render };
})();
