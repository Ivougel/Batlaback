/**
 * Панель активных синергий — только иконки предметов, детали в tooltip.
 */

function buildSynergyChipLabel(synergy) {
  return (synergy.icons || []).join("");
}

function buildSynergyTooltipHtml(synergy) {
  const title = (synergy.names || []).join(" + ");
  const sources = (synergy.icons || []).map((icon, i) =>
    `<div class="synergy-tt-source">${icon} ${synergy.names[i]}</div>`,
  ).join("");
  const fmt = typeof formatTooltipMechanicText === "function"
    ? formatTooltipMechanicText
    : (text) => String(text ?? "—");
  const condition = synergy.condition || "—";
  const effect = synergy.effect || synergy.bonus || "—";

  return `
    <div class="synergy-tt-title">${title}</div>
    <div class="synergy-tt-row"><span class="synergy-tt-label">Условие:</span> ${fmt(condition)}</div>
    <div class="synergy-tt-row"><span class="synergy-tt-label">Эффект:</span> ${fmt(effect)}</div>
    <div class="synergy-tt-sources">
      <div class="synergy-tt-label">Источник:</div>
      ${sources}
    </div>
  `;
}

function showSynergyTooltip(e, synergy) {
  const el = document.getElementById("sidebar-tooltip");
  if (!el || !synergy) return;
  el.innerHTML = buildSynergyTooltipHtml(synergy);
  el.classList.remove("hidden", "sidebar-tooltip--card");
  el.classList.add("synergy-tooltip");
  if (typeof syncPrepTooltipDockVisibility === "function") syncPrepTooltipDockVisibility();
  moveSidebarTooltip(e);
}

function hideSynergyTooltip() {
  const el = document.getElementById("sidebar-tooltip");
  if (!el) return;
  el.classList.remove("synergy-tooltip");
  hideSidebarTooltip();
}
