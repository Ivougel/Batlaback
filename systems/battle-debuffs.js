// Transpiled from TypeScript — npm run compile:ts

function countSideDebuffs(side) {
  if (!side) return 0;
  let count = 0;
  if ((side.poisonStacks || 0) > 0) count += side.poisonStacks || 0;
  if ((side.slowDebuff || 0) > 0 && (side.slowTimer || 0) > 0) count += 1;
  if ((side.groundFire || 0) > 0) count += 1;
  if ((side.stunTimer || 0) > 0) count += 1;
  return count;
}
function cleanseSideDebuffs(side, count = 1) {
  let left = Math.max(0, Math.floor(Number(count) || 0));
  if (!side || left <= 0) return 0;
  let cleaned = 0;
  if ((side.poisonStacks || 0) > 0 && left > 0) {
    const removed = Math.min(side.poisonStacks || 0, left);
    side.poisonStacks = (side.poisonStacks || 0) - removed;
    left -= removed;
    cleaned += removed;
  }
  if ((side.slowTimer || 0) > 0 && left > 0) {
    side.slowDebuff = 0;
    side.slowTimer = 0;
    left -= 1;
    cleaned += 1;
  }
  if ((side.groundFire || 0) > 0 && left > 0) {
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
function tryReviveSide(side, state, team, sourceLabel = "\u041F\u0435\u0440\u0435\u0440\u043E\u0436\u0434\u0435\u043D\u0438\u0435") {
  if (!side || (side.reviveCharges || 0) <= 0) return false;
  side.reviveCharges = (side.reviveCharges || 0) - 1;
  side.hp = Math.max(1, Math.floor((side.maxHp || 0) * (side.reviveHpRatio || 0.5)));
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
      message: `${battleTeamLabel(team)}: ${sourceLabel} \u2014 ${Math.ceil(side.hp || 0)} HP`
    });
    queueHitAnimation(state, null, team, "\u{1F504}", "#3fb950");
  }
  return true;
}
function getFoeDebuffDamageBonus(foe, perDebuff = 0.5) {
  return Math.floor(countSideDebuffs(foe) * (Number(perDebuff) || 0.5));
}
function getTagDamageBonus(side, tag, perItem = 1, sourceItem = null) {
  if (!side || !tag) return 0;
  if (sourceItem && typeof countTagForItemEffect === "function" && typeof getPlacementSlotsForItem === "function") {
    const slots = getPlacementSlotsForItem(sourceItem.itemId);
    if (slots.some((s) => (s.acceptTags || []).includes(tag))) {
      return Math.floor(countTagForItemEffect(side, sourceItem, tag) * (Number(perItem) || 1));
    }
  }
  let matched = (side.items || []).filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return def && !def.isContainer && def.tags?.includes(tag);
  });
  if (sourceItem && typeof getAdjacentItems === "function") {
    const neighbors = getAdjacentItems(side.items || [], sourceItem);
    const neighborUids = /* @__PURE__ */ new Set([...neighbors.keys()]);
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
  if ((side.stunTimer || 0) > 0) {
    pushFn(debuffs, {
      id: "stun",
      icon: "\u{1F4AB}",
      value: Math.ceil((side.stunTimer || 0) * 10) / 10,
      title: "\u041E\u0433\u043B\u0443\u0448\u0435\u043D\u0438\u0435",
      lines: [`\u041F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043D\u0435 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u0435\u0449\u0451 ${(side.stunTimer || 0).toFixed(1)}\u0441`]
    }, seen);
  }
  if ((side.invulnerableTimer || 0) > 0) {
    pushFn(buffs, {
      id: "invulnerable",
      icon: "\u2728",
      value: Math.ceil((side.invulnerableTimer || 0) * 10) / 10,
      title: "\u041D\u0435\u0443\u044F\u0437\u0432\u0438\u043C\u043E\u0441\u0442\u044C",
      lines: [`\u0418\u043C\u043C\u0443\u043D\u0438\u0442\u0435\u0442 \u043A \u0443\u0440\u043E\u043D\u0443 \u0435\u0449\u0451 ${(side.invulnerableTimer || 0).toFixed(1)}\u0441`]
    }, seen);
  }
  if ((side.reviveCharges || 0) > 0) {
    pushFn(buffs, {
      id: "revive-ready",
      icon: "\u{1F504}",
      value: side.reviveCharges || 0,
      title: "\u041F\u0435\u0440\u0435\u0440\u043E\u0436\u0434\u0435\u043D\u0438\u0435",
      lines: [`\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ${side.reviveCharges} \u043F\u0435\u0440\u0435\u0440\u043E\u0436\u0434\u0435\u043D\u0438\u0439`]
    }, seen);
  }
  if ((side.hearts || 0) > 0) {
    pushFn(buffs, {
      id: "hearts",
      icon: "\u{1F496}",
      value: side.hearts || 0,
      title: "\u0421\u0435\u0440\u0434\u0446\u0430",
      lines: [`\u041D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043E ${side.hearts} \u0441\u0435\u0440\u0434\u0435\u0446`]
    }, seen);
  }
}
