// Transpiled from TypeScript — npm run compile:ts

const MetaProgress = (() => {
  const STORAGE_KEY = "bb-meta-progress-v1";
  const DISABLE_KEY = "bb-meta-disabled";
  const ENABLE_KEY = "bb-meta-enabled";
  const PATH_MODE_ID = "path";
  const CLASSIC_MODE_ID = "classic";
  const VERSION = 1;
  const MAX_HERO_LEVEL = 20;
  let pickerModeId = null;
  let runModeId = null;
  const HERO_UNLOCK_RULES = {
    warrior: { startUnlocked: true },
    rogue: { startUnlocked: true },
    mage: {
      requiresRunsCompleted: 2,
      hint: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 2 \u0437\u0430\u0431\u0435\u0433\u0430"
    },
    priest: {
      requiresAnyHeroLevel: 3,
      heroOptions: ["warrior", "rogue"],
      hint: "\u0414\u043E\u0432\u0435\u0434\u0438\u0442\u0435 \u0412\u043E\u0438\u043D\u0430 \u0438\u043B\u0438 \u0420\u0430\u0437\u0431\u043E\u0439\u043D\u0438\u043A\u0430 \u0434\u043E \u0443\u0440. 3"
    }
  };
  const HERO_LEVEL_XP = [
    0,
    80,
    180,
    300,
    440,
    600,
    780,
    980,
    1200,
    1440,
    1700,
    1980,
    2280,
    2600,
    2940,
    3300,
    3680,
    4080,
    4500,
    4940
  ];
  const defaultHero = () => ({
    unlocked: false,
    level: 1,
    xp: 0,
    runs: 0,
    wins: 0,
    bestRound: 0
  });
  const defaultState = () => ({
    version: VERSION,
    runsCompleted: 0,
    totalWins: 0,
    heroes: {
      warrior: { ...defaultHero(), unlocked: true },
      rogue: { ...defaultHero(), unlocked: true },
      mage: { ...defaultHero() },
      priest: { ...defaultHero() }
    },
    lastRunReward: null
  });
  let state = defaultState();
  function isEnabled() {
    try {
      if (localStorage.getItem(DISABLE_KEY) === "1") return false;
      return localStorage.getItem(ENABLE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }
  function isPathMode(modeId) {
    return modeId === PATH_MODE_ID;
  }
  function isClassicModeId(modeId) {
    return modeId === CLASSIC_MODE_ID;
  }
  function usesMetaUnlock(modeId) {
    return isPathMode(modeId);
  }
  function isMaxAccountActive() {
    return typeof isMaxAccountMode === "function" && isMaxAccountMode();
  }
  function isActiveForPicker() {
    if (isMaxAccountActive()) return false;
    return isEnabled() && usesMetaUnlock(pickerModeId);
  }
  function isActiveForRun() {
    if (isMaxAccountActive()) return false;
    return isEnabled() && usesMetaUnlock(runModeId);
  }
  function setPickerMode(modeId) {
    pickerModeId = modeId || null;
  }
  function setRunMode(modeId) {
    runModeId = modeId || null;
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
    } catch (_) {
    }
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
        const need = rule.requiresAnyHeroLevel;
        const ok = rule.heroOptions.some(
          (hid) => getHeroLevel(hid) >= need
        );
        if (ok) state.heroes[classId].unlocked = true;
      }
    });
  }
  function isHeroUnlocked(classId) {
    if (isMaxAccountActive()) return true;
    if (!isActiveForPicker()) return true;
    return !!getHeroRecord(classId).unlocked;
  }
  function getHeroUnlockHint(classId) {
    if (!isActiveForPicker()) return "";
    const rule = HERO_UNLOCK_RULES[classId];
    if (!rule || isHeroUnlocked(classId)) return "";
    return rule.hint || "\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E";
  }
  function effectiveLevelForItem(itemId) {
    const spec = typeof ItemUnlockTiers !== "undefined" ? ItemUnlockTiers.getSpec(itemId) : null;
    if (!spec) return getMaxHeroLevel();
    if (spec.scope === "hero" && spec.heroId) return getHeroLevel(spec.heroId);
    return getMaxHeroLevel();
  }
  function isItemUnlocked(itemId, heroClass) {
    if (isMaxAccountActive()) return true;
    if (!isActiveForRun()) return true;
    if (!itemId) return false;
    const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
    if (typeof shouldUseClassSystem === "function" && shouldUseClassSystem() && def?.classRestriction && def.classRestriction !== heroClass) return false;
    if (typeof ItemUnlockTiers !== "undefined" && ItemUnlockTiers.isStarterForHero(itemId, heroClass)) {
      return true;
    }
    const spec = typeof ItemUnlockTiers !== "undefined" ? ItemUnlockTiers.getSpec(itemId) : null;
    if (!spec) return true;
    if (spec.scope === "hero" && spec.heroId) {
      return getHeroLevel(spec.heroId) >= spec.minLevel;
    }
    return getMaxHeroLevel() >= spec.minLevel;
  }
  function getItemUnlockHint(itemId, heroClass) {
    if (isItemUnlocked(itemId, heroClass)) return "";
    const spec = ItemUnlockTiers?.getSpec(itemId);
    if (!spec) return "\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E";
    if (spec.scope === "hero" && spec.heroId) {
      const cls = typeof getClassById === "function" ? getClassById(spec.heroId) : null;
      const name = cls?.name || spec.heroId;
      return `\u041E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u043D\u0430 \u0443\u0440. ${spec.minLevel} (${name})`;
    }
    const need = spec.minLevel;
    const have = getMaxHeroLevel();
    return `\u041E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u043F\u0440\u0438 \u043C\u0430\u043A\u0441. \u0443\u0440. \u0433\u0435\u0440\u043E\u044F ${need} (\u0441\u0435\u0439\u0447\u0430\u0441 ${have})`;
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
      playerEliminated = false
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
      beforeHeroes: before
    };
  }
  function recordRunEnd(payload = {}) {
    if (!isActiveForRun()) return null;
    const reward = computeRunReward(payload);
    const { classId, heroXp, wins, round } = payload;
    const runResults = payload.runResults || [];
    state.runsCompleted += 1;
    state.totalWins += wins ?? 0;
    if (classId && state.heroes[classId]) {
      const rec = state.heroes[classId];
      rec.runs = (rec.runs || 0) + 1;
      rec.wins = (rec.wins || 0) + (wins ?? 0);
      rec.bestRound = Math.max(rec.bestRound || 0, round || 0);
      const levelResult = addHeroXp(classId, heroXp ?? reward.heroXp ?? 0);
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
      playerEliminated: !!payload.playerEliminated
    };
    save();
    return state.lastRunReward;
  }
  function renderRunRewardHtml(reward) {
    if (!reward) return "";
    const cls = typeof getClassById === "function" ? getClassById(reward.classId) : null;
    const heroName = cls?.name || reward.classId || "\u0413\u0435\u0440\u043E\u0439";
    const level = reward.levelResult?.newLevel ?? getHeroLevel(reward.classId ?? "");
    const levelLine = reward.levelResult?.leveledUp ? `<div class="meta-reward-levelup">\u{1F389} ${heroName} \u2014 \u0443\u0440. ${level}!</div>` : `<div class="meta-reward-xp">+${reward.heroXp} XP \xB7 ${heroName} \u0443\u0440. ${level}</div>`;
    const unlockLines = (reward.heroUnlocked || []).map((hid) => {
      const h = typeof getClassById === "function" ? getClassById(hid) : null;
      return `<div class="meta-reward-unlock">\u{1F513} \u041E\u0442\u043A\u0440\u044B\u0442 \u0433\u0435\u0440\u043E\u0439: <b>${h?.name || hid}</b></div>`;
    }).join("");
    const prog = reward.classId ? countItemProgress(reward.classId) : null;
    const collLine = prog ? `<div class="meta-reward-collection">\u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F ${heroName}: ${prog.unlocked}/${prog.total} \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435</div>` : "";
    return `
      <div class="meta-reward-panel">
        <div class="meta-reward-title">\u2B50 \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u043F\u0443\u0442\u0438</div>
        ${levelLine}
        ${unlockLines}
        ${collLine}
      </div>
    `;
  }
  function applyClassCardState(card, classId) {
    if (!card || !classId) return;
    if (!isActiveForPicker()) {
      card.classList.remove("class-card--locked");
      card.removeAttribute("disabled");
      card.setAttribute("aria-disabled", "false");
      card.querySelector(".class-card-lock")?.remove();
      card.querySelector(".class-card-meta-level")?.remove();
      return;
    }
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
      lockEl.textContent = `\u{1F512} ${getHeroUnlockHint(classId)}`;
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
      const xpLine = rec.level >= MAX_HERO_LEVEL ? "\u041C\u0430\u043A\u0441. \u0443\u0440." : `${rec.xp}/${xpNeed} XP`;
      levelEl.textContent = `\u0423\u0440. ${rec.level} \xB7 ${prog.unlocked}/${prog.total} \u043F\u0440\u0435\u0434\u043C. \xB7 ${xpLine}`;
    } else if (levelEl) {
      levelEl.remove();
    }
  }
  function refreshClassPickerCards() {
    document.querySelectorAll(".class-card[data-class]").forEach((card) => {
      applyClassCardState(card, card.dataset.class ?? "");
    });
    document.querySelectorAll(".opponent-class-card[data-opponent-class]").forEach((card) => {
      applyClassCardState(card, card.dataset.opponentClass ?? "");
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
    PATH_MODE_ID,
    isEnabled,
    isPathMode,
    isActiveForPicker,
    isActiveForRun,
    setPickerMode,
    setRunMode,
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
    MAX_HERO_LEVEL
  };
})();
window.MetaProgress = MetaProgress;
