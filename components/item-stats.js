/**
 * Карточки вклада предметов — горизонтальные DPS-метры (полная ширина).
 */

function maxStat(items, key) {
  return items.reduce((m, s) => Math.max(m, s[key] || 0), 0);
}

function getItemBlockValue(stat) {
  return stat.damageBlocked || stat.blockDone || 0;
}

function renderMeterBar(value, max, type, { hero = false, sharePct = null } = {}) {
  const v = Number(value) || 0;
  if (v <= 0) {
    return `<div class="is-meter is-meter-${type} is-meter-empty${hero ? " is-meter-hero" : ""}"><span class="is-meter-val">—</span></div>`;
  }
  const pct = max > 0 ? Math.max(6, Math.round((v / max) * 100)) : 0;
  const shareHtml = sharePct != null && sharePct > 0
    ? `<span class="is-share-pct">${sharePct}%</span>`
    : "";
  return `<div class="is-meter is-meter-${type}${hero ? " is-meter-hero" : ""}">
    <div class="is-meter-track"><div class="is-meter-fill" style="width:${pct}%"></div></div>
    <span class="is-meter-val">${formatStatNumber(v)}</span>${shareHtml}
  </div>`;
}

function sumItemStats(items) {
  return items.reduce(
    (acc, stat) => {
      acc.damageDealt += stat.damageDealt || 0;
      acc.physicalDamageDealt += stat.physicalDamageDealt || 0;
      acc.magicDamageDealt += stat.magicDamageDealt || 0;
      acc.healingDone += stat.healingDone || 0;
      acc.block += getItemBlockValue(stat);
      acc.poisonApplied += stat.poisonApplied || 0;
      acc.activations += stat.activations || 0;
      return acc;
    },
    {
      damageDealt: 0,
      physicalDamageDealt: 0,
      magicDamageDealt: 0,
      healingDone: 0,
      block: 0,
      poisonApplied: 0,
      activations: 0,
    },
  );
}

function getDamageSharePct(value, teamTotal) {
  const v = Number(value) || 0;
  const t = Number(teamTotal) || 0;
  if (v <= 0 || t <= 0) return null;
  return Math.round((v / t) * 100);
}

function buildVisibleMetricColumns(totals) {
  const cols = [
    { id: "dmg", label: "⚔ Всего", type: "dmg", hero: true },
  ];
  if (totals.physicalDamageDealt > 0) cols.push({ id: "phys", label: "🗡 Физ", type: "phys" });
  if (totals.magicDamageDealt > 0) cols.push({ id: "magic", label: "✨ Маг", type: "magic" });
  if (totals.healingDone > 0) cols.push({ id: "heal", label: "❤ Лечение", type: "heal" });
  if (totals.block > 0) cols.push({ id: "block", label: "🛡 Блок", type: "block" });
  if (totals.poisonApplied > 0) cols.push({ id: "poison", label: "☠ Яд", type: "poison" });
  if (totals.activations > 0) cols.push({ id: "atk", label: "🔄", type: "atk", isAtk: true });
  return cols;
}

function getMetricValue(stat, colId) {
  switch (colId) {
    case "dmg": return stat.damageDealt || 0;
    case "phys": return stat.physicalDamageDealt || 0;
    case "magic": return stat.magicDamageDealt || 0;
    case "heal": return stat.healingDone || 0;
    case "block": return getItemBlockValue(stat);
    case "poison": return stat.poisonApplied || 0;
    case "atk": return stat.activations || 0;
    default: return 0;
  }
}

function getMetricMax(sorted, colId) {
  switch (colId) {
    case "dmg": return maxStat(sorted, "damageDealt");
    case "phys": return maxStat(sorted, "physicalDamageDealt");
    case "magic": return maxStat(sorted, "magicDamageDealt");
    case "heal": return maxStat(sorted, "healingDone");
    case "block": return sorted.reduce((m, s) => Math.max(m, getItemBlockValue(s)), 0);
    case "poison": return maxStat(sorted, "poisonApplied");
    default: return 0;
  }
}

function getTotalMetricValue(totals, colId) {
  switch (colId) {
    case "dmg": return totals.damageDealt;
    case "phys": return totals.physicalDamageDealt;
    case "magic": return totals.magicDamageDealt;
    case "heal": return totals.healingDone;
    case "block": return totals.block;
    case "poison": return totals.poisonApplied;
    case "atk": return totals.activations;
    default: return 0;
  }
}

function renderTeamSummaryChips(totals) {
  const chips = [];
  if (totals.damageDealt > 0) {
    chips.push(`<span class="is-summary-chip is-chip-dmg"><span class="is-chip-icon">⚔</span><span class="is-chip-label">Урон</span><span class="is-chip-val">${formatStatNumber(totals.damageDealt)}</span></span>`);
    if (totals.physicalDamageDealt > 0) {
      chips.push(`<span class="is-summary-chip is-chip-phys"><span class="is-chip-icon">🗡</span><span class="is-chip-val">${formatStatNumber(totals.physicalDamageDealt)}</span></span>`);
    }
    if (totals.magicDamageDealt > 0) {
      chips.push(`<span class="is-summary-chip is-chip-magic"><span class="is-chip-icon">✨</span><span class="is-chip-val">${formatStatNumber(totals.magicDamageDealt)}</span></span>`);
    }
  }
  if (totals.healingDone > 0) {
    chips.push(`<span class="is-summary-chip is-chip-heal"><span class="is-chip-icon">❤</span><span class="is-chip-label">Лечение</span><span class="is-chip-val">${formatStatNumber(totals.healingDone)}</span></span>`);
  }
  if (totals.block > 0) {
    chips.push(`<span class="is-summary-chip is-chip-block"><span class="is-chip-icon">🛡</span><span class="is-chip-label">Блок</span><span class="is-chip-val">${formatStatNumber(totals.block)}</span></span>`);
  }
  if (totals.poisonApplied > 0) {
    chips.push(`<span class="is-summary-chip is-chip-poison"><span class="is-chip-icon">☠</span><span class="is-chip-val">${formatStatNumber(totals.poisonApplied)}</span></span>`);
  }
  if (!chips.length) return "";
  return `<div class="is-team-summary">${chips.join("")}</div>`;
}

function renderItemMeterRow(stat, columns, maxByCol, teamTotalDmg) {
  const cells = columns.map((col) => {
    if (col.isAtk) {
      const atk = stat.activations || 0;
      return `<td class="is-atk-cell">${atk > 0 ? `<span class="is-atk">${atk}</span>` : `<span class="is-atk is-muted">—</span>`}</td>`;
    }
    const val = getMetricValue(stat, col.id);
    const sharePct = col.id === "dmg" ? getDamageSharePct(val, teamTotalDmg) : null;
    return `<td class="${col.hero ? "is-col-hero" : "is-col-meter"}">${renderMeterBar(val, maxByCol[col.id], col.type, { hero: col.hero, sharePct })}</td>`;
  });

  return `<tr>
    <td class="is-item-cell">
      <span class="is-icon">${stat.icon}</span>
      <span class="is-name">${stat.name}</span>
    </td>
    ${cells.join("")}
  </tr>`;
}

function renderItemStatsTotalRow(totals, columns) {
  const fmt = (value) => (value > 0 ? formatStatNumber(value) : "—");
  const cells = columns.map((col) => {
    if (col.isAtk) {
      return `<td class="is-atk-cell is-total-val">${totals.activations > 0 ? totals.activations : "—"}</td>`;
    }
    return `<td class="is-total-val">${fmt(getTotalMetricValue(totals, col.id))}</td>`;
  });

  return `<tr class="is-total-row">
    <td class="is-item-cell"><span class="is-name">Итого</span></td>
    ${cells.join("")}
  </tr>`;
}

function renderItemMeterTable(items, teamLabel, { showBoardButton = false, boardTeam = null } = {}) {
  const boardBtn = showBoardButton && boardTeam
    ? `<button type="button" class="btn-secondary btn-show-board" data-board-team="${boardTeam}">Показать стол</button>`
    : "";

  if (!items.length) {
    return `<div class="is-team">
      <div class="is-team-head">
        <div class="is-team-label">${teamLabel}</div>
        ${boardBtn}
      </div>
      <div class="is-empty">Нет данных по вкладу предметов</div>
    </div>`;
  }

  const sorted = sortItemStatsForDisplay(items);
  const totals = sumItemStats(sorted);
  const columns = buildVisibleMetricColumns(totals);
  const maxByCol = Object.fromEntries(
    columns.filter((c) => !c.isAtk).map((c) => [c.id, getMetricMax(sorted, c.id)]),
  );

  const headerCells = columns.map((col) => {
    const cls = col.isAtk ? "is-col-atk" : (col.hero ? "is-col-hero" : "is-col-meter");
    return `<th class="${cls}">${col.label}</th>`;
  }).join("");

  return `<div class="is-team">
    <div class="is-team-head">
      <div class="is-team-label">${teamLabel}</div>
      ${boardBtn}
    </div>
    ${renderTeamSummaryChips(totals)}
    <div class="is-table-wrap">
      <table class="is-meter-table">
        <thead>
          <tr>
            <th class="is-col-item">Предмет</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${sorted.map((s) => renderItemMeterRow(s, columns, maxByCol, totals.damageDealt)).join("")}
        </tbody>
        <tfoot>
          ${renderItemStatsTotalRow(totals, columns)}
        </tfoot>
      </table>
    </div>
  </div>`;
}

function sortItemStatsForDisplay(items) {
  return [...items].sort((a, b) => {
    const scoreA = a.damageDealt + a.healingDone + a.blockDone;
    const scoreB = b.damageDealt + b.healingDone + b.blockDone;
    return scoreB - scoreA || b.damageDealt - a.damageDealt;
  });
}

function formatItemStatsTeamCopyBlock(teamLabel, items) {
  if (!items.length) {
    return `${teamLabel}\n(нет данных)`;
  }

  const sorted = sortItemStatsForDisplay(items);
  const totals = sumItemStats(sorted);
  const header = "Предмет\tДоля%\tФиз\tМаг\tВсего\tЛечение\tБлок\tЯд\tАктивации";
  const rows = sorted.map((stat) => {
    const blockValue = getItemBlockValue(stat);
    const name = `${stat.icon || ""} ${stat.name || stat.itemId || "—"}`.trim();
    const share = getDamageSharePct(stat.damageDealt, totals.damageDealt);
    return [
      name,
      share != null ? `${share}%` : "—",
      formatStatNumber(stat.physicalDamageDealt || 0),
      formatStatNumber(stat.magicDamageDealt || 0),
      formatStatNumber(stat.damageDealt),
      formatStatNumber(stat.healingDone),
      formatStatNumber(blockValue),
      formatStatNumber(stat.poisonApplied),
      String(stat.activations || 0),
    ].join("\t");
  });
  const totalRow = [
    "Итого",
    "100%",
    formatStatNumber(totals.physicalDamageDealt),
    formatStatNumber(totals.magicDamageDealt),
    formatStatNumber(totals.damageDealt),
    formatStatNumber(totals.healingDone),
    formatStatNumber(totals.block),
    formatStatNumber(totals.poisonApplied),
    String(totals.activations),
  ].join("\t");

  return `${teamLabel}\n${header}\n${rows.join("\n")}\n${totalRow}`;
}

function formatItemStatsCopyText(playerItems, enemyItems, options = {}) {
  const { title = "Вклад предметов", roundNum = null } = options;
  const playerLabel = typeof getPlayerProfileName === "function"
    ? getPlayerProfileName()
    : "Вы";
  const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
  const enemyLabel = enemyName === "Игрок 2" ? "Игрок 2" : enemyName;

  const lines = [title];
  if (roundNum != null) lines[0] += ` — раунд ${roundNum}`;
  lines.push(
    "",
    formatItemStatsTeamCopyBlock(playerLabel, playerItems || []),
    "",
    formatItemStatsTeamCopyBlock(enemyLabel, enemyItems || []),
  );
  return lines.join("\n");
}

function renderItemStatsSection(playerItems, enemyItems, options = {}) {
  const { showBoardButtons = false } = options;
  const playerLabel = typeof getPlayerProfileName === "function"
    ? `🧑 ${getPlayerProfileName()}`
    : "🧑 Вы";
  const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
  const enemyTeamLabel = enemyName === "Игрок 2" ? "🧑 Игрок 2" : `🤖 ${enemyName}`;
  return renderItemMeterTable(playerItems, playerLabel, {
    showBoardButton: showBoardButtons,
    boardTeam: "player",
  })
    + renderItemMeterTable(enemyItems, enemyTeamLabel, {
      showBoardButton: showBoardButtons,
      boardTeam: "enemy",
    });
}

function renderBrAnimatedStat(kind, value, displayText, extra = "") {
  return `<span class="result-stat-num" data-br-count data-br-kind="${kind}" data-br-value="${Number(value)}"${extra}>${escapeHtml(displayText)}</span>`;
}

function renderBattleResultBlock(summary) {
  const p = summary.player;
  const e = summary.enemy;
  const playerName = typeof getPlayerProfileName === "function" ? getPlayerProfileName() : "Вы";
  const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
  const playerWon = summary.winner === "player";
  const enemyWon = summary.winner === "enemy";
  const youColCls = playerWon ? " result-stat-value--winner" : enemyWon ? " result-stat-value--loser" : "";
  const enemyColCls = enemyWon ? " result-stat-value--winner" : playerWon ? " result-stat-value--loser" : "";
  const youNameCls = playerWon ? " result-stats-name--winner" : enemyWon ? " result-stats-name--loser" : "";
  const enemyNameCls = enemyWon ? " result-stats-name--winner" : playerWon ? " result-stats-name--loser" : "";
  const playerClass = summary.playerClassName
    ? `<span class="result-stats-class"> · ${escapeHtml(summary.playerClassName)}</span>`
    : "";
  const enemyClass = summary.enemyClassName
    ? `<span class="result-stats-class"> · ${escapeHtml(summary.enemyClassName)}</span>`
    : "";

  const pHpIcon = "❤️";
  const eHpIcon = e.hp <= 0 ? "💀" : "❤️";
  const pHpText = `${pHpIcon} ${p.hp}/${p.maxHp}`;
  const eHpText = `${eHpIcon} ${e.hp}/${e.maxHp}`;
  const pDmgText = formatStatNumber(p.damage);
  const eDmgText = formatStatNumber(e.damage);
  const pHealText = formatStatNumber(p.heal);
  const eHealText = formatStatNumber(e.heal);
  const pBlockText = formatStatNumber(p.block);
  const eBlockText = formatStatNumber(e.block);
  const timeText = formatBattleTime(summary.battleTime);
  const pSplit = formatDamageTypeSplit(p.physicalDamage, p.magicDamage);
  const eSplit = formatDamageTypeSplit(e.physicalDamage, e.magicDamage);

  const goldLine = summary.goldReward > 0
    ? `<div class="br-gold">+${summary.goldReward} 💰 за раунд</div>`
    : "";

  return `
    <div class="result-stats-table">
      <div class="result-stats-header">
        <span class="result-stats-name result-stats-name--you${youNameCls}">${escapeHtml(playerName)}${playerClass}</span>
        <span class="result-stats-header-gap" aria-hidden="true"></span>
        <span class="result-stats-name result-stats-name--enemy${enemyNameCls}">${escapeHtml(enemyName)}${enemyClass}</span>
      </div>
      <div class="result-stat-row">
        <span class="result-stat-value result-stat-value--you${youColCls}">
          ${renderBrAnimatedStat("hp", p.hp, pHpText, ` data-br-max="${p.maxHp}" data-br-icon="${pHpIcon}"`)}
        </span>
        <span class="result-stat-label">HP</span>
        <span class="result-stat-value result-stat-value--enemy${enemyColCls}">
          ${renderBrAnimatedStat("hp", e.hp, eHpText, ` data-br-max="${e.maxHp}" data-br-icon="${eHpIcon}"`)}
        </span>
      </div>
      <div class="result-stat-row">
        <span class="result-stat-value result-stat-value--you${youColCls}">
          ${renderBrAnimatedStat("num", p.damage, pDmgText, ' data-br-prefix="⚔ " data-br-suffix=""')}
        </span>
        <span class="result-stat-label">Урон</span>
        <span class="result-stat-value result-stat-value--enemy${enemyColCls}">
          ${renderBrAnimatedStat("num", e.damage, eDmgText, ' data-br-prefix="⚔ " data-br-suffix=""')}
        </span>
      </div>
      <div class="result-stat-row result-stat-row--sub">
        <span class="result-stat-value result-stat-value--you result-stat-sub${youColCls}">${escapeHtml(pSplit)}</span>
        <span class="result-stat-label result-stat-label--sub"></span>
        <span class="result-stat-value result-stat-value--enemy result-stat-sub${enemyColCls}">${escapeHtml(eSplit)}</span>
      </div>
      <div class="result-stat-row">
        <span class="result-stat-value result-stat-value--you${youColCls}">
          ${renderBrAnimatedStat("num", p.heal, pHealText, ' data-br-prefix="❤ " data-br-suffix=" леч."')}
        </span>
        <span class="result-stat-label">Лечение</span>
        <span class="result-stat-value result-stat-value--enemy${enemyColCls}">
          ${renderBrAnimatedStat("num", e.heal, eHealText, ' data-br-prefix="❤ " data-br-suffix=" леч."')}
        </span>
      </div>
      <div class="result-stat-row">
        <span class="result-stat-value result-stat-value--you${youColCls}">
          ${renderBrAnimatedStat("num", p.block, pBlockText, ' data-br-prefix="🛡 " data-br-suffix=" блок"')}
        </span>
        <span class="result-stat-label">Блок</span>
        <span class="result-stat-value result-stat-value--enemy${enemyColCls}">
          ${renderBrAnimatedStat("num", e.block, eBlockText, ' data-br-prefix="🛡 " data-br-suffix=" блок"')}
        </span>
      </div>
      <div class="result-stat-row">
        <span class="result-stat-value result-stat-value--you${youColCls}">
          ${renderBrAnimatedStat("time", summary.battleTime || 0, timeText, ' data-br-prefix="⏱ "')}
        </span>
        <span class="result-stat-label">Время</span>
        <span class="result-stat-value result-stat-value--enemy result-stat-value--empty${enemyColCls}">—</span>
      </div>
    </div>
    ${goldLine}
  `;
}
