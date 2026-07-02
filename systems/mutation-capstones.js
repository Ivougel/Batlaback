/**
 * Капстуны мутаций R16 — правила боя (~5–8% билда).
 * @see docs/mutations-gdd.md
 */

const DIVERSITY_MUTATION_IDS = new Set([
  "w_veteran", "r_rogue", "m_sage", "p_hermit",
]);

const CAPSTONE_INIT = {
  w_guardian: { reflectCd: 0, reflectTimer: 0, reflectInterval: 8 },
  w_berserk: { berserkActive: false },
  w_crusader: { crusaderHolyCd: 0 },
  w_duelist: { duelistTimer: 0, duelistInterval: 5, duelistReady: true },
  w_juggernaut: { juggernautIdle: 0, juggernautBlockCap: 10, juggernautBlockGiven: 0 },
  w_gladiator: { gladiatorThornChance: 0.3 },
  w_breaker: { breakerHitCount: 0 },
  r_assassin: { assassinBurstCd: 0, assassinBurstMult: 1.35 },
  r_bard: { bardTimer: 0, bardInterval: 7 },
  r_plague: { plagueBleedReady: true },
  r_trickster: { tricksterTimer: 0, tricksterInterval: 9 },
  r_shadow: { shadowTimer: 0, shadowDuration: 10, shadowDodgeBonus: 0.15 },
  r_nightblade: { nightbladeLifesteal: 0.08 },
  r_scout: { scoutPeriodicMult: 1.1 },
  m_pyro: { pyroFireTicks: 0 },
  m_cryo: { cryoTimer: 0, cryoSlowApplied: false },
  m_arcanist: { arcanistManaCapBonus: 2 },
  m_elementalist: { elementalistToggle: 0 },
  m_battlemage: { battlemageMeleeWindow: 0, battlemageMeleeMult: 1.2 },
  m_chaos: { chaosProcChance: 0.1 },
  m_seer: { seerTimer: 0, seerInterval: 8, seerWardReady: false },
  p_paladin: { paladinBlockConvert: 0.12, paladinHolyBurstReady: false },
  p_discipline: { disciplineTimer: 0, disciplineInterval: 5 },
  p_zrecrela: { hymnTimer: 0, hymnInterval: 6 },
  p_oracle: { oracleHealCap: 0.9 },
  p_plague: { plagueHolyPoison: 0.5 },
  p_hierophant: { hierophantHolyMult: 1.15 },
  p_inquisitor: { inquisitorDebuffMult: 1.1 },
  w_veteran: {},
  r_rogue: {},
  m_sage: {},
  p_hermit: {},
};

function capstoneLog(state, team, message) {
  if (!state || typeof pushBattleLog !== "function") return;
  const label = typeof battleTeamLabel === "function" ? battleTeamLabel(team) : team;
  pushBattleLog(state, {
    actor: team,
    type: "buff",
    message: `${label} · ${message}`,
  });
}

function getCapstoneFoe(state, team) {
  return team === "player" ? state.enemy : state.player;
}

function countLoadoutFamilies(side) {
  if (typeof collectLoadoutTagCounts !== "function" || typeof countTagFamiliesFromCounts !== "function") {
    return 0;
  }
  const doll = typeof deriveDollFromItems === "function" ? deriveDollFromItems(side.items || []) : { doll: {} };
  const dollIds = Object.values(doll.doll || {}).filter(Boolean);
  const counts = collectLoadoutTagCounts(side.items || [], dollIds);
  return countTagFamiliesFromCounts(counts);
}

function applyDiversityCapstone(side, mutationId) {
  const families = countLoadoutFamilies(side);
  if (families < 4) return;
  let mult = 0;
  if (mutationId === "m_sage") {
    mult = Math.min(0.04, families * 0.005);
    side.magicDamageMult *= 1 + mult;
  } else if (mutationId === "p_hermit") {
    mult = Math.min(0.05, families * 0.01);
    side.damageMult *= 1 + mult;
    side.magicDamageMult *= 1 + mult;
  } else {
    mult = Math.min(0.05, families * 0.01);
    side.damageMult *= 1 + mult;
    side.magicDamageMult *= 1 + mult;
  }
  side.mutationRuntime.diversityMult = mult;
}

function applyMutationCapstoneBattleStart(side) {
  const id = side.mutationId;
  if (!id) return;
  const rt = side.mutationRuntime || {};

  if (id === "m_arcanist" && typeof addSideStack === "function") {
    addSideStack(side, "mana", rt.arcanistManaCapBonus || 2);
  }
  if (id === "r_rogue") {
    side.mutationRuntime.rogueGoldBonus = true;
  }
  if (id === "r_shadow") {
    rt.shadowTimer = 0;
    side.mutationRuntime = rt;
  }
}

function initMutationCapstoneRuntime(side, formId, mutationId) {
  if (!side) return;
  side.mutationFormId = formId || null;
  side.mutationId = mutationId || null;
  side.mutationRuntime = {};

  if (formId && !mutationId) {
    side.cooldownMult *= 0.98;
    return;
  }
  if (!mutationId) return;

  const base = CAPSTONE_INIT[mutationId];
  if (base) Object.assign(side.mutationRuntime, JSON.parse(JSON.stringify(base)));

  if (DIVERSITY_MUTATION_IDS.has(mutationId)) {
    applyDiversityCapstone(side, mutationId);
  }
}

function countFoeDebuffStacks(foe) {
  if (!foe) return 0;
  let n = 0;
  if (foe.poisonStacks > 0) n += 1;
  if (foe.slowDebuff > 0) n += 1;
  if (typeof getSideStack === "function") {
    ["bleed", "burn", "cold"].forEach((stack) => {
      if (getSideStack(foe, stack) > 0) n += 1;
    });
  }
  return n;
}

function stealRandomPositiveStack(state, from, to, team) {
  if (!from?.stacks || !to || typeof getSideStack !== "function" || typeof addSideStack !== "function") {
    return false;
  }
  const candidates = Object.keys(from.stacks).filter((k) => getSideStack(from, k) > 0);
  if (!candidates.length) return false;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const amount = Math.min(1, getSideStack(from, pick));
  if (amount <= 0) return false;
  addSideStack(from, pick, -amount);
  addSideStack(to, pick, amount);
  capstoneLog(state, team, `Плут: украден стак «${pick}»`);
  return true;
}

function modifyMutationCapstoneDamage(state, attackerTeam, attackerSide, target, targetTeam, hpDmg, effect) {
  if (!hpDmg || hpDmg <= 0 || !attackerSide?.mutationId) return hpDmg;
  const rt = attackerSide.mutationRuntime || {};
  const id = attackerSide.mutationId;
  let dmg = hpDmg;

  if (id === "r_assassin" && (rt.assassinBurstCd || 0) <= 0) {
    const foePoison = target?.poisonStacks || 0;
    if (foePoison >= 3) {
      dmg = Math.floor(dmg * (rt.assassinBurstMult || 1.35));
      rt.assassinBurstCd = 6;
      capstoneLog(state, attackerTeam, "Ассасин: ядовитый всплеск");
    }
  }

  if (id === "w_duelist" && rt.duelistReady) {
    dmg = Math.floor(dmg * 1.25);
    rt.duelistReady = false;
    rt.duelistTimer = 0;
    capstoneLog(state, attackerTeam, "Дуэлянт: первый удар");
  }

  if (id === "w_berserk" && !rt.berserkActive && attackerSide.hp <= attackerSide.maxHp * 0.5) {
    rt.berserkActive = true;
    attackerSide.damageMult *= 1.12;
    capstoneLog(state, attackerTeam, "Берсерк: ярость");
  }

  if (id === "p_inquisitor" && countFoeDebuffStacks(target) >= 2) {
    const dtype = effect?.damageType;
    if (dtype === "holy" || dtype === "fire" || dtype === "magic") {
      dmg = Math.floor(dmg * (rt.inquisitorDebuffMult || 1.1));
    }
  }

  if (id === "m_battlemage" && (rt.battlemageMeleeWindow || 0) > 0) {
    const dtype = effect?.damageType;
    if (!dtype || dtype === "physical" || dtype === "melee") {
      dmg = Math.floor(dmg * (rt.battlemageMeleeMult || 1.2));
    }
  }

  if (id === "m_elementalist") {
    const fireTurn = (rt.elementalistToggle || 0) % 2 === 0;
    const dtype = effect?.damageType;
    if (fireTurn && dtype === "fire") dmg = Math.floor(dmg * 1.08);
    if (!fireTurn && dtype === "cold") dmg = Math.floor(dmg * 1.08);
    rt.elementalistToggle = (rt.elementalistToggle || 0) + 1;
  }

  if (id === "p_hierophant") {
    const dtype = effect?.damageType;
    if (dtype === "holy") dmg = Math.floor(dmg * (rt.hierophantHolyMult || 1.15));
  }

  if (id === "r_shadow" && (rt.shadowTimer || 0) < (rt.shadowDuration || 10)) {
    dmg = Math.floor(dmg * (1 + (rt.shadowDodgeBonus || 0.15) * 0.35));
  }

  return dmg;
}

function onMutationCapstoneDamageDealt(state, attackerTeam, attackerSide, target, hpDmg, effect) {
  if (!hpDmg || hpDmg <= 0 || !attackerSide?.mutationId) return;
  const rt = attackerSide.mutationRuntime || {};
  const id = attackerSide.mutationId;

  if (id === "p_paladin" && rt.paladinBlockConvert > 0) {
    const gain = Math.max(1, Math.floor(hpDmg * rt.paladinBlockConvert));
    attackerSide.block = (attackerSide.block || 0) + gain;
    if (attackerSide.block > 30) rt.paladinHolyBurstReady = true;
  }

  if (id === "w_breaker") {
    rt.breakerHitCount = (rt.breakerHitCount || 0) + 1;
    if (rt.breakerHitCount % 4 === 0 && target) {
      target.timedBuffs = target.timedBuffs || [];
      target.timedBuffs.push({ stat: "damageTaken", value: 0.1, remaining: 3 });
      capstoneLog(state, attackerTeam, "Сломатель: пробитие блока");
    }
  }

  if (id === "m_battlemage") {
    const dtype = effect?.damageType;
    if (dtype === "magic" || dtype === "fire" || dtype === "cold") {
      rt.battlemageMeleeWindow = 2;
    }
  }

  if (id === "r_nightblade" && target?.poisonStacks > 0) {
    const heal = Math.max(1, Math.floor(hpDmg * (rt.nightbladeLifesteal || 0.08)));
    attackerSide.hp = Math.min(attackerSide.maxHp, attackerSide.hp + heal);
  }
}

function onMutationCapstoneDamageTaken(state, defenderTeam, defender, attacker, hpDmg) {
  if (!hpDmg || hpDmg <= 0 || !defender?.mutationId) return;
  const rt = defender.mutationRuntime || {};
  const id = defender.mutationId;

  if (id === "w_gladiator" && attacker && Math.random() < (rt.gladiatorThornChance || 0.3)) {
    const thorn = Math.max(1, Math.floor(hpDmg * 0.5));
    attacker.hp = Math.max(0, attacker.hp - thorn);
    capstoneLog(state, defenderTeam, "Гладиатор: шипы");
  }

  if (id === "w_guardian" && (defender.block || 0) > 25) {
    if ((rt.reflectTimer || 0) <= 0 && attacker) {
      const reflect = Math.max(1, Math.floor(hpDmg * 0.2));
      attacker.hp = Math.max(0, attacker.hp - reflect);
      rt.reflectTimer = rt.reflectInterval || 8;
      capstoneLog(state, defenderTeam, "Страж: отражение");
    }
  }

  if (id === "w_berserk" && rt.berserkActive) {
    defender.hp = Math.min(defender.maxHp, defender.hp + Math.floor(hpDmg * 0.08));
  }
}

function onMutationCapstoneFireDamage(state, attackerTeam, attackerSide, hpDmg) {
  if (!hpDmg || !attackerSide?.mutationId) return;
  if (attackerSide.mutationId !== "m_pyro") return;
  const rt = attackerSide.mutationRuntime || {};
  rt.pyroFireTicks = (rt.pyroFireTicks || 0) + 1;
  if (rt.pyroFireTicks % 5 === 0 && typeof addSideStack === "function") {
    addSideStack(attackerSide, "heat", 1);
    capstoneLog(state, attackerTeam, "Пиромант: жар");
  }
}

function tickMutationCapstonesImpl(state, dt) {
  if (!state || state.finished) return;

  [
    { self: state.player, team: "player" },
    { self: state.enemy, team: "enemy" },
  ].forEach(({ self, team }) => {
    const rt = self.mutationRuntime;
    if (!rt || !self.mutationId) return;
    const foe = getCapstoneFoe(state, team);
    const id = self.mutationId;

    if (rt.assassinBurstCd > 0) rt.assassinBurstCd = Math.max(0, rt.assassinBurstCd - dt);
    if (rt.reflectTimer > 0) rt.reflectTimer = Math.max(0, rt.reflectTimer - dt);
    if (rt.battlemageMeleeWindow > 0) rt.battlemageMeleeWindow = Math.max(0, rt.battlemageMeleeWindow - dt);
    if (id === "r_shadow") rt.shadowTimer = Math.min((rt.shadowDuration || 10) + 1, (rt.shadowTimer || 0) + dt);

    if (id === "w_duelist" && !rt.duelistReady) {
      rt.duelistTimer = (rt.duelistTimer || 0) + dt;
      if (rt.duelistTimer >= (rt.duelistInterval || 5)) rt.duelistReady = true;
    }

    if (id === "w_juggernaut" && rt.juggernautBlockGiven < (rt.juggernautBlockCap || 10)) {
      rt.juggernautIdle = (rt.juggernautIdle || 0) + dt;
      if (rt.juggernautIdle >= 2) {
        rt.juggernautIdle = 0;
        self.block = (self.block || 0) + 2;
        rt.juggernautBlockGiven += 2;
      }
    }

    if (id === "p_zrecrela" && rt.hymnInterval > 0) {
      rt.hymnTimer = (rt.hymnTimer || 0) + dt;
      if (rt.hymnTimer >= rt.hymnInterval) {
        rt.hymnTimer = 0;
        if (self.poisonStacks > 0) self.poisonStacks = Math.max(0, self.poisonStacks - 1);
        if (foe.stamina != null) foe.stamina = Math.max(0, foe.stamina - 1);
        capstoneLog(state, team, "ЖРЕЦИЛА: гимн");
      }
    }

    if (id === "r_bard" && rt.bardInterval > 0) {
      rt.bardTimer = (rt.bardTimer || 0) + dt;
      if (rt.bardTimer >= rt.bardInterval) {
        rt.bardTimer = 0;
        self.block = (self.block || 0) + 8;
        if (foe.stamina != null) foe.stamina = Math.max(0, foe.stamina - 1);
        capstoneLog(state, team, "Бард: гимн");
      }
    }

    if (id === "r_trickster" && rt.tricksterInterval > 0) {
      rt.tricksterTimer = (rt.tricksterTimer || 0) + dt;
      if (rt.tricksterTimer >= rt.tricksterInterval) {
        rt.tricksterTimer = 0;
        stealRandomPositiveStack(state, foe, self, team);
      }
    }

    if (id === "p_discipline" && rt.disciplineInterval > 0) {
      rt.disciplineTimer = (rt.disciplineTimer || 0) + dt;
      if (rt.disciplineTimer >= rt.disciplineInterval) {
        rt.disciplineTimer = 0;
        if (typeof addSideStack === "function") addSideStack(foe, "repentance", 1, 3);
        capstoneLog(state, team, "Дисциплина: покаяние");
      }
    }

    if (id === "m_seer" && rt.seerInterval > 0) {
      rt.seerTimer = (rt.seerTimer || 0) + dt;
      if (rt.seerTimer >= rt.seerInterval) {
        rt.seerTimer = 0;
        rt.seerWardReady = true;
        capstoneLog(state, team, "Провидец: предсказание");
      }
    }

    if (id === "m_cryo" && !rt.cryoSlowApplied && foe && typeof getSideStack === "function") {
      if (getSideStack(foe, "cold") >= 4) {
        foe.tagCooldownMult = (foe.tagCooldownMult || 1) * 1.2;
        rt.cryoSlowApplied = true;
        capstoneLog(state, team, "Криомант: сдерживание");
      }
    }

    if (id === "m_chaos" && Math.random() < (rt.chaosProcChance || 0.1) * dt) {
      const roll = Math.random();
      if (roll < 0.25) self.block = (self.block || 0) + 5;
      else if (roll < 0.5) self.hp = Math.min(self.maxHp, self.hp + 4);
      else if (roll < 0.75 && typeof addSideStack === "function") addSideStack(self, "empower", 1);
      capstoneLog(state, team, "Хаос: случайный дар");
    }
  });
}

function applyMutationMilestoneCapstones(side, formId, mutationId) {
  initMutationCapstoneRuntime(side, formId, mutationId);
  applyMutationCapstoneBattleStart(side);
}
