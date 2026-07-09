/**
 * Мета-прогрессия: разблокировка героев и предметов между забегами.
 * localStorage: bb-meta-progress-v1
 */
const MetaProgress = (() => {
  const STORAGE_KEY = "bb-meta-progress-v1";
  const DISABLE_KEY = "bb-meta-disabled";
  const VERSION = 1;
  const MAX_HERO_LEVEL = 20;

  const HERO_UNLOCK_RULES = {
    warrior: { startUnlocked: true },
    rogue: { startUnlocked: true },
    mage: {
      requiresRunsCompleted: 2,
      hint: "Завершите 2 забега",
    },
    priest: {
      requiresAnyHeroLevel: 3,
      heroOptions: ["warrior", "rogue"],
      hint: "Доведите Воина или Разбойника до ур. 3",
    },
  };

  /** XP для перехода heroLevel → heroLevel+1 (индекс = текущий уровень). */
  const HERO_LEVEL_XP = [
    0, 80, 180, 300, 440, 600, 780, 980, 1200, 1440,
    1700, 1980, 2280, 2600, 2940, 3300, 3680, 4080, 4500, 4940,
  ];

  const defaultHero = () => ({
    unlocked: false,
    level: 1,
    xp: 0,
    runs: 0,
    wins: 0,
    bestRound: 0,
  });

  const defaultState = () => ({
    version: VERSION,
    runsCompleted: 0,
    totalWins: 0,
    heroes: {
      warrior: { ...defaultHero(), unlocked: true },
      rogue: { ...defaultHero(), unlocked: true },
      mage: { ...defaultHero() },
      priest: { ...defaultHero() },
    },
    lastRunReward: null,
  });

  let state = defaultState();

  function isEnabled() {
    try {
      return localStorage.getItem(DISABLE_KEY) !== "1";
    } catch (_) {
      return true;
    }
  }

  function load() {
    if (!isEnabled()) {
      state = defaultState();
      Object.keys(state.heroes).forEach((id) => {
        state.heroes[id].unlocked = true;
      });
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        state = defaultState();
        return;
      }
      const parsed = JSON.parse(raw);
      state = { ...defaultState(), ...parsed, heroes: { ...defaultState().heroes, ...parsed.heroes } };
      Object.keys(state.heroes).forEach((id) => {
        state.heroes[id] = { ...defaultHero(), ...state.heroes[id] };
        if (HERO_UNLOCK_RULES[id]?.startUnlocked) state.heroes[id].unlocked = true;
      });
      refreshHeroUnlocks();
    } catch (_) {
      state = defaultState();
    }
  }

  function save() {
    if (!isEnabled()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) { /* quota */ }
  }

  function getHeroRecord(classId) {
    return state.heroes[classId] || defaultHero();
  }

  function getHeroLevel(classId) {
    return getHeroRecord(classId).level || 1;
  }

  function getMaxHeroLevel() {
    let max = 1;
    Object.entries(state.heroes).forEach(([id, rec]) => {
      if (!rec.unlocked) return;
      max = Math.max(max, rec.level || 1);
    });
    return max;
  }

  function xpToNextLevel(classId) {
    const level = getHeroLevel(classId);
    if (level >= MAX_HERO_LEVEL) return 0;
    return HERO_LEVEL_XP[level] ?? 500;
  }

  function refreshHeroUnlocks() {
    Object.entries(HERO_UNLOCK_RULES).forEach(([classId, rule]) => {
      if (rule.startUnlocked) {
        state.heroes[classId].unlocked = true;
        return;
      }
      if (state.heroes[classId].unlocked) return;

      if (rule.requiresRunsCompleted != null) {
        if (state.runsCompleted >= rule.requiresRunsCompleted) {
          state.heroes[classId].unlocked = true;
        }
        return;
      }

      if (rule.requiresAnyHeroLevel != null && Array.isArray(rule.heroOptions)) {
        const ok = rule.heroOptions.some(
          (hid) => getHeroLevel(hid) >= rule.requiresAnyHeroLevel,
        );
        if (ok) state.heroes[classId].unlocked = true;
      }
    });
  }

  function isHeroUnlocked(classId) {
    if (!isEnabled()) return true;
    return !!getHeroRecord(classId).unlocked;
  }

  function getHeroUnlockHint(classId) {
    const rule = HERO_UNLOCK_RULES[classId];
    if (!rule || isHeroUnlocked(classId)) return "";
    return rule.hint || "Заблокировано";
  }

  function effectiveLevelForItem(itemId) {
    const spec = typeof ItemUnlockTiers !== "undefined"
      ? ItemUnlockTiers.getSpec(itemId)
      : null;
    if (!spec) return getMaxHeroLevel();
    if (spec.scope === "hero" && spec.heroId) return getHeroLevel(spec.heroId);
    return getMaxHeroLevel();
  }

  function isItemUnlocked(itemId, heroClass) {
    if (!isEnabled()) return true;
    if (!itemId) return false;

    const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
    if (def?.classRestriction && def.classRestriction !== heroClass) return false;

    if (typeof ItemUnlockTiers !== "undefined" && ItemUnlockTiers.isStarterForHero(itemId, heroClass)) {
      return true;
    }

    const spec = typeof ItemUnlockTiers !== "undefined"
      ? ItemUnlockTiers.getSpec(itemId)
      : null;
    if (!spec) return true;

    if (spec.scope === "hero" && spec.heroId) {
      return getHeroLevel(spec.heroId) >= spec.minLevel;
    }
    return getMaxHeroLevel() >= spec.minLevel;
  }

  function getItemUnlockHint(itemId, heroClass) {
    if (isItemUnlocked(itemId, heroClass)) return "";
    const spec = ItemUnlockTiers?.getSpec(itemId);
    if (!spec) return "Заблокировано";
    if (spec.scope === "hero" && spec.heroId) {
      const cls = typeof getClassById === "function" ? getClassById(spec.heroId) : null;
      const name = cls?.name || spec.heroId;
      return `Откроется на ур. ${spec.minLevel} (${name})`;
    }
    const need = spec.minLevel;
    const have = getMaxHeroLevel();
    return `Откроется при макс. ур. героя ${need} (сейчас ${have})`;
  }

  function countItemProgress(heroClass) {
    const ids = ItemUnlockTiers?.listShopItemIdsForHero(heroClass) || [];
    let unlocked = 0;
    ids.forEach((id) => {
      if (isItemUnlocked(id, heroClass)) unlocked += 1;
    });
    return { unlocked, total: ids.length };
  }

  function addHeroXp(classId, amount) {
    if (!classId || amount <= 0) return { leveledUp: false, newLevel: getHeroLevel(classId) };
    const rec = state.heroes[classId];
    if (!rec) return { leveledUp: false, newLevel: 1 };

    rec.xp = (rec.xp || 0) + amount;
    let leveledUp = false;
    while (rec.level < MAX_HERO_LEVEL) {
      const need = HERO_LEVEL_XP[rec.level] ?? 9999;
      if (rec.xp < need) break;
      rec.xp -= need;
      rec.level += 1;
      leveledUp = true;
    }
    if (rec.level >= MAX_HERO_LEVEL) rec.xp = 0;
    refreshHeroUnlocks();
    return { leveledUp, newLevel: rec.level };
  }

  function computeRunReward(payload = {}) {
    const {
      classId,
      runResults = [],
      round = 1,
      lobbyWon = false,
      playerEliminated = false,
    } = payload;

    let wins = 0;
    let losses = 0;
    runResults.forEach((r) => {
      if (r === "win") wins += 1;
      else if (r === "loss") losses += 1;
    });

    let heroXp = 40;
    heroXp += wins * 12;
    heroXp += Math.min(round, 16) * 4;
    if (lobbyWon) heroXp += 80;
    if (wins >= 10) heroXp += 30;

    const heroUnlocked = [];
    const before = { ...state.heroes };
    refreshHeroUnlocks();

    return {
      classId,
      heroXp,
      wins,
      losses,
      round,
      runsCompleted: state.runsCompleted + 1,
      heroUnlocked,
      beforeHeroes: before,
    };
  }

  function recordRunEnd(payload = {}) {
    if (!isEnabled()) return null;

    const reward = computeRunReward(payload);
    const { classId, heroXp, wins, round, lobbyWon } = payload;
    const runResults = payload.runResults || [];

    state.runsCompleted += 1;
    state.totalWins += wins;

    if (classId && state.heroes[classId]) {
      const rec = state.heroes[classId];
      rec.runs = (rec.runs || 0) + 1;
      rec.wins = (rec.wins || 0) + wins;
      rec.bestRound = Math.max(rec.bestRound || 0, round || 0);
      const levelResult = addHeroXp(classId, heroXp);
      reward.levelResult = levelResult;
    }

    const newlyUnlocked = [];
    Object.keys(HERO_UNLOCK_RULES).forEach((hid) => {
      const was = reward.beforeHeroes?.[hid]?.unlocked;
      if (!was && state.heroes[hid]?.unlocked) newlyUnlocked.push(hid);
    });
    reward.heroUnlocked = newlyUnlocked;

    state.lastRunReward = {
      ...reward,
      lobbyWon: !!lobbyWon,
      playerEliminated: !!payload.playerEliminated,
    };
    save();
    return state.lastRunReward;
  }

  function renderRunRewardHtml(reward) {
    if (!reward) return "";
    const cls = typeof getClassById === "function" ? getClassById(reward.classId) : null;
    const heroName = cls?.name || reward.classId || "Герой";
    const level = reward.levelResult?.newLevel ?? getHeroLevel(reward.classId);
    const levelLine = reward.levelResult?.leveledUp
      ? `<div class="meta-reward-levelup">🎉 ${heroName} — ур. ${level}!</div>`
      : `<div class="meta-reward-xp">+${reward.heroXp} XP · ${heroName} ур. ${level}</div>`;

    const unlockLines = (reward.heroUnlocked || []).map((hid) => {
      const h = typeof getClassById === "function" ? getClassById(hid) : null;
      return `<div class="meta-reward-unlock">🔓 Открыт герой: <b>${h?.name || hid}</b></div>`;
    }).join("");

    const prog = reward.classId ? countItemProgress(reward.classId) : null;
    const collLine = prog
      ? `<div class="meta-reward-collection">Коллекция ${heroName}: ${prog.unlocked}/${prog.total} предметов в магазине</div>`
      : "";

    return `
      <div class="meta-reward-panel">
        <div class="meta-reward-title">⭐ Прогресс пути</div>
        ${levelLine}
        ${unlockLines}
        ${collLine}
      </div>
    `;
  }

  function applyClassCardState(card, classId) {
    if (!card || !classId) return;
    const unlocked = isHeroUnlocked(classId);
    const rec = getHeroRecord(classId);
    const prog = countItemProgress(classId);

    card.classList.toggle("class-card--locked", !unlocked);
    card.toggleAttribute("disabled", !unlocked);
    card.setAttribute("aria-disabled", unlocked ? "false" : "true");

    let lockEl = card.querySelector(".class-card-lock");
    if (!unlocked) {
      if (!lockEl) {
        lockEl = document.createElement("span");
        lockEl.className = "class-card-lock";
        card.querySelector(".class-card-foot")?.prepend(lockEl);
      }
      lockEl.textContent = `🔒 ${getHeroUnlockHint(classId)}`;
    } else if (lockEl) {
      lockEl.remove();
    }

    let levelEl = card.querySelector(".class-card-meta-level");
    if (unlocked) {
      if (!levelEl) {
        levelEl = document.createElement("span");
        levelEl.className = "class-card-meta-level";
        card.querySelector(".class-card-foot")?.appendChild(levelEl);
      }
      const xpNeed = xpToNextLevel(classId);
      const xpLine = rec.level >= MAX_HERO_LEVEL
        ? "Макс. ур."
        : `${rec.xp}/${xpNeed} XP`;
      levelEl.textContent = `Ур. ${rec.level} · ${prog.unlocked}/${prog.total} предм. · ${xpLine}`;
    } else if (levelEl) {
      levelEl.remove();
    }
  }

  function refreshClassPickerCards() {
    document.querySelectorAll(".class-card[data-class]").forEach((card) => {
      applyClassCardState(card, card.dataset.class);
    });
    document.querySelectorAll(".opponent-class-card[data-opponent-class]").forEach((card) => {
      applyClassCardState(card, card.dataset.opponentClass);
    });
  }

  function resetProgress() {
    state = defaultState();
    save();
    refreshHeroUnlocks();
    refreshClassPickerCards();
  }

  load();

  return {
    isEnabled,
    load,
    save,
    resetProgress,
    isHeroUnlocked,
    getHeroUnlockHint,
    getHeroLevel,
    getMaxHeroLevel,
    getHeroRecord,
    xpToNextLevel,
    isItemUnlocked,
    getItemUnlockHint,
    effectiveLevelForItem,
    countItemProgress,
    recordRunEnd,
    renderRunRewardHtml,
    refreshClassPickerCards,
    applyClassCardState,
    getLastRunReward: () => state.lastRunReward,
    HERO_UNLOCK_RULES,
    MAX_HERO_LEVEL,
  };
})();

window.MetaProgress = MetaProgress;
