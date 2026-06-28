/**
 * Карточки вклада предметов — таблица с DPS-метрами.
 */

function maxStat(items, key) {
  return items.reduce((m, s) => Math.max(m, s[key] || 0), 0);
}

function renderMeterBar(value, max, type) {
  const v = Number(value) || 0;
  if (v <= 0) {
    return `<div class="is-meter is-meter-${type} is-meter-empty"><span class="is-meter-val">—</span></div>`;
  }
  const pct = max > 0 ? Math.max(6, Math.round((v / max) * 100)) : 0;
  return `<div class="is-meter is-meter-${type}">
    <div class="is-meter-track"><div class="is-meter-fill" style="width:${pct}%"></div></div>
    <span class="is-meter-val">${formatStatNumber(v)}</span>
  </div>`;
}

function sumItemStats(items) {
  return items.reduce(
    (acc, stat) => {
      acc.damageDealt += stat.damageDealt || 0;
      acc.physicalDamageDealt += stat.physicalDamageDealt || 0;
      acc.magicDamageDealt += stat.magicDamageDealt || 0;
      acc.healingDone += stat.healingDone || 0;
      acc.block += stat.damageBlocked || stat.blockDone || 0;
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

function renderItemStatsTotalRow(totals) {
  const fmt = (value) => (value > 0 ? formatStatNumber(value) : "—");
  return `<tr class="is-total-row">
    <td class="is-item-cell"><span class="is-name">Итого</span></td>
    <td class="is-total-val">${fmt(totals.physicalDamageDealt)}</td>
    <td class="is-total-val">${fmt(totals.magicDamageDealt)}</td>
    <td class="is-total-val">${fmt(totals.damageDealt)}</td>
    <td class="is-total-val">${fmt(totals.healingDone)}</td>
    <td class="is-total-val">${fmt(totals.block)}</td>
    <td class="is-total-val">${fmt(totals.poisonApplied)}</td>
    <td class="is-atk-cell is-total-val">${totals.activations > 0 ? totals.activations : "—"}</td>
  </tr>`;
}

function renderItemMeterRow(stat, maxPhys, maxMagic, maxDmg, maxHeal, maxBlock, maxPoison) {
  const attacks = stat.activations > 0
    ? `<span class="is-atk">${stat.activations}</span>`
    : `<span class="is-atk is-muted">—</span>`;
  const blockValue = stat.damageBlocked || stat.blockDone || 0;
  const physDmg = stat.physicalDamageDealt || 0;
  const magicDmg = stat.magicDamageDealt || 0;

  return `<tr>
    <td class="is-item-cell">
      <span class="is-icon">${stat.icon}</span>
      <span class="is-name">${stat.name}</span>
    </td>
    <td>${renderMeterBar(physDmg, maxPhys, "phys")}</td>
    <td>${renderMeterBar(magicDmg, maxMagic, "magic")}</td>
    <td>${renderMeterBar(stat.damageDealt, maxDmg, "dmg")}</td>
    <td>${renderMeterBar(stat.healingDone, maxHeal, "heal")}</td>
    <td>${renderMeterBar(blockValue, maxBlock, "block")}</td>
    <td>${renderMeterBar(stat.poisonApplied, maxPoison, "poison")}</td>
    <td class="is-atk-cell">${attacks}</td>
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

  const maxPhys = maxStat(sorted, "physicalDamageDealt");
  const maxMagic = maxStat(sorted, "magicDamageDealt");
  const maxDmg = maxStat(sorted, "damageDealt");
  const maxHeal = maxStat(sorted, "healingDone");
  const maxBlock = sorted.reduce(
    (m, s) => Math.max(m, s.damageBlocked || s.blockDone || 0),
    0,
  );
  const maxPoison = maxStat(sorted, "poisonApplied");
  const totals = sumItemStats(sorted);

  return `<div class="is-team">
    <div class="is-team-head">
      <div class="is-team-label">${teamLabel}</div>
      ${boardBtn}
    </div>
    <div class="is-table-wrap">
      <table class="is-meter-table">
        <thead>
          <tr>
            <th class="is-col-item">Предмет</th>
            <th class="is-col-meter">🗡 Физ</th>
            <th class="is-col-meter">✨ Маг</th>
            <th class="is-col-meter">⚔ Всего</th>
            <th class="is-col-meter">❤ Лечение</th>
            <th class="is-col-meter">🛡 Блок</th>
            <th class="is-col-meter">☠ Яд</th>
            <th class="is-col-atk">🔄</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((s) => renderItemMeterRow(s, maxPhys, maxMagic, maxDmg, maxHeal, maxBlock, maxPoison)).join("")}
        </tbody>
        <tfoot>
          ${renderItemStatsTotalRow(totals)}
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
  const header = "Предмет\tФиз\tМаг\tВсего\tЛечение\tБлок\tЯд\tАктивации";
  const rows = sorted.map((stat) => {
    const blockValue = stat.damageBlocked || stat.blockDone || 0;
    const name = `${stat.icon || ""} ${stat.name || stat.itemId || "—"}`.trim();
    return [
      name,
      formatStatNumber(stat.physicalDamageDealt || 0),
      formatStatNumber(stat.magicDamageDealt || 0),
      formatStatNumber(stat.damageDealt),
      formatStatNumber(stat.healingDone),
      formatStatNumber(blockValue),
      formatStatNumber(stat.poisonApplied),
      String(stat.activations || 0),
    ].join("\t");
  });
  const totals = sumItemStats(sorted);
  const totalRow = [
    "Итого",
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
