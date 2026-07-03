/**
 * Режим кампании — испытания на сборку билда с обучением и манекенами.
 */
const Campaign = (() => {
  const TRIALS = {
    "build-trial": {
      id: "build-trial",
      title: "Испытание сборки",
      subtitle: "Рюкзак, манекен и первый бой",
      emoji: "🎓",
      steps: [
        {
          id: "backpack-basics",
          title: "Урок 1: Рюкзак",
          hint: "Возьмите яблоко из магазина и перетащите на синие клетки рюкзака",
          prep: {
            gold: 8,
            shop: ["apple", "banana", null, null, null],
            allowRefresh: false,
            allowSell: false,
            carryLoadout: false,
            minFightItems: 1,
          },
          enemy: { classId: "warrior", hpScale: 0.32, damageScale: 0.1 },
          fightLabel: "К манекену",
        },
        {
          id: "fill-grid",
          title: "Урок 2: Заполнение",
          hint: "Разместите три предмета в рюкзаке — форма ячеек важна",
          prep: {
            gold: 6,
            shop: ["apple", "banana", "cheese", "garlic", null],
            allowRefresh: false,
            allowSell: true,
            carryLoadout: true,
            minFightItems: 3,
          },
          enemy: { classId: "warrior", hpScale: 0.38, damageScale: 0.14 },
          fightLabel: "К манекену",
        },
        {
          id: "doll-equip",
          title: "Урок 3: Манекен",
          hint: "Откройте 🪆 Экипировка и наденьте кинжал или меч на манекена",
          prep: {
            gold: 5,
            shop: ["dagger", "wooden_sword", null, null, null],
            allowRefresh: false,
            allowSell: true,
            carryLoadout: true,
            openDoll: true,
            minDollItems: 1,
          },
          enemy: { classId: "warrior", hpScale: 0.42, damageScale: 0.18 },
          fightLabel: "Проверка на манекене",
        },
        {
          id: "build-exam",
          title: "Урок 4: Экзамен",
          hint: "Докупите еду, соберите синергии и победите тренировочный манекен",
          prep: {
            gold: 10,
            shop: ["apple", "banana", "healing_herb", "garlic", "cheese"],
            allowRefresh: true,
            allowSell: true,
            carryLoadout: true,
            minFightItems: 2,
          },
          enemy: { classId: "warrior", hpScale: 0.55, damageScale: 0.22 },
          fightLabel: "Финальный манекен",
        },
      ],
    },
  };

  let activeTrialId = null;
  let stepIndex = 0;
  let rt = null;

  function registerCampaignRuntime(deps) {
    rt = deps;
  }

  function listTrials() {
    return Object.values(TRIALS);
  }

  function getTrial(id = activeTrialId) {
    return id ? TRIALS[id] || null : null;
  }

  function getStep() {
    const trial = getTrial();
    if (!trial) return null;
    return trial.steps[stepIndex] || null;
  }

  function isActive() {
    return !!activeTrialId && !!getStep();
  }

  function startTrial(trialId) {
    if (!TRIALS[trialId]) return false;
    activeTrialId = trialId;
    stepIndex = 0;
    return true;
  }

  function reset() {
    activeTrialId = null;
    stepIndex = 0;
  }

  function getProgressLabel() {
    const trial = getTrial();
    const step = getStep();
    if (!trial || !step) return "";
    return `${step.title} · ${stepIndex + 1}/${trial.steps.length}`;
  }

  function countPlacedBackpackItems(items, containers) {
    if (!Array.isArray(items) || !containers?.length) return 0;
    const uids = new Set();
    containers.forEach((c) => {
      (c.cells || []).forEach((cell) => {
        if (cell?.itemUid) uids.add(cell.itemUid);
      });
    });
    return items.filter((it) => uids.has(it.uid)).length;
  }

  function countDollItems(items) {
    if (typeof listDollEquippedItems === "function") {
      return listDollEquippedItems(items || []).length;
    }
    return 0;
  }

  function meetsFightRequirement(items, containers) {
    const step = getStep();
    if (!step) return true;
    const prep = step.prep || {};
    if (prep.minDollItems) {
      return countDollItems(items) >= prep.minDollItems;
    }
    const minItems = prep.minFightItems ?? 1;
    return countPlacedBackpackItems(items, containers) >= minItems;
  }

  function fightBlockReason(items, containers) {
    const step = getStep();
    if (!step) return "";
    const prep = step.prep || {};
    if (prep.minDollItems) {
      const n = countDollItems(items);
      if (n < prep.minDollItems) {
        return "Наденьте предмет на манекена через 🪆 Экипировка";
      }
    }
    const minItems = prep.minFightItems ?? 1;
    const placed = countPlacedBackpackItems(items, containers);
    if (placed < minItems) {
      return minItems === 1
        ? "Положите хотя бы один предмет в рюкзак"
        : `Разместите в рюкзаке минимум ${minItems} предмета`;
    }
    return "";
  }

  function applyPrepStep() {
    const step = getStep();
    if (!step || !rt) return;
    const prep = step.prep || {};

    if (!prep.carryLoadout) {
      rt.resetPlayerLoadout?.();
    }

    rt.setGold?.(prep.gold ?? rt.getGold?.() ?? 8);

    const shop = Array.isArray(prep.shop) ? prep.shop : [];
    rt.setFixedShop?.(shop);

    rt.setShopOptions?.({
      allowRefresh: prep.allowRefresh !== false,
      allowSell: prep.allowSell !== false,
    });

    if (prep.openDoll) {
      rt.openDoll?.();
    }

    rt.syncChrome?.();
  }

  function createEnemyPrep(step = getStep()) {
    const enemy = step?.enemy || {};
    return {
      classId: enemy.classId || "warrior",
      archetype: typeof AI_ARCHETYPES !== "undefined"
        ? (AI_ARCHETYPES[enemy.classId || "warrior"] || AI_ARCHETYPES.warrior)
        : null,
      gold: 0,
      containers: typeof createStartingContainers === "function" ? createStartingContainers() : [],
      items: [],
      bench: [],
    };
  }

  function applyMannequinBattleModifiers(battleState, step = getStep()) {
    if (!battleState?.enemy || !step?.enemy) return;
    const { hpScale = 0.4, damageScale = 0.15 } = step.enemy;
    const baseHp = battleState.enemy.maxHp || battleState.enemy.hp || 108;
    const scaledHp = Math.max(24, Math.round(baseHp * hpScale));
    battleState.enemy.maxHp = scaledHp;
    battleState.enemy.hp = scaledHp;
    battleState.enemy.damageMult = (battleState.enemy.damageMult || 1) * damageScale;
    battleState.enemy.magicDamageMult = (battleState.enemy.magicDamageMult || 1) * damageScale;
    battleState.enemy.cooldownMult = (battleState.enemy.cooldownMult || 1) * 1.35;
  }

  function getFightLabel() {
    return getStep()?.fightLabel || "К манекену";
  }

  function getHintText() {
    return getStep()?.hint || "";
  }

  function advanceAfterWin() {
    const trial = getTrial();
    if (!trial) return { done: true, hasNext: false };
    if (stepIndex + 1 >= trial.steps.length) {
      return { done: true, hasNext: false };
    }
    stepIndex += 1;
    return { done: false, hasNext: true };
  }

  function getCompletionMessage() {
    const trial = getTrial();
    if (!trial) return "Испытание пройдено!";
    return `«${trial.title}» завершено! Можно идти в одиночный забег или лобби.`;
  }

  return {
    TRIALS,
    registerCampaignRuntime,
    listTrials,
    getTrial,
    getStep,
    isActive,
    startTrial,
    reset,
    getProgressLabel,
    meetsFightRequirement,
    fightBlockReason,
    applyPrepStep,
    createEnemyPrep,
    applyMannequinBattleModifiers,
    getFightLabel,
    getHintText,
    advanceAfterWin,
    getCompletionMessage,
    get stepIndex() { return stepIndex; },
    get activeTrialId() { return activeTrialId; },
  };
})();

window.Campaign = Campaign;
