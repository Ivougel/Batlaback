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

  return `
    <div class="synergy-tt-title">${title}</div>
    <div class="synergy-tt-row"><span class="synergy-tt-label">Условие:</span> ${synergy.condition || "—"}</div>
    <div class="synergy-tt-row"><span class="synergy-tt-label">Эффект:</span> ${synergy.effect || synergy.bonus || "—"}</div>
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
  el.classList.remove("hidden");
  el.classList.add("synergy-tooltip");
  moveSidebarTooltip(e);
}

function hideSynergyTooltip() {
  const el = document.getElementById("sidebar-tooltip");
  if (!el) return;
  el.classList.remove("synergy-tooltip");
  hideSidebarTooltip();
}
