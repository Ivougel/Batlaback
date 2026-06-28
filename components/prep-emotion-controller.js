/**
 * Эмоциональный слой персонажа на экране подготовки.
 */

const PrepEmotionController = (() => {
  let badgeEl = null;
  let currentMood = "";
  let pulseT = 0;
  let displayEmoji = "";

  const RARITY_SCORE = {
    common: 0.2,
    rare: 0.45,
    epic: 0.65,
    legendary: 0.85,
    unique: 0.9,
    godly: 1,
  };

  function ensureBadge() {
    if (badgeEl?.isConnected) return badgeEl;
    const layer = document.getElementById("prep-character-layer");
    if (!layer) return null;
    badgeEl = document.getElementById("prep-emotion-badge");
    if (!badgeEl) {
      badgeEl = document.createElement("div");
      badgeEl.id = "prep-emotion-badge";
      badgeEl.className = "prep-emotion-badge";
      badgeEl.setAttribute("aria-hidden", "true");
      layer.appendChild(badgeEl);
    }
    return badgeEl;
  }

  function countSlotCells(containers) {
    let n = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (isSlotCell(containers, col, row)) n++;
      }
    }
    return n;
  }

  function countOccupiedCells(items) {
    let n = 0;
    (items || []).forEach((item) => {
      n += getItemCells(item).length;
    });
    return n;
  }

  function averageItemQuality(items) {
    if (!items?.length) return 0;
    let sum = 0;
    items.forEach((item) => {
      const def = ITEM_CATALOG[item.itemId];
      sum += RARITY_SCORE[def?.rarity] || 0.3;
    });
    return sum / items.length;
  }

  function analyze(side) {
    const st = typeof getSideState === "function" ? getSideState(side) : null;
    if (!st) return { emoji: "🙂", mood: "neutral" };

    const slots = countSlotCells(st.containers);
    const occupied = countOccupiedCells(st.items);
    const fillRatio = slots > 0 ? occupied / slots : 0;
    const benchPressure = st.bench.length / (typeof MAX_BENCH !== "undefined" ? MAX_BENCH : 6);
    const synergies = side === "enemy"
      ? synergyState.enemyActiveSynergies
      : synergyState.activeSynergies;
    const strongCount = (synergies || []).filter((s) => s.strength === "strong").length;
    const quality = averageItemQuality(st.items);

    if (benchPressure >= 1 || (fillRatio > 0.92 && benchPressure > 0.66)) {
      return { emoji: "🥵", mood: "overload" };
    }
    if (strongCount >= 2 || (strongCount >= 1 && quality > 0.72)) {
      return { emoji: "🔥", mood: "combo" };
    }
    if ((synergies?.length || 0) >= 2 && quality > 0.6 && fillRatio > 0.45) {
      return { emoji: "✨", mood: "sparkle" };
    }
    if (st.items.length > 0 && fillRatio > 0.35 && benchPressure < 0.67 && quality > 0.45) {
      return { emoji: "😎", mood: "good" };
    }
    if (st.items.length === 0 || fillRatio < 0.12) {
      return { emoji: "😰", mood: "worried" };
    }
    return { emoji: "🙂", mood: "neutral" };
  }

  function sync() {
    hidePrepEmotionBadge();
  }

  function tick() {
    hidePrepEmotionBadge();
  }

  return { sync, tick, analyze };
})();

function hidePrepEmotionBadge() {
  const el = document.getElementById("prep-emotion-badge");
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function syncPrepEmotion(_side) {
  hidePrepEmotionBadge();
}

function tickPrepEmotionController(_dt, _side) {
  hidePrepEmotionBadge();
}

function analyzePrepEmotion(side) {
  return PrepEmotionController.analyze(side);
}
