/**
 * Дебаффы, оглушение, неуязвимость, перерождение.
 */
import type { BattleSide, BattleSideState, StatusChip } from "../types/game";

type BoardItem = { itemId: string; uid: string };
type BattleState = {
  player?: BattleSideState;
  enemy?: BattleSideState;
};

function countSideDebuffs(side: BattleSideState | null | undefined): number {
  if (!side) return 0;
  let count = 0;
  if ((side.poisonStacks || 0) > 0) count += side.poisonStacks || 0;
  if ((side.slowDebuff || 0) > 0 && (side.slowTimer || 0) > 0) count += 1;
  if ((side.groundFire || 0) > 0) count += 1;
  if ((side.stunTimer || 0) > 0) count += 1;
  return count;
}

function cleanseSideDebuffs(side: BattleSideState, count = 1): number {
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

function isSideStunned(side: BattleSideState | null | undefined): boolean {
  return (side?.stunTimer || 0) > 0;
}

function applyStunToSide(side: BattleSideState, duration = 0.5): boolean {
  if (!side) return false;
  const dur = Math.max(0.1, Number(duration) || 0.5);
  side.stunTimer = Math.max(side.stunTimer || 0, dur);
  return true;
}

function isSideInvulnerable(side: BattleSideState | null | undefined): boolean {
  return (side?.invulnerableTimer || 0) > 0;
}

function grantSideInvulnerability(side: BattleSideState, duration = 2): void {
  if (!side) return;
  side.invulnerableTimer = Math.max(side.invulnerableTimer || 0, Number(duration) || 2);
}

function setupRevive(side: BattleSideState, hpRatio = 0.5, invuln = 2): void {
  if (!side) return;
  side.reviveCharges = (side.reviveCharges || 0) + 1;
  side.reviveHpRatio = Number(hpRatio) || 0.5;
  side.reviveInvuln = Number(invuln) || 2;
}

function tryReviveSide(
  side: BattleSideState,
  state: BattleState | null | undefined,
  team: BattleSide,
  sourceLabel = "Перерождение",
): boolean {
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
      message: `${battleTeamLabel(team)}: ${sourceLabel} — ${Math.ceil(side.hp || 0)} HP`,
    });
    queueHitAnimation(state, null, team, "🔄", "#3fb950");
  }
  return true;
}

function getFoeDebuffDamageBonus(foe: BattleSideState, perDebuff = 0.5): number {
  return Math.floor(countSideDebuffs(foe) * (Number(perDebuff) || 0.5));
}

function getTagDamageBonus(
  side: BattleSideState,
  tag: string,
  perItem = 1,
  sourceItem: BoardItem | null = null,
): number {
  if (!side || !tag) return 0;
  if (sourceItem
    && typeof countTagForItemEffect === "function"
    && typeof getPlacementSlotsForItem === "function") {
    const slots = getPlacementSlotsForItem(sourceItem.itemId);
    if (slots.some((s) => (s.acceptTags || []).includes(tag))) {
      return Math.floor(countTagForItemEffect(side, sourceItem, tag) * (Number(perItem) || 1));
    }
  }
  let matched = (side.items || []).filter((item) => {
    const def = ITEM_CATALOG[item.itemId] as { isContainer?: boolean; tags?: string[] } | undefined;
    return def && !def.isContainer && def.tags?.includes(tag);
  });
  if (sourceItem && typeof getAdjacentItems === "function") {
    const neighbors = getAdjacentItems(side.items || [], sourceItem);
    const neighborUids = new Set([...neighbors.keys()]);
    matched = matched.filter((item) => neighborUids.has(item.uid));
  }
  return Math.floor(matched.length * (Number(perItem) || 1));
}

function stealFoeWeaponDamage(foe: BattleSideState, amount = 1): number {
  if (!foe?.items) return 0;
  let stolen = 0;
  foe.items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId] as { tags?: string[] } | undefined;
    if (!def?.tags?.includes("weapon")) return;
    const rt = (item.runtime || {}) as { damageBonus?: number };
    const bonus = rt.damageBonus || 0;
    if (bonus <= 0) return;
    const take = Math.min(bonus, Number(amount) || 1);
    rt.damageBonus = bonus - take;
    item.runtime = rt;
    stolen += take;
  });
  return stolen;
}

function collectDebuffStatusChips(
  side: BattleSideState,
  buffs: StatusChip[],
  debuffs: StatusChip[],
  seen: Set<string>,
  pushFn: (list: StatusChip[], chip: StatusChip, seenSet: Set<string>) => void,
): void {
  if (!side) return;
  if ((side.stunTimer || 0) > 0) {
    pushFn(debuffs, {
      id: "stun",
      icon: "💫",
      value: Math.ceil((side.stunTimer || 0) * 10) / 10,
      title: "Оглушение",
      lines: [`Предметы не активируются ещё ${(side.stunTimer || 0).toFixed(1)}с`],
    }, seen);
  }
  if ((side.invulnerableTimer || 0) > 0) {
    pushFn(buffs, {
      id: "invulnerable",
      icon: "✨",
      value: Math.ceil((side.invulnerableTimer || 0) * 10) / 10,
      title: "Неуязвимость",
      lines: [`Иммунитет к урону ещё ${(side.invulnerableTimer || 0).toFixed(1)}с`],
    }, seen);
  }
  if ((side.reviveCharges || 0) > 0) {
    pushFn(buffs, {
      id: "revive-ready",
      icon: "🔄",
      value: side.reviveCharges || 0,
      title: "Перерождение",
      lines: [`Осталось ${side.reviveCharges} перерождений`],
    }, seen);
  }
  if ((side.hearts || 0) > 0) {
    pushFn(buffs, {
      id: "hearts",
      icon: "💖",
      value: side.hearts || 0,
      title: "Сердца",
      lines: [`Накоплено ${side.hearts} сердец`],
    }, seen);
  }
}
