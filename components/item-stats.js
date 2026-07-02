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

function renderBattleResultBlock(summary) {
  const p = summary.player;
  const e = summary.enemy;
  const playerName = typeof getPlayerProfileName === "function" ? getPlayerProfileName() : "Игрок";
  const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
  const goldLine = summary.goldReward > 0
    ? `<div class="br-gold">+${summary.goldReward} 💰 за раунд</div>`
    : "";
  const classWinnerLine = summary.classWinnerLine
    ? `<div class="br-class-winner">${escapeHtml(summary.classWinnerLine)}</div>`
    : "";

  return `
    <div class="br-side br-side-player">
      <div class="br-side-title">${escapeHtml(playerName)}${summary.playerClassName ? ` · ${escapeHtml(summary.playerClassName)}` : ""}</div>
      <div class="br-stat">❤️ ${p.hp}/${p.maxHp} HP</div>
      <div class="br-stat">⚔ ${formatStatNumber(p.damage)} урона по HP</div>
      <div class="br-stat br-stat-sub">${formatDamageTypeSplit(p.physicalDamage, p.magicDamage)}</div>
      <div class="br-stat">❤ ${formatStatNumber(p.heal)} лечения</div>
      <div class="br-stat">🛡 ${formatStatNumber(p.block)} блока</div>
      <div class="br-stat">⏱ ${formatBattleTime(summary.battleTime)}</div>
    </div>
    <div class="br-side br-side-enemy">
      <div class="br-side-title">${escapeHtml(enemyName)}${summary.enemyClassName ? ` · ${escapeHtml(summary.enemyClassName)}` : ""}</div>
      <div class="br-stat">${e.hp <= 0 ? "💀" : "❤️"} ${e.hp}/${e.maxHp} HP</div>
      <div class="br-stat">⚔ ${formatStatNumber(e.damage)} урона по HP</div>
      <div class="br-stat br-stat-sub">${formatDamageTypeSplit(e.physicalDamage, e.magicDamage)}</div>
      <div class="br-stat">❤ ${formatStatNumber(e.heal)} лечения</div>
      <div class="br-stat">🛡 ${formatStatNumber(e.block)} блока</div>
    </div>
    ${classWinnerLine}
    ${goldLine}
  `;
}
