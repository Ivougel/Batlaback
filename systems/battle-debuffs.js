/**
 * Дебаффы, оглушение, неуязвимость, перерождение.
 */

function countSideDebuffs(side) {
  if (!side) return 0;
  let count = 0;
  if (side.poisonStacks > 0) count += side.poisonStacks;
  if (side.slowDebuff > 0 && side.slowTimer > 0) count += 1;
  if (side.groundFire > 0) count += 1;
  if (side.stunTimer > 0) count += 1;
  return count;
}

function cleanseSideDebuffs(side, count = 1) {
  let left = Math.max(0, Math.floor(Number(count) || 0));
  if (!side || left <= 0) return 0;
  let cleaned = 0;

  if (side.poisonStacks > 0 && left > 0) {
    const removed = Math.min(side.poisonStacks, left);
    side.poisonStacks -= removed;
    left -= removed;
    cleaned += removed;
  }
  if (side.slowTimer > 0 && left > 0) {
    side.slowDebuff = 0;
    side.slowTimer = 0;
    left -= 1;
    cleaned += 1;
  }
  if (side.groundFire > 0 && left > 0) {
    side.groundFire = 0;
    side.groundFireTimer = 0;
    left -= 1;
    cleaned += 1;
  }
  return cleaned;
}

function isSideStunned(side) {
  return (side?.stunTimer || 0) > 0;
}

function applyStunToSide(side, duration = 0.5) {
  if (!side) return false;
  const dur = Math.max(0.1, Number(duration) || 0.5);
  side.stunTimer = Math.max(side.stunTimer || 0, dur);
  return true;
}

function isSideInvulnerable(side) {
  return (side?.invulnerableTimer || 0) > 0;
}

function grantSideInvulnerability(side, duration = 2) {
  if (!side) return;
  side.invulnerableTimer = Math.max(side.invulnerableTimer || 0, Number(duration) || 2);
}

function setupRevive(side, hpRatio = 0.5, invuln = 2) {
  if (!side) return;
  side.reviveCharges = (side.reviveCharges || 0) + 1;
  side.reviveHpRatio = Number(hpRatio) || 0.5;
  side.reviveInvuln = Number(invuln) || 2;
}

function tryReviveSide(side, state, team, sourceLabel = "Перерождение") {
  if (!side || (side.reviveCharges || 0) <= 0) return false;
  side.reviveCharges -= 1;
  side.hp = Math.max(1, Math.floor(side.maxHp * (side.reviveHpRatio || 0.5)));
  grantSideInvulnerability(side, side.reviveInvuln || 2);
  if (typeof applyOnReviveItemEffects === "function") {
    const foe = team === "player" ? state?.enemy : state?.player;
    applyOnReviveItemEffects(state, side, foe, team);
  }
  if (state) {
    pushBattleLog(state, {
      actor: team,
      type: "heal",
      source: sourceLabel,
      message: `${battleTeamLabel(team)}: ${sourceLabel} — ${Math.ceil(side.hp)} HP`,
    });
    queueHitAnimation(state, null, team, "🔄", "#3fb950");
  }
  return true;
}

function getFoeDebuffDamageBonus(foe, perDebuff = 0.5) {
  return Math.floor(countSideDebuffs(foe) * (Number(perDebuff) || 0.5));
}

function getTagDamageBonus(side, tag, perItem = 1, sourceItem = null) {
  if (!side || !tag) return 0;
  let matched = (side.items || []).filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return def && !def.isContainer && def.tags?.includes(tag);
  });
  if (sourceItem && typeof getAdjacentItems === "function") {
    const neighbors = getAdjacentItems(side.items, sourceItem);
    const neighborUids = new Set([...neighbors.keys()]);
    matched = matched.filter((item) => neighborUids.has(item.uid));
  }
  return Math.floor(matched.length * (Number(perItem) || 1));
}

function stealFoeWeaponDamage(foe, amount = 1) {
  if (!foe?.items) return 0;
  let stolen = 0;
  foe.items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    if (!def?.tags?.includes("weapon")) return;
    const rt = item.runtime || {};
    const bonus = rt.damageBonus || 0;
    if (bonus <= 0) return;
    const take = Math.min(bonus, Number(amount) || 1);
    rt.damageBonus = bonus - take;
    item.runtime = rt;
    stolen += take;
  });
  return stolen;
}

function collectDebuffStatusChips(side, buffs, debuffs, seen, pushFn) {
  if (!side) return;
  if (side.stunTimer > 0) {
    pushFn(debuffs, {
      id: "stun",
      icon: "💫",
      value: Math.ceil(side.stunTimer * 10) / 10,
      title: "Оглушение",
      lines: [`Предметы не активируются ещё ${side.stunTimer.toFixed(1)}с`],
    }, seen);
  }
  if (side.invulnerableTimer > 0) {
    pushFn(buffs, {
      id: "invulnerable",
      icon: "✨",
      value: Math.ceil(side.invulnerableTimer * 10) / 10,
      title: "Неуязвимость",
      lines: [`Иммунитет к урону ещё ${side.invulnerableTimer.toFixed(1)}с`],
    }, seen);
  }
  if (side.reviveCharges > 0) {
    pushFn(buffs, {
      id: "revive-ready",
      icon: "🔄",
      value: side.reviveCharges,
      title: "Перерождение",
      lines: [`Осталось ${side.reviveCharges} перерождений`],
    }, seen);
  }
  if ((side.hearts || 0) > 0) {
    pushFn(buffs, {
      id: "hearts",
      icon: "💖",
      value: side.hearts,
      title: "Сердца",
      lines: [`Накоплено ${side.hearts} сердец`],
    }, seen);
  }
}
