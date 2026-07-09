/**
 * Подсказки при смене лидера мутации / скачке ветки ≥5%.
 * Hint-bar + дельты на полоске прогресса в prep.
 */

const MUTATION_HINT_DELTA_THRESHOLD = 5;
const MUTATION_HINT_VISIBLE_MS = 5000;

let lastMutationSnapshot = null;
let lastLoadoutFingerprint = null;
let activeMutationDeltas = null;
let activeMutationDeltasUntil = 0;
let mutationHintTimer = null;
let mutationHintActive = false;

function getPrepMutationHintSide() {
  return typeof prepViewSide !== "undefined" ? prepViewSide : "player";
}

function getPrepMutationHintRuntime() {
  if (typeof getSideMutationRuntime !== "function") return null;
  return getSideMutationRuntime(getPrepMutationHintSide());
}

function buildLoadoutFingerprint(rt) {
  if (!rt) return "";
  const itemIds = (rt.items || [])
    .map((it) => it?.itemId)
    .filter(Boolean)
    .sort();
  const slotItemIds = typeof listSlotItemIds === "function"
    ? listSlotItemIds(rt.items || []).sort()
    : [];
  const enh = rt.enhancements || {};
  const enhKey = ["head", "chest", "boots"]
    .map((slot) => `${slot}:${enh[slot] || ""}`)
    .join("|");
  return JSON.stringify({ itemIds, slotItemIds, enhKey, classId: rt.classId, companionId: rt.companionId });
}

function captureMutationProgressSnapshot(progress) {
  if (!progress) return null;
  const ranked = Object.create(null);
  (progress.ranked || []).forEach((row) => {
    if (row?.id) ranked[row.id] = row.pct ?? 0;
  });
  return {
    leaderId: progress.leader?.id || null,
    leaderName: progress.leader?.name || "",
    leaderPct: progress.leader?.pct ?? 0,
    leaderShare: progress.leaderShare ?? progress.leaderPct ?? 0,
    ranked,
    tagCounts: { ...(progress.tagCounts || {}) },
  };
}

function diffMutationProgressSnapshots(before, after, minDelta = MUTATION_HINT_DELTA_THRESHOLD) {
  if (!before || !after) return null;

  const leaderChanged = before.leaderId !== after.leaderId;
  const branchDeltas = [];
  const ids = new Set([
    ...Object.keys(before.ranked || {}),
    ...Object.keys(after.ranked || {}),
  ]);

  ids.forEach((id) => {
    const prevPct = before.ranked[id] ?? 0;
    const nextPct = after.ranked[id] ?? 0;
    const delta = nextPct - prevPct;
    if (Math.abs(delta) < minDelta) return;
    const def = typeof getMutationById === "function" ? getMutationById(id) : null;
    branchDeltas.push({
      id,
      name: def?.name || id,
      before: prevPct,
      after: nextPct,
      delta,
    });
  });

  branchDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const deltaMap = Object.create(null);
  branchDeltas.forEach((row) => {
    deltaMap[row.id] = row.delta;
  });
  if (leaderChanged && after.leaderId && deltaMap[after.leaderId] == null) {
    const prevPct = before.ranked[after.leaderId] ?? 0;
    const nextPct = after.ranked[after.leaderId] ?? after.leaderPct;
    deltaMap[after.leaderId] = nextPct - prevPct;
  }

  const hasHint = leaderChanged || branchDeltas.length > 0;
  return {
    leaderChanged,
    leaderBefore: before.leaderId
      ? { id: before.leaderId, name: before.leaderName, pct: before.leaderPct }
      : null,
    leaderAfter: after.leaderId
      ? { id: after.leaderId, name: after.leaderName, pct: after.leaderPct }
      : null,
    branchDeltas,
    deltaMap,
    hasHint,
  };
}

function describeMutationTagShift(beforeCounts, afterCounts, branchId) {
  const mut = typeof getMutationById === "function" ? getMutationById(branchId) : null;
  if (!mut?.tagWeights) return "";
  let bestTag = null;
  let bestDelta = 0;
  Object.keys(mut.tagWeights).forEach((tag) => {
    const delta = (afterCounts[tag] || 0) - (beforeCounts[tag] || 0);
    if (delta > bestDelta) {
      bestDelta = delta;
      bestTag = tag;
    }
  });
  return bestTag && bestDelta > 0
    ? `${typeof formatMutationTagLabel === "function" ? formatMutationTagLabel(bestTag) : bestTag} ↑`
    : "";
}

function formatMutationDeltaLabel(delta) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}%`;
}

function buildMutationProgressHint(diff, beforeSnap, afterSnap, ctx = {}) {
  if (!diff?.hasHint) return null;

  if (diff.leaderChanged && diff.leaderAfter) {
    const after = diff.leaderAfter;
    const before = diff.leaderBefore;
    const delta = diff.deltaMap[after.id] ?? (after.pct - (before?.pct ?? 0));
    const tagHint = ctx.itemId && typeof ITEM_CATALOG !== "undefined"
      ? (ITEM_CATALOG[ctx.itemId]?.name || ctx.itemId)
      : describeMutationTagShift(beforeSnap?.tagCounts, afterSnap?.tagCounts, after.id);
    const eyebrow = `Лидер: ${after.name} ${after.pct}% ${formatMutationDeltaLabel(delta)}`;
    const parts = [];
    if (before?.name) parts.push(`был ${before.name} ${before.pct}%`);
    if (tagHint) parts.push(tagHint);
    return { eyebrow, text: parts.join(" · ") || "Билд сменил ведущий путь" };
  }

  const top = diff.branchDeltas[0];
  if (!top) return null;
  const tagHint = ctx.itemId && typeof ITEM_CATALOG !== "undefined"
    ? (ITEM_CATALOG[ctx.itemId]?.name || ctx.itemId)
    : describeMutationTagShift(beforeSnap?.tagCounts, afterSnap?.tagCounts, top.id);
  return {
    eyebrow: `${formatMutationDeltaLabel(top.delta)} к ${top.name} → ${top.after}%`,
    text: tagHint || `было ${top.before}%`,
  };
}

function getActiveMutationProgressDeltas() {
  if (!activeMutationDeltas || Date.now() > activeMutationDeltasUntil) {
    activeMutationDeltas = null;
    activeMutationDeltasUntil = 0;
    return null;
  }
  return activeMutationDeltas;
}

function clearMutationProgressHintBar() {
  mutationHintActive = false;
  if (mutationHintTimer) {
    clearTimeout(mutationHintTimer);
    mutationHintTimer = null;
  }
  const bar = document.getElementById("campaign-hint-bar");
  bar?.classList.remove("mutation-hint-active");
  delete bar?.dataset?.mutationHint;
  if (typeof syncCampaignChrome === "function") {
    syncCampaignChrome();
  } else if (bar && !document.documentElement.dataset.gameMode?.includes("campaign")) {
    bar.classList.add("hidden");
    const progressEl = document.getElementById("campaign-hint-progress");
    const textEl = document.getElementById("campaign-hint-text");
    if (progressEl) progressEl.textContent = "";
    if (textEl) textEl.textContent = "";
  }
}

function showMutationProgressHintBar(payload) {
  if (!payload?.eyebrow) return;
  const bar = document.getElementById("campaign-hint-bar");
  const progressEl = document.getElementById("campaign-hint-progress");
  const textEl = document.getElementById("campaign-hint-text");
  if (!bar || !progressEl || !textEl) return;

  mutationHintActive = true;
  bar.classList.remove("hidden");
  bar.classList.add("mutation-hint-active");
  bar.dataset.mutationHint = "1";
  progressEl.textContent = payload.eyebrow;
  textEl.textContent = payload.text || "";

  if (mutationHintTimer) clearTimeout(mutationHintTimer);
  mutationHintTimer = setTimeout(() => {
    clearMutationProgressHintBar();
  }, MUTATION_HINT_VISIBLE_MS);
}

function resetMutationProgressHintTracking() {
  lastMutationSnapshot = null;
  lastLoadoutFingerprint = null;
  activeMutationDeltas = null;
  activeMutationDeltasUntil = 0;
  clearMutationProgressHintBar();
}

function markPrepLoadoutMutationChange(ctx = {}) {
  if (typeof window !== "undefined") {
    window.__prepMutationChangeCtx = ctx;
  }
}

function consumePrepLoadoutMutationChangeCtx() {
  const ctx = typeof window !== "undefined" ? (window.__prepMutationChangeCtx || null) : null;
  if (typeof window !== "undefined") window.__prepMutationChangeCtx = null;
  return ctx;
}

function notifyPrepMutationProgressChange(progress, ctx = null) {
  const afterSnap = captureMutationProgressSnapshot(progress);
  const rt = getPrepMutationHintRuntime();
  const fingerprint = buildLoadoutFingerprint(rt);
  const loadoutChanged = fingerprint !== lastLoadoutFingerprint;
  const explicitCtx = ctx || consumePrepLoadoutMutationChangeCtx();

  if (!afterSnap) {
    lastMutationSnapshot = null;
    lastLoadoutFingerprint = fingerprint;
    return null;
  }

  if (!lastMutationSnapshot || (!loadoutChanged && !explicitCtx)) {
    lastMutationSnapshot = afterSnap;
    lastLoadoutFingerprint = fingerprint;
    return getActiveMutationProgressDeltas();
  }

  const beforeSnap = lastMutationSnapshot;
  const diff = diffMutationProgressSnapshots(beforeSnap, afterSnap);
  lastMutationSnapshot = afterSnap;
  lastLoadoutFingerprint = fingerprint;

  if (!diff?.hasHint) {
    return getActiveMutationProgressDeltas();
  }

  const hint = buildMutationProgressHint(diff, beforeSnap, afterSnap, explicitCtx || {});
  if (hint) showMutationProgressHintBar(hint);

  activeMutationDeltas = diff.deltaMap;
  activeMutationDeltasUntil = Date.now() + MUTATION_HINT_VISIBLE_MS;

  return diff.deltaMap;
}

function renderMutationDeltaBadge(delta, options = {}) {
  if (!delta) return "";
  const sign = delta > 0 ? "+" : "";
  const compact = options.compact ? " mutation-progress-delta--compact" : "";
  const dir = delta > 0 ? "up" : "down";
  const label = typeof escapeMutationHtml === "function"
    ? escapeMutationHtml(`${sign}${delta}%`)
    : `${sign}${delta}%`;
  return `<span class="mutation-progress-delta mutation-progress-delta--${dir}${compact}" aria-label="изменение ${sign}${delta} процентов">${label}</span>`;
}
