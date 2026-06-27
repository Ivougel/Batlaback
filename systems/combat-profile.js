/**
 * Профиль бойца — итоговые характеристики из ITEM_CATALOG, синергий и класса.
 * Использует createBattleSide из battle-engine (без дублирования логики).
 */

function escapeProfileHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cloneItemsForProfile(items) {
  return items.map((item) => ({
    ...item,
    runtime: item.runtime ? { ...item.runtime, activeSynergies: [...(item.runtime.activeSynergies || [])] } : undefined,
  }));
}

function sumItemDamageValues(items) {
  let physical = 0;
  let magical = 0;

  items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    if (!def || def.isContainer) return;
    const bonus = item.runtime?.damageBonus || 0;
    (def.effects || []).forEach((eff) => {
      if (eff.type !== "damage") return;
      const base = getEffectAverageDamage(eff, def) + bonus;
      if (eff.damageType === "magic" || eff.damageType === "fire") magical += base;
      else physical += base;
    });
  });

  return { physical, magical };
}

const TIMED_BUFF_META = {
  damage: { icon: "⬆️", label: "урона", title: "Усиление урона" },
  magicDamage: { icon: "✨", label: "магии", title: "Усиление магии" },
  cooldown: { icon: "⚡", label: "скорости", title: "Ускорение" },
};

function pushUniqueStatusChip(list, chip, seen) {
  const key = chip.id;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(chip);
}

function collectPrepStatusEffects(side, items) {
  const buffs = [];
  const debuffs = [];
  const seen = new Set();

  const blockSources = items.filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return (def?.effects || []).some((e) => e.type === "block" && e.trigger !== "passive");
  });
  if (blockSources.length > 1) {
    const lines = blockSources
      .map((item) => {
        const def = ITEM_CATALOG[item.itemId];
        const eff = item.runtime?.blockSourceEfficiency ?? 1;
        const pct = Math.round(eff * 100);
        return pct >= 100 ? `${def.name}: полная сила` : `${def.name}: ${pct}% блока`;
      })
      .sort((a, b) => {
        const pctA = parseInt(a.match(/(\d+)%/)?.[1] || "100", 10);
        const pctB = parseInt(b.match(/(\d+)%/)?.[1] || "100", 10);
        return pctB - pctA;
      });
    pushUniqueStatusChip(buffs, {
      id: "block-stacking",
      icon: "🛡",
      value: blockSources.length,
      title: "Несколько источников блока",
      lines: [
        "2-й и следующие источники блока слабее (100% → 85% → 72% → 60%)",
        ...lines,
      ],
    }, seen);
  }

  const duplicateLines = [];
  items.forEach((item) => {
    const eff = item.runtime?.duplicateEfficiency ?? 1;
    if (eff >= 1) return;
    const def = ITEM_CATALOG[item.itemId];
    duplicateLines.push(`${def.name}: ${Math.round(eff * 100)}% (повтор)`);
  });
  if (duplicateLines.length) {
    pushUniqueStatusChip(buffs, {
      id: "duplicate-items",
      icon: "📦",
      value: duplicateLines.length,
      title: "Повторы одного предмета",
      lines: [
        "2-я и следующие копии слабее (урон, броня, эффекты)",
        ...duplicateLines,
      ],
    }, seen);
  }

  if (side.classId === "priest" && side.classFoodBonusHp > 0) {
    const perFood = getClassById(side.classId)?.combatBonus?.maxHpPerFood || 5;
    pushUniqueStatusChip(buffs, {
      id: "priest-food-bonus",
      icon: "🍎",
      value: side.classFoodBonusHp,
      title: "Благословение жреца",
      lines: [
        `+${perFood} макс. HP за каждую еду в рюкзаке`,
        `${side.classFoodCount || 0} еды → +${side.classFoodBonusHp} HP`,
      ],
    }, seen);
  }

  const poisonSources = items.filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return (def?.effects || []).some((e) => e.type === "poison");
  });
  if (poisonSources.length > 1) {
    const poisonLines = poisonSources
      .map((item) => {
        const def = ITEM_CATALOG[item.itemId];
        const eff = item.runtime?.poisonSourceEfficiency ?? 1;
        const pct = Math.round(eff * 100);
        return pct >= 100 ? `${def.name}: полная сила` : `${def.name}: ${pct}% яда`;
      })
      .sort((a, b) => {
        const pctA = parseInt(a.match(/(\d+)%/)?.[1] || "100", 10);
        const pctB = parseInt(b.match(/(\d+)%/)?.[1] || "100", 10);
        return pctB - pctA;
      });
    pushUniqueStatusChip(buffs, {
      id: "poison-stacking",
      icon: "☠",
      value: poisonSources.length,
      title: "Несколько источников яда",
      lines: [
        "2-й и следующие источники яда слабее (100% → 65% → 50% → 40%)",
        ...poisonLines,
      ],
    }, seen);
  }

  items.forEach((item) => {
    (item.runtime?.activeSynergies || []).forEach((s, idx) => {
      pushUniqueStatusChip(buffs, {
        id: `synergy-${s.from}-${s.desc}`,
        icon: "💫",
        value: 1,
        title: s.from ? `Синергия: ${s.from}` : "Синергия",
        lines: [s.desc],
      }, seen);
    });
  });

  if (side.lifesteal > 0) {
    const pct = Math.round(side.lifesteal * 100);
    pushUniqueStatusChip(buffs, {
      id: "lifesteal",
      icon: "🩸",
      value: pct,
      title: "Вампиризм",
      lines: [`${pct}% от нанесённого урона`],
    }, seen);
  }

  if (side.dodgeInterval > 0) {
    pushUniqueStatusChip(buffs, {
      id: "dodge-passive",
      icon: "💨",
      value: side.dodgeInterval,
      title: "Уклонение",
      lines: [`Готово каждые ${side.dodgeInterval}с`],
    }, seen);
  }

  if (side.repeatMagic || side.items.some((item) => item.itemId === "mana_orb")) {
    pushUniqueStatusChip(buffs, {
      id: "repeat-magic",
      icon: "🔮",
      value: 1,
      title: "Повтор сферы маны",
      lines: ["Сфера маны повторяет своё заклинание с 50% силы"],
    }, seen);
  }

  if (side.shieldBreakBonus > 0) {
    const pct = Math.round(side.shieldBreakBonus * 100);
    pushUniqueStatusChip(buffs, {
      id: "shield-break",
      icon: "🔨",
      value: pct,
      title: "Пробивание блока",
      lines: [`+${pct}% урона по блоку противника`],
    }, seen);
  }

  if (side.shieldBlockMult > 0) {
    const pct = Math.round(side.shieldBlockMult * 100);
    pushUniqueStatusChip(buffs, {
      id: "shield-block-mult",
      icon: "🛡",
      value: pct,
      title: "Усиление блока",
      lines: [`+${pct}% к получаемому блоку`],
    }, seen);
  }

  if (side.critChance > 0) {
    const pct = Math.round(side.critChance * 100);
    pushUniqueStatusChip(buffs, {
      id: "crit-passive",
      icon: "💥",
      value: pct,
      title: "Критический удар",
      lines: [
        `${pct}% шанс крита`,
        side.critDoublePoison ? "Крит удваивает яд" : null,
      ].filter(Boolean),
    }, seen);
  }

  return { buffs, debuffs };
}

function collectBattleStatusEffects(side, items, battleState = null) {
  const buffs = [];
  const debuffs = [];
  const seen = new Set();

  if (side.block > 0) {
    const amount = Math.ceil(side.block);
    pushUniqueStatusChip(buffs, {
      id: "block",
      icon: "🛡",
      value: amount,
      title: "Блок",
      lines: [`Поглощает до ${amount} урона`],
    }, seen);
  }

  if (side.dodgeReady) {
    pushUniqueStatusChip(buffs, {
      id: "dodge-ready",
      icon: "💨",
      value: 1,
      title: "Уклонение",
      lines: ["Следующая атака по вам промахнётся"],
    }, seen);
  }

  const timedByStat = {};
  (side.timedBuffs || []).forEach((buff) => {
    const stat = buff.stat || "damage";
    if (!timedByStat[stat]) {
      timedByStat[stat] = { value: 0, remaining: 0, count: 0 };
    }
    timedByStat[stat].value += buff.value || 0;
    timedByStat[stat].remaining = Math.max(timedByStat[stat].remaining, buff.remaining || 0);
    timedByStat[stat].count += 1;
  });

  Object.entries(timedByStat).forEach(([stat, data]) => {
    const meta = TIMED_BUFF_META[stat] || { icon: "⬆️", label: stat, title: "Усиление" };
    pushUniqueStatusChip(buffs, {
      id: `timed-${stat}`,
      icon: meta.icon,
      value: data.count > 1 ? data.count : Math.max(1, Math.round(data.value * 100)),
      title: meta.title,
      lines: [
        `+${Math.round(data.value * 100)}% ${meta.label}`,
        `Осталось ${data.remaining.toFixed(1)}с`,
      ],
    }, seen);
  });

  let pendingAttack = 0;
  items.forEach((item) => {
    pendingAttack += item.runtime?.pendingAttackBuff || 0;
  });
  if (pendingAttack > 0) {
    pushUniqueStatusChip(buffs, {
      id: "pending-attack",
      icon: "⚔️",
      value: pendingAttack,
      title: "Бонус атаки",
      lines: [`+${pendingAttack} к урону следующей атаки оружия`],
    }, seen);
  }

  if (side.poisonStacks > 0) {
    pushUniqueStatusChip(debuffs, {
      id: "poison",
      icon: "☠",
      value: side.poisonStacks,
      title: "Яд",
      lines: [
        `${side.poisonStacks} стаков`,
        `${typeof getPoisonDotDamage === "function" ? getPoisonDotDamage(side.poisonStacks) : side.poisonStacks} урона каждую секунду`,
      ],
    }, seen);
  }

  if (typeof collectStackStatusChips === "function") {
    collectStackStatusChips(side, buffs, debuffs, seen, pushUniqueStatusChip);
  }
  if (typeof collectDebuffStatusChips === "function") {
    collectDebuffStatusChips(side, buffs, debuffs, seen, pushUniqueStatusChip);
  }

  if (side.slowDebuff > 0 && side.slowTimer > 0) {
    const pct = Math.round(side.slowDebuff * 100);
    pushUniqueStatusChip(debuffs, {
      id: "slow",
      icon: "🐌",
      value: pct,
      title: "Замедление",
      lines: [
        `+${pct}% к перезарядке предметов`,
        `Осталось ${side.slowTimer.toFixed(1)}с`,
      ],
    }, seen);
  }

  if (side.groundFire > 0) {
    pushUniqueStatusChip(debuffs, {
      id: "ground-fire",
      icon: "🔥",
      value: side.groundFire,
      title: "Огонь на поле",
      lines: [`${side.groundFire} урона каждую секунду`],
    }, seen);
  }

  if (battleState && typeof getFatigueDamageTakenMult === "function" && typeof isFatigueActive === "function") {
    if (isFatigueActive(battleState)) {
      const pct = Math.round((getFatigueDamageTakenMult(battleState) - 1) * 100);
      const activeSec = typeof getFatigueSecondsActive === "function"
        ? getFatigueSecondsActive(battleState)
        : 0;
      const lines = [`Входящий урон +${pct}%`];
      if (activeSec >= FATIGUE_HP_DRAIN_DELAY_AFTER_START) {
        lines.push(`−${FATIGUE_HP_DRAIN_PER_SEC} HP каждую секунду`);
      } else {
        const untilDrain = Math.max(0, FATIGUE_HP_DRAIN_DELAY_AFTER_START - activeSec);
        lines.push(`−${FATIGUE_HP_DRAIN_PER_SEC} HP/с через ${untilDrain.toFixed(0)}с`);
      }
      pushUniqueStatusChip(debuffs, {
        id: "arena-fatigue",
        icon: "⏳",
        value: pct,
        title: "Усталость арены",
        lines,
      }, seen);
    }
  }

  return { buffs, debuffs };
}

function computeCombatProfile(items, classId, displayName) {
  const cloned = cloneItemsForProfile(items);
  const side = createBattleSide(cloned, classId);
  const dmg = sumItemDamageValues(cloned);
  const status = collectPrepStatusEffects(side, cloned);

  return {
    name: displayName,
    hp: side.maxHp,
    hpCurrent: side.maxHp,
    hpMax: side.maxHp,
    hpDisplay: String(side.maxHp),
    damage: Math.round(dmg.physical * side.damageMult),
    armor: side.defense,
    magicDamage: Math.round(dmg.magical * side.magicDamageMult),
    attackSpeed: +(1 / Math.max(0.01, side.cooldownMult)).toFixed(1),
    critChance: Math.round(side.critChance * 100),
    luck: side.luck || 0,
    buffs: status.buffs,
    debuffs: status.debuffs,
    liveBattle: false,
  };
}

function computeCombatProfileFromBattleSide(side, classId, displayName, battleState = null) {
  const dmg = sumItemDamageValues(side.items);
  const status = collectBattleStatusEffects(side, side.items, battleState);

  return {
    name: displayName,
    hpCurrent: Math.ceil(side.hp),
    hpMax: side.maxHp,
    hpDisplay: `${Math.ceil(side.hp)}/${side.maxHp}`,
    stamina: side.stamina,
    staminaCurrent: side.stamina,
    staminaMax: side.maxStamina,
    staminaSpendFlash: side.staminaSpendFlash || 0,
    damage: Math.round(dmg.physical * side.damageMult),
    armor: side.defense,
    magicDamage: Math.round(dmg.magical * side.magicDamageMult),
    attackSpeed: +(1 / Math.max(0.01, side.cooldownMult)).toFixed(1),
    critChance: Math.round(side.critChance * 100),
    luck: side.luck || 0,
    buffs: status.buffs,
    debuffs: status.debuffs,
    liveBattle: true,
  };
}

function renderStatusChipHTML(chip, type) {
  const title = escapeProfileHtml(chip.title);
  const desc = escapeProfileHtml((chip.lines || []).join("\n"));
  return `<span class="status-chip status-chip-${type}" data-status-id="${escapeProfileHtml(chip.id)}" data-status-title="${title}" data-status-desc="${desc}" tabindex="0">${chip.icon}<span class="status-chip-value">${chip.value}</span></span>`;
}

function renderStatusSectionHTML(label, chips, type) {
  const inner = chips.length
    ? chips.map((chip) => renderStatusChipHTML(chip, type)).join("")
    : `<span class="status-empty">—</span>`;

  return `
    <div class="status-section">
      <div class="status-section-label">${label}</div>
      <div class="status-chips status-${type}">${inner}</div>
    </div>
  `;
}

function applyProfileIdentity(profile, classId, gold) {
  const cls = getClassById(classId);
  profile.classId = classId || null;
  profile.className = cls?.name || "Неизвестно";
  profile.classIcon = cls?.icon || "❓";
  profile.classIconSrc = cls?.iconSrc || null;
  profile.gold = typeof gold === "number" ? gold : 0;
  return profile;
}

function getBackpackPowerTier(score) {
  if (score < 45) return { label: "Слабый", className: "bp-tier-weak" };
  if (score < 90) return { label: "Средний", className: "bp-tier-mid" };
  if (score < 135) return { label: "Сильный", className: "bp-tier-strong" };
  return { label: "Элитный", className: "bp-tier-elite" };
}

function scoreItemBackpackPower(item, side) {
  const def = ITEM_CATALOG[item.itemId];
  if (!def || def.isContainer) return 0;

  const rt = item.runtime || {};
  const dup = rt.duplicateEfficiency ?? 1;
  const poisonEff = rt.poisonSourceEfficiency ?? 1;
  const blockEff = rt.blockSourceEfficiency ?? 1;
  const cd = Math.max(0.8, getEffectiveCooldown(item) || def.cooldown || 2.5);
  const pace = 2.2 / cd;

  let score = 0;
  (def.effects || []).forEach((effect) => {
    if (effect.trigger === "passive") {
      if (effect.type === "passiveDefense") score += (effect.value || 0) * 1.15 * dup;
      if (effect.type === "passiveMaxHp") score += (effect.value || 0) * 0.4 * dup;
      return;
    }

    switch (effect.type) {
      case "damage": {
        let avg = getEffectAverageDamage(effect, def) + (rt.damageBonus || 0);
        avg *= dup;
        const mult = effect.damageType === "magic" || effect.damageType === "fire"
          ? side.magicDamageMult
          : side.damageMult;
        score += avg * mult * pace * 3.2;
        break;
      }
      case "block": {
        const val = ((effect.value || 0) + (rt.blockBonus || 0)) * blockEff * dup;
        score += val * pace * 2.4;
        break;
      }
      case "heal": {
        const val = ((effect.value || 0) + (rt.healBonus || 0)) * dup;
        score += val * pace * 1.8;
        break;
      }
      case "poison": {
        const interval = effect.interval > 1 ? effect.interval : 1;
        const stacks = (effect.value || 1) + (rt.poisonBonus || 0);
        score += stacks * poisonEff * dup * (pace / interval) * 2.2;
        break;
      }
      case "groundFire":
        score += (effect.value || 2) * dup * pace * 1.5;
        break;
      case "slow":
        score += 4 * dup * pace;
        break;
      case "buffTimed":
        score += (effect.value || 0.1) * 100 * dup * pace * 0.35;
        break;
      default:
        break;
    }
  });

  score += (rt.activeSynergies?.length || 0) * 4;
  score += (def.cost || 0) * 0.12;
  return score;
}

/** Оценка мощности экипировки на столе (с синергиями и классом). */
function computeBackpackPower(containers, items, classId) {
  const battleItems = flattenContainersForBattle(containers, items);
  if (!battleItems.length) {
    return { score: 0, itemCount: 0, tier: getBackpackPowerTier(0) };
  }

  const cloned = cloneItemsForProfile(battleItems);
  applySynergyModifiers(cloned);
  const side = createBattleSide(cloned, classId);

  let score = 0;
  side.items.forEach((item) => {
    score += scoreItemBackpackPower(item, side);
  });

  score += side.defense * 1.1;
  score += Math.max(0, side.maxHp - 108) * 0.25;
  score += side.lifesteal * 40;
  score += side.critChance * 35;
  score += side.shieldBlockMult * 25;
  if (side.cooldownMult < 1) {
    score += (1 - side.cooldownMult) * 30;
  }

  const rounded = Math.round(score);
  return {
    score: rounded,
    itemCount: side.items.length,
    tier: getBackpackPowerTier(rounded),
  };
}

function renderProfileAvatarHTML(profile, team) {
  const className = escapeProfileHtml(profile.className || "—");
  const icon = profile.classIconSrc
    ? `<img class="profile-avatar-img" src="${escapeProfileHtml(profile.classIconSrc)}" alt="${className}" draggable="false">`
    : escapeProfileHtml(profile.classIcon || "❓");
  const gold = profile.gold ?? 0;
  const tooltipDesc = escapeProfileHtml(`💰 ${gold} золота`);

  return `
    <div class="profile-avatar profile-avatar-${team}"
         data-status-title="${className}"
         data-status-desc="${tooltipDesc}"
         tabindex="0"
         aria-label="${className}">${icon}</div>
  `;
}

function renderStatusChipsRowHTML(chips, type) {
  if (!chips.length) return `<span class="status-empty">—</span>`;
  return chips.map((chip) => renderStatusChipHTML(chip, type)).join("");
}

function statCompareClass(playerVal, enemyVal, higherIsBetter = true) {
  if (playerVal === enemyVal) return { player: "", enemy: "" };
  const playerWins = higherIsBetter ? playerVal > enemyVal : playerVal < enemyVal;
  return {
    player: playerWins ? "stat-val-strong" : (higherIsBetter && enemyVal > playerVal * 1.5 ? "stat-val-warn" : ""),
    enemy: !playerWins ? "stat-val-strong" : (higherIsBetter && playerVal > enemyVal * 1.5 ? "stat-val-danger" : ""),
  };
}

function renderHpBarHTML(current, max, team) {
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  return `<div class="stat-hp-bar"><div class="stat-hp-fill stat-hp-fill-${team}" style="width:${pct}%"></div></div>`;
}

function renderStaminaBarHTML(current, max, team, spendFlash = 0) {
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  const flashClass = spendFlash > 0 ? " stat-stamina-spending" : "";
  return `<div class="stat-stamina-bar${flashClass}"><div class="stat-stamina-fill stat-stamina-fill-${team}" style="width:${pct}%"></div></div>`;
}

function renderBackpackPowerStatHTML(bp, extraClass = "") {
  const data = bp || { score: 0, itemCount: 0, tier: { label: "—", className: "" } };
  const tier = data.tier || { label: "—", className: "" };
  const hint = data.itemCount
    ? `${data.itemCount} предм. на столе · синергии и класс учтены`
    : "Нет предметов на столе";
  return `
    <span class="stat-bp ${escapeProfileHtml(tier.className || "")} ${extraClass}" title="${escapeProfileHtml(hint)}">
      <span class="stat-bp-score">${data.score ?? 0}</span>
      <span class="stat-bp-tier">${escapeProfileHtml(tier.label || "—")}</span>
    </span>`;
}

function shortenBattleName(name, fallback) {
  const raw = (name || fallback || "").trim();
  if (!raw) return escapeProfileHtml((fallback || "—").toUpperCase());
  if (raw.length <= 8) return escapeProfileHtml(raw.toUpperCase());
  return escapeProfileHtml(`${raw.slice(0, 7).toUpperCase()}…`);
}

function battleStatRow(label, playerHtml, enemyHtml, rowClass = "") {
  return `<div class="battle-stat-row${rowClass ? ` ${rowClass}` : ""}">
    <div class="battle-stat-side battle-stat-side-player">${playerHtml}</div>
    <div class="battle-stat-label">${label}</div>
    <div class="battle-stat-side battle-stat-side-enemy">${enemyHtml}</div>
  </div>`;
}

function battleStatValRow(label, playerVal, enemyVal, playerCls = "", enemyCls = "") {
  return battleStatRow(
    label,
    `<span class="battle-stat-val stat-compare-player ${playerCls}">${playerVal}</span>`,
    `<span class="battle-stat-val stat-compare-enemy ${enemyCls}">${enemyVal}</span>`,
  );
}

function renderBattleStatsCompareHTML(playerProfile, enemyProfile, options = {}) {
  const { round = 1, maxRound = 16, liveBattle = false, itemCount = 7, buildOnly = false } = options;
  const playerName = shortenBattleName(playerProfile.name, "Игрок");
  const enemyName = shortenBattleName(enemyProfile.name, "ИИ");

  const pHp = playerProfile.hpCurrent ?? playerProfile.hp ?? 0;
  const eHp = enemyProfile.hpCurrent ?? 0;
  const pHpMax = playerProfile.hpMax ?? playerProfile.hp ?? 100;
  const eHpMax = enemyProfile.hpMax ?? 100;
  const pStamina = playerProfile.staminaCurrent ?? playerProfile.stamina ?? null;
  const eStamina = enemyProfile.staminaCurrent ?? enemyProfile.stamina ?? null;
  const pStaminaMax = playerProfile.staminaMax ?? 40;
  const eStaminaMax = enemyProfile.staminaMax ?? 40;
  const showStamina = liveBattle && pStamina != null && eStamina != null;
  const playerLosing = pHp < eHp;
  const enemyLosing = eHp < pHp;
  const hpRowClass = playerLosing ? "stat-row-player-losing" : enemyLosing ? "stat-row-enemy-losing" : "";

  const dmgCls = statCompareClass(playerProfile.damage, enemyProfile.damage);
  const armorCls = statCompareClass(playerProfile.armor, enemyProfile.armor);
  const speedCls = statCompareClass(playerProfile.attackSpeed, enemyProfile.attackSpeed);
  const magicCls = statCompareClass(playerProfile.magicDamage, enemyProfile.magicDamage);
  const critCls = statCompareClass(playerProfile.critChance, enemyProfile.critChance);
  const pBp = playerProfile.backpackPower || { score: 0, tier: { label: "—", className: "" } };
  const eBp = enemyProfile.backpackPower || { score: 0, tier: { label: "—", className: "" } };
  const bpCls = statCompareClass(pBp.score ?? 0, eBp.score ?? 0);

  const roundBadge = `<div class="stats-round-badge">Раунд ${Math.min(round, maxRound)} из ${maxRound}</div>`;
  const fatigueHint = (!buildOnly && !liveBattle && typeof getFatigueStartSec === "function" && typeof getFatiguePrepDescription === "function")
    ? `<div class="stats-fatigue-hint" title="${escapeProfileHtml(getFatiguePrepDescription(round, itemCount))}">⏳ ${escapeProfileHtml(getFatiguePrepDescription(round, itemCount))}</div>`
    : "";

  const hpPlayerHtml = liveBattle
    ? `${renderHpBarHTML(pHp, pHpMax, "player")}<span class="stat-hp-num">${Math.ceil(pHp)}</span>`
    : `<span class="stat-hp-num">${Math.ceil(pHp)}</span>`;
  const hpEnemyHtml = liveBattle
    ? `<span class="stat-hp-num">${Math.ceil(eHp)}</span>${renderHpBarHTML(eHp, eHpMax, "enemy")}`
    : `<span class="stat-hp-num">${Math.ceil(eHp)}</span>`;

  const hpRow = buildOnly ? "" : battleStatRow(
    "HP",
    `<div class="stat-compare-hp-cell stat-compare-player">${hpPlayerHtml}</div>`,
    `<div class="stat-compare-hp-cell stat-compare-enemy">${hpEnemyHtml}</div>`,
    `stat-compare-hp-row ${hpRowClass}`.trim(),
  );

  const staminaRow = buildOnly || !showStamina ? "" : battleStatRow(
    "⚡",
    `<div class="stat-compare-stamina-cell stat-stamina-cell-player stat-compare-player">
      <span class="stat-stamina-num">${Math.ceil(pStamina)}</span>
      ${renderStaminaBarHTML(pStamina, pStaminaMax, "player", playerProfile.staminaSpendFlash || 0)}
    </div>`,
    `<div class="stat-compare-stamina-cell stat-stamina-cell-enemy stat-compare-enemy">
      ${renderStaminaBarHTML(eStamina, eStaminaMax, "enemy", enemyProfile.staminaSpendFlash || 0)}
      <span class="stat-stamina-num">${Math.ceil(eStamina)}</span>
    </div>`,
    "stat-compare-stamina-row",
  );

  return `
    <div class="battle-stats-narrow">
      ${roundBadge}
      ${fatigueHint}
      <div class="battle-stats-matchup">
        <span class="stats-name stats-name-player">${playerName}</span>
        <span class="stats-vs-icon" aria-hidden="true">×</span>
        <span class="stats-name stats-name-enemy">${enemyName}</span>
      </div>
      <div class="battle-stats-rows">
        ${hpRow}
        ${staminaRow}
        ${battleStatValRow("Урон", formatStatNumber(playerProfile.damage), formatStatNumber(enemyProfile.damage), dmgCls.player, dmgCls.enemy)}
        ${battleStatValRow("Броня", formatStatNumber(playerProfile.armor), formatStatNumber(enemyProfile.armor), armorCls.player, armorCls.enemy)}
        ${battleStatValRow("Скор", playerProfile.attackSpeed, enemyProfile.attackSpeed, speedCls.player, speedCls.enemy)}
        ${battleStatValRow("Маги", formatStatNumber(playerProfile.magicDamage), formatStatNumber(enemyProfile.magicDamage), magicCls.player, magicCls.enemy)}
        ${battleStatValRow("Крит", `${playerProfile.critChance}%`, `${enemyProfile.critChance}%`, critCls.player, critCls.enemy)}
        ${battleStatRow(
    "рюкз",
    `<span class="battle-stat-val stat-compare-player ${bpCls.player}">${pBp.score ?? 0}</span>`,
    `<span class="battle-stat-val stat-compare-enemy ${bpCls.enemy}">${eBp.score ?? 0}</span>`,
    "stat-compare-bp-row",
  )}
      </div>
      <div class="battle-stats-section battle-stats-section-buff${liveBattle || buildOnly ? " battle-stats-section-hidden" : ""}">
        <div class="battle-stats-section-title battle-stats-section-title-buff">БАФФ</div>
        <div class="battle-stats-effects">
          <div class="stats-effects-col stats-col-player">
            <div class="status-chips status-buffs">${renderStatusChipsRowHTML(playerProfile.buffs || [], "buffs")}</div>
          </div>
          <div class="stats-effects-col stats-col-enemy">
            <div class="status-chips status-buffs">${renderStatusChipsRowHTML(enemyProfile.buffs || [], "buffs")}</div>
          </div>
        </div>
      </div>
      <div class="battle-stats-section battle-stats-section-debuff${liveBattle || buildOnly ? " battle-stats-section-hidden" : ""}">
        <div class="battle-stats-section-title battle-stats-section-title-debuff">${liveBattle ? "Дебаффы" : "ДЕБА"}</div>
        <div class="battle-stats-effects">
          <div class="stats-effects-col stats-col-player">
            <div class="status-chips status-debuffs">${renderStatusChipsRowHTML(playerProfile.debuffs || [], "debuffs")}</div>
          </div>
          <div class="stats-effects-col stats-col-enemy">
            <div class="status-chips status-debuffs">${renderStatusChipsRowHTML(enemyProfile.debuffs || [], "debuffs")}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProfileCardHTML(profile, team = "player") {
  const buffsLabel = profile.liveBattle ? "Баффы" : "Положительные эффекты";
  const debuffsLabel = profile.liveBattle ? "Дебаффы" : "Отрицательные эффекты";
  const displayName = escapeProfileHtml(profile.name || "");

  return `
    <div class="profile-card-banner profile-card-banner-${team}">${displayName}</div>
    <div class="profile-details">
      <div class="profile-stat">❤️ HP: ${profile.hpDisplay}</div>
      <div class="profile-stat">⚔ Урон: ${formatStatNumber(profile.damage)}</div>
      <div class="profile-stat">🛡 Броня: ${formatStatNumber(profile.armor)}</div>
      <div class="profile-stat">✨ Магия: ${formatStatNumber(profile.magicDamage)}</div>
      <div class="profile-stat">⚡ Скорость: ${profile.attackSpeed}</div>
      <div class="profile-stat">💥 Крит: ${profile.critChance}%</div>
      ${profile.luck > 0 ? `<div class="profile-stat">🍀 Удача: ${profile.luck}</div>` : ""}
      ${renderStatusSectionHTML(buffsLabel, profile.buffs || [], "buffs")}
      ${renderStatusSectionHTML(debuffsLabel, profile.debuffs || [], "debuffs")}
    </div>
  `;
}

const PROFILE_TOOLTIP_PANEL_IDS = [
  "battle-stats-panel",
  "player-avatar-panel",
  "enemy-avatar-panel",
];

const PROFILE_TOOLTIP_TARGET_SELECTOR = [
  ".status-chip",
  ".profile-avatar",
  ".avatar-bead-debuff",
  ".avatar-bead-positive",
  ".avatar-damage-stack",
  ".avatar-benefit-stack",
  ".avatar-dot-stack",
].join(", ");

function findProfileTooltipTarget(node) {
  return node?.closest?.(PROFILE_TOOLTIP_TARGET_SELECTOR) || null;
}

function bindProfileStatusTooltips() {
  PROFILE_TOOLTIP_PANEL_IDS.forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel || panel.dataset.statusTooltipsBound) return;
    panel.dataset.statusTooltipsBound = "1";

    panel.addEventListener("mouseover", (e) => {
      if (typeof isTouchUi === "function" && isTouchUi()) return;
      const target = findProfileTooltipTarget(e.target);
      if (!target) return;
      showProfileStatusTooltip(e, target);
    });

    panel.addEventListener("mousemove", (e) => {
      if (findProfileTooltipTarget(e.target)) moveSidebarTooltip(e);
    });

    panel.addEventListener("mouseout", (e) => {
      const target = findProfileTooltipTarget(e.target);
      if (!target) return;
      const next = e.relatedTarget;
      if (next && target.contains(next)) return;
      hideSidebarTooltip();
    });

    panel.addEventListener("click", (e) => {
      if (typeof isTouchUi !== "function" || !isTouchUi()) return;
      const target = findProfileTooltipTarget(e.target);
      if (!target) {
        hideSidebarTooltip();
        return;
      }
      e.stopPropagation();
      showProfileStatusTooltip(e, target);
    });

    panel.addEventListener("keydown", (e) => {
      const target = findProfileTooltipTarget(e.target);
      if (!target) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showProfileStatusTooltip(e, target);
      }
    });

    panel.addEventListener("animationend", (e) => {
      if (e.target.classList?.contains("field-avatar-slot") && e.animationName === "profile-avatar-hit-shake") {
        e.target.classList.remove("profile-avatar-hit-shake");
        e.target.style.removeProperty("--hit-shake-x");
        e.target.style.removeProperty("--hit-shake-y");
        e.target.style.removeProperty("--hit-shake-ms");
      }
      if (e.target.classList?.contains("profile-avatar-img") && e.animationName.startsWith("profile-avatar-crit-flip")) {
        clearAvatarFlipBusy(e.target);
        e.target.classList.remove("profile-avatar-crit-flip");
        e.target.style.removeProperty("--crit-flip-ms");
      }
    });

    panel.addEventListener("animationcancel", (e) => {
      if (e.target.classList?.contains("profile-avatar-img") && e.animationName.startsWith("profile-avatar-crit-flip")) {
        clearAvatarFlipBusy(e.target);
      }
    });
  });

  if (!document.documentElement.dataset.battleStackTouchDismissBound) {
    document.documentElement.dataset.battleStackTouchDismissBound = "1";
    document.addEventListener("click", (e) => {
      if (typeof isTouchUi !== "function" || !isTouchUi()) return;
      if (e.target.closest("#sidebar-tooltip")) return;
      if (findProfileTooltipTarget(e.target)) return;
      hideSidebarTooltip();
    });
  }
}

function getProfileAvatarElements(team) {
  const avatarId = team === "player" ? "player-avatar-panel" : "enemy-avatar-panel";
  const panel = document.getElementById(avatarId);
  if (!panel) return { slot: null, wrap: null, img: null };
  return {
    slot: panel.querySelector(".field-avatar-slot"),
    wrap: panel.querySelector(".profile-avatar"),
    img: panel.querySelector(".profile-avatar-img"),
  };
}

const avatarFlipState = {
  player: { pending: 0, busy: false },
  enemy: { pending: 0, busy: false },
};

const avatarFatigueMirrorState = {
  player: { lockedUntil: 0, revertTimer: null, held: false, flipDone: null },
  enemy: { lockedUntil: 0, revertTimer: null, held: false, flipDone: null },
};

function randomMirrorGapMs() {
  return 1000 + Math.floor(Math.random() * 4001);
}

function restartAvatarReaction(el, className) {
  if (!el) return;
  el.classList.remove(className);
  el.getAnimations?.().forEach((anim) => anim.cancel());
  void el.offsetWidth;
  el.classList.add(className);
}

function clearAvatarFlipBusy(img) {
  if (!img) return;
  const team = img.dataset.avatarFlipTeam;
  if (team && avatarFlipState[team]) {
    avatarFlipState[team].busy = false;
    if (img.dataset.avatarFlipTimer) {
      window.clearTimeout(Number(img.dataset.avatarFlipTimer));
      img.removeAttribute("data-avatar-flip-timer");
    }
  }
  if (team && img.dataset.avatarFlipSource === "fatigue") {
    finishFatigueMirrorAction(team);
  }
  img.removeAttribute("data-avatar-flip-team");
  img.removeAttribute("data-avatar-flip-source");
}

function finishFatigueMirrorAction(team) {
  const state = avatarFatigueMirrorState[team];
  if (!state) return;
  if (state.flipDone) {
    state.flipDone();
    state.flipDone = null;
    return;
  }
  if (state.lockedUntil === Number.MAX_SAFE_INTEGER) {
    state.lockedUntil = Date.now() + randomMirrorGapMs();
  }
}

function startAvatarMirrorFlipAnimation(team, { source = "dot", onComplete = null } = {}) {
  const { img } = getProfileAvatarElements(team);
  if (!img) return false;

  if (source === "dot") {
    const state = avatarFlipState[team];
    if (state?.busy) return false;
    state.busy = true;
  }

  const durationMs = 200 + Math.floor(Math.random() * 801);
  img.dataset.avatarFlipTeam = team;
  img.dataset.avatarFlipSource = source;
  img.style.setProperty("--crit-flip-ms", `${durationMs}ms`);
  img.dataset.avatarFlipTimer = String(window.setTimeout(() => clearAvatarFlipBusy(img), durationMs + 48));

  if (source === "fatigue") {
    avatarFatigueMirrorState[team].flipDone = onComplete;
  }

  restartAvatarReaction(img, "profile-avatar-crit-flip");
  return true;
}

function triggerProfileAvatarHitShake(team) {
  const { slot } = getProfileAvatarElements(team);
  if (!slot) return;

  const shakeX = uiPx(Math.round((Math.random() - 0.5) * 10));
  const shakeY = uiPx(Math.round((Math.random() - 0.5) * 8));
  const durationMs = 80 + Math.floor(Math.random() * 71);

  slot.style.setProperty("--hit-shake-x", `${shakeX}px`);
  slot.style.setProperty("--hit-shake-y", `${shakeY}px`);
  slot.style.setProperty("--hit-shake-ms", `${durationMs}ms`);
  restartAvatarReaction(slot, "profile-avatar-hit-shake");
}

function triggerProfileAvatarCritFlip(team) {
  if (team !== "player" && team !== "enemy") return;

  const state = avatarFlipState[team];
  state.pending += 1;
  if (state.pending % 2 === 0) return;

  startAvatarMirrorFlipAnimation(team, { source: "dot" });
}

function triggerProfileAvatarFatigueMirror(team) {
  if (team !== "player" && team !== "enemy") return;

  const state = avatarFatigueMirrorState[team];
  const now = Date.now();
  if (now < state.lockedUntil || state.held) return;

  const { img } = getProfileAvatarElements(team);
  if (!img) return;

  state.lockedUntil = Number.MAX_SAFE_INTEGER;

  if (Math.random() < 0.5) {
    const started = startAvatarMirrorFlipAnimation(team, {
      source: "fatigue",
      onComplete: () => {
        state.lockedUntil = Date.now() + randomMirrorGapMs();
      },
    });
    if (!started) state.lockedUntil = Date.now() + randomMirrorGapMs();
    return;
  }

  state.held = true;
  img.classList.add("profile-avatar-mirror-held");
  const holdMs = randomMirrorGapMs();
  state.revertTimer = window.setTimeout(() => {
    img.classList.remove("profile-avatar-mirror-held");
    state.held = false;
    state.revertTimer = null;
    state.lockedUntil = Date.now() + randomMirrorGapMs();
  }, holdMs);
}

function showProfileStatusTooltip(e, chip) {
  const el = document.getElementById("sidebar-tooltip");
  if (!el) return;

  const title = chip.dataset.statusTitle || chip.dataset.stackTitle || "";
  const desc = chip.dataset.statusDesc || chip.dataset.stackDesc || "";
  el.classList.remove("synergy-tooltip");
  el.innerHTML = [
    `<div class="tt-line tt-title">${title}</div>`,
    ...desc.split("\n").filter(Boolean).map((line) => `<div class="tt-line tt-sub">${line}</div>`),
  ].join("");
  el.classList.remove("hidden");
  moveSidebarTooltip(e);
}
