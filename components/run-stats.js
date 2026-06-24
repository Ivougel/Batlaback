/**
 * Статистика забега — история фиксированного прогона из 16 боёв.
 */

const RUN_BATTLES = 16;

const RUN_STATUS_ICON = {
  win: "🟢",
  loss: "🔴",
  draw: "🟠",
  current: "🟡",
  pending: "⚪",
};

function getRunBattleStatus(battleNum, roundNum, phase, runResults) {
  const idx = battleNum - 1;
  if (runResults[idx]) {
    return runResults[idx] === "win" ? "win" : runResults[idx] === "loss" ? "loss" : "draw";
  }
  if (battleNum === roundNum && (phase === "prep" || phase === "battle" || phase === "replay")) {
    return "current";
  }
  return "pending";
}

function countRunResults(runResults) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  runResults.forEach((r) => {
    if (r === "win") wins += 1;
    else if (r === "loss") losses += 1;
    else if (r === "draw") draws += 1;
  });
  return { wins, losses, draws };
}

function computeRunWinrate(runResults) {
  const { wins, losses, draws } = countRunResults(runResults);
  const played = wins + losses + draws;
  const winrate = played > 0 ? Math.round((wins / played) * 100) : 0;
  return { wins, losses, draws, played, winrate };
}

function formatRunRecordSummary(runResults) {
  const { wins, losses, draws, played, winrate } = computeRunWinrate(runResults);
  if (!played) return "Винрейт: —";
  return `Винрейт: ${winrate}% · 🟢 ${wins} · 🔴 ${losses} · 🟠 ${draws}`;
}

function renderRunGoldSummary(goldStats) {
  if (!goldStats) return "";
  const earned = goldStats.earned ?? 0;
  const spent = goldStats.spent ?? 0;
  return `<div class="run-gold-summary">Получено за забег: <b>${earned}💰</b> · Потрачено: <b>${spent}💰</b></div>`;
}

function renderRunStatsPanel(roundNum, phase, runResults, goldStats = null) {
  const { wins, losses, draws, played, winrate } = computeRunWinrate(runResults);
  const cells = Array.from({ length: RUN_BATTLES }, (_, i) => {
    const num = i + 1;
    const status = getRunBattleStatus(num, roundNum, phase, runResults);
    const icon = RUN_STATUS_ICON[status] || RUN_STATUS_ICON.pending;
    const cls = status === "current" ? " run-cell-current" : "";
    return `<div class="run-cell${cls}" title="Бой ${num}"><span class="run-num">${num}</span><span class="run-icon">${icon}</span></div>`;
  }).join("");

  return `
    <div class="bstat-header">📊 Статистика забега</div>
    <div class="run-history-label">История забега</div>
    <div class="run-history">${cells}</div>
    <div class="run-summary">Победы: <b>${wins}</b> · Поражения: <b>${losses}</b> · Ничьи: <b>${draws}</b>${played ? ` · Винрейт: <b>${winrate}%</b>` : ""}</div>
    ${renderRunGoldSummary(goldStats)}
  `;
}
