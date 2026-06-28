#!/usr/bin/env python3
"""
Патч tools/items-migrated.json:
- исправление обрезанных описаний «стак(ов)»
- добавление структурированных battle-эффектов (gainStack, weaponDamageStart, …)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "items-migrated.json"


def infer_stack_word(item):
    tags = item.get("tags") or []
    effects = item.get("effects") or []
    etypes = {e.get("type") for e in effects}
    if "spikes" in tags:
        return "шип"
    if "poison" in tags or "poison" in etypes:
        return "яд"
    if "luck" in tags or "passiveLuck" in etypes:
        return "удач"
    if "food" in tags:
        return "ед"
    if any(t in tags for t in ("armor", "shield")):
        return "блок"
    if "fire" in tags:
        return "жар"
    if "magic" in tags:
        return "ман"
    return "стак"


def pluralize_stack(word, n):
    n = abs(int(n or 0))
    if word == "шип":
        if n == 1:
            return "шип"
        if 2 <= n <= 4:
            return "шипа"
        return "шипов"
    if word == "block" or word == "блок":
        if n == 1:
            return "блок"
        if 2 <= n <= 4:
            return "блока"
        return "блоков"
    if word == "яд":
        if n == 1:
            return "стак яда"
        if 2 <= n <= 4:
            return "стака яда"
        return "стаков яда"
    if word == "удач":
        if n == 1:
            return "удача"
        if 2 <= n <= 4:
            return "удачи"
        return "удачи"
    if word == "ед":
        if n == 1:
            return "еда"
        if 2 <= n <= 4:
            return "еды"
        return "еды"
    if n == 1:
        return word
    if 2 <= n <= 4:
        return word + "а"
    return word + "ов"


def fix_description(desc, stack_word):
    if not desc or "стак(ов)" not in desc:
        return desc

    def repl_num(m):
        n = m.group(1)
        return f"{n} {pluralize_stack(stack_word, n)}"

    desc = re.sub(r"(\d+)\s*стак\(ов\)", repl_num, desc)
    desc = re.sub(r"стак\(ов\)", pluralize_stack(stack_word, 2), desc)
    desc = re.sub(r"дебаффуs", "дебаффам", desc)
    desc = re.sub(r"критический ударs", "критические удары", desc)
    desc = re.sub(r"с тегомs", "с тегами", desc)
    desc = re.sub(r"  +", " ", desc)
    return desc.strip()


def merge_effects(existing, additions):
    out = list(existing or [])
    for eff in additions:
        key = json.dumps(eff, sort_keys=True, ensure_ascii=False)
        if any(json.dumps(e, sort_keys=True, ensure_ascii=False) == key for e in out):
            continue
        out.append(eff)
    return out


BATTLE_EFFECT_PATCHES = {
    "walrus_tusk": [
        {"type": "gainStack", "stack": "spikes", "value": 1, "trigger": "battle_start"},
    ],
    "thorn_whip": [
        {"type": "gainStack", "stack": "spikes", "value": 1, "trigger": "on_hit"},
        {"type": "damagePerStack", "stack": "spikes", "value": 1, "trigger": "passive"},
    ],
    "bloodthorne": [
        {"type": "gainStack", "stack": "spikes", "value": 1, "trigger": "on_hit"},
        {"type": "damagePerStack", "stack": "spikes", "value": 1, "trigger": "passive"},
        {
            "type": "spendStack",
            "stack": "spikes",
            "value": 1,
            "trigger": "on_hit",
            "heal": 1,
            "gainStack": "spikes",
            "gainStackValue": 1,
        },
    ],
    "tusk_poker": [
        {"type": "gainStack", "stack": "spikes", "value": 1, "trigger": "on_hit", "chance": 0.5},
        {"type": "damagePerStack", "stack": "spikes", "value": 1, "trigger": "passive"},
    ],
    "tusk_piercer": [
        {"type": "gainStack", "stack": "spikes", "value": 4, "trigger": "battle_start"},
        {
            "type": "spendStack",
            "stack": "spikes",
            "value": 1,
            "trigger": "on_hit",
            "attackBuff": 9,
        },
        {"type": "damagePerStack", "stack": "spikes", "value": 1, "trigger": "passive"},
    ],
    "spiked_shield": [
        {"type": "gainStack", "stack": "spikes", "value": 1, "trigger": "on_block", "chance": 0.3},
        {"type": "onDefend", "chance": 0.3, "trigger": "passive", "gainStack": {"stack": "spikes", "value": 1}},
    ],
    "spiked_collar": [
        {"type": "gainStack", "stack": "spikes", "value": 1, "trigger": "battle_start"},
    ],
    "hedgehog": [
        {"type": "damagePerStack", "stack": "spikes", "value": 0.5, "trigger": "passive"},
    ],
    "hyper_hedgehog": [
        {"type": "damagePerStack", "stack": "spikes", "value": 1, "trigger": "passive"},
    ],
    "hungry_blade": [
        {"type": "gainStack", "stack": "spikes", "value": 1, "trigger": "battle_start"},
        {"type": "gainStack", "stack": "spikes", "value": 1, "trigger": "on_hit"},
        {"type": "damagePerStack", "stack": "spikes", "value": 1, "trigger": "passive"},
    ],
    "hero_sword": [
        {"type": "weaponDamageStart", "value": 1, "trigger": "battle_start"},
    ],
    "hero_long_sword": [
        {"type": "weaponDamageStart", "value": 3, "trigger": "battle_start"},
    ],
    "crossblades": [
        {"type": "weaponDamageStart", "value": 10, "trigger": "battle_start"},
    ],
    "fortunas_grace": [
        {"type": "gainStack", "stack": "luck", "value": 5, "trigger": "battle_start"},
    ],
    "leather_armor": [
        {"type": "gainStack", "stack": "block", "value": 45, "trigger": "battle_start"},
    ],
    "ruby_whelp": [
        {"type": "gainStack", "stack": "spikes", "value": 5, "trigger": "battle_start"},
    ],
    "emerald_whelp": [
        {"type": "gainStack", "stack": "spikes", "value": 3, "trigger": "battle_start"},
    ],
    "sapphire_whelp": [
        {"type": "gainStack", "stack": "block", "value": 6, "trigger": "battle_start"},
    ],
    "blood_goobert": [
        {"type": "gainStack", "stack": "spikes", "value": 5, "trigger": "battle_start"},
    ],
    # --- Этап 2: блок, жар, мана, пороги, периодика ---
    "stone_armor": [
        {"type": "gainStack", "stack": "block", "value": 120, "trigger": "battle_start"},
        {"type": "periodic", "interval": 4, "trigger": "passive", "cleansePoisonSelf": 1, "cleansePoisonFoe": 2},
    ],
    "holy_armor": [
        {"type": "gainStack", "stack": "block", "value": 65, "trigger": "battle_start"},
        {"type": "tagScaledStack", "stack": "block", "perTag": 2, "tag": "armor", "trigger": "battle_start"},
        {"type": "periodic", "interval": 2.2, "trigger": "passive", "spendStack": {"stack": "block", "value": 2, "cleansePoisonSelf": 1}},
    ],
    "vampiric_armor": [
        {"type": "convertHp", "hpCost": 50, "stack": "regen", "stackGain": 100, "trigger": "battle_start"},
        {"type": "gainStack", "stack": "block", "value": 4, "trigger": "battle_start"},
        {"type": "periodic", "interval": 2.8, "trigger": "passive", "convertHp": {"hpCost": 10, "stack": "regen", "stackGain": 20}},
    ],
    "protective_purse": [
        {"type": "gainStack", "stack": "block", "value": 15, "trigger": "battle_start"},
    ],
    "ice_armor": [
        {"type": "gainStack", "stack": "block", "value": 100, "trigger": "battle_start"},
        {"type": "gainStack", "stack": "block", "value": 4, "trigger": "battle_start"},
    ],
    "moon_armor": [
        {"type": "gainStack", "stack": "block", "value": 50, "trigger": "battle_start"},
        {"type": "tagScaledStack", "stack": "block", "perTag": 20, "tag": "armor", "trigger": "battle_start"},
        {"type": "periodic", "interval": 2.6, "trigger": "passive", "gainStack": {"stack": "block", "value": 3}},
    ],
    "sun_armor": [
        {"type": "gainStack", "stack": "block", "value": 70, "trigger": "battle_start"},
        {"type": "tagScaledStack", "stack": "block", "perTag": 1, "tag": "armor", "trigger": "battle_start"},
    ],
    "stone_helm": [
        {"type": "gainStack", "stack": "block", "value": 35, "trigger": "battle_start"},
        {"type": "timedDamageReduction", "value": 0.25, "duration": 5, "trigger": "battle_start"},
    ],
    "cap_of_resilience": [
        {"type": "timedDamageReduction", "value": 0.25, "duration": 3, "trigger": "battle_start"},
    ],
    "burning_sword": [
        {"type": "gainStack", "stack": "heat", "value": 1, "trigger": "on_hit", "chance": 0.6},
        {"type": "stackThreshold", "stack": "heat", "threshold": 7, "weaponDamage": 1, "once": True, "trigger": "passive"},
    ],
    "burning_blade": [
        {"type": "gainStack", "stack": "heat", "value": 1, "trigger": "on_hit"},
        {"type": "stackThreshold", "stack": "heat", "threshold": 6, "weaponDamage": 1, "once": True, "trigger": "passive"},
    ],
    "friendly_fire": [
        {"type": "periodic", "interval": 3, "trigger": "passive", "spendStack": {"stack": "heat", "value": 1}, "gainStack": {"stack": "heat", "value": 2}},
        {"type": "stackThreshold", "stack": "heat", "threshold": 20, "damage": 100, "damageType": "magic", "once": True, "trigger": "passive"},
    ],
    "manathirst": [
        {"type": "gainStack", "stack": "mana", "value": 2, "trigger": "on_hit"},
        {"type": "damagePerStack", "stack": "mana", "value": 1, "trigger": "passive"},
        {"type": "stackThreshold", "stack": "mana", "threshold": 30, "damage": 10, "damageType": "magic", "once": True, "trigger": "passive"},
    ],
    "frostbite": [
        {"type": "stackThreshold", "stack": "poison", "threshold": 30, "targetSide": "foe", "heal": 12, "once": True, "trigger": "passive"},
        {"type": "damagePerStack", "stack": "poison", "value": 1, "trigger": "passive"},
    ],
    "death_scythe": [
        {"type": "stackThreshold", "stack": "poison", "threshold": 25, "targetSide": "foe", "critChance": 0.65, "once": True, "trigger": "passive"},
    ],
    "gloves_of_haste": [
        {"type": "cooldownStartMult", "value": 0.2, "trigger": "battle_start"},
    ],
    "whetstone": [
        {"type": "weaponDamageStart", "value": 1, "trigger": "battle_start"},
    ],
    "dancing_dragon": [
        {"type": "gainStack", "stack": "empower", "value": 1, "trigger": "battle_start"},
        {"type": "gainStack", "stack": "luck", "value": 1, "trigger": "battle_start"},
        {"type": "damagePerStack", "stack": "empower", "value": 1, "trigger": "passive"},
    ],
    "ruby_egg": [
        {"type": "gainStack", "stack": "spikes", "value": 4, "trigger": "battle_start"},
    ],
    "acorn_collar": [
        {"type": "passiveLuck", "value": 2, "trigger": "passive"},
    ],
    # --- Этап 3: дебаффы, оглушение, перерождение, пороги ---
    "dark_lantern": [
        {"type": "hpLossRatio", "value": 0.5, "trigger": "battle_start"},
        {"type": "revive", "hpRatio": 0.5, "invuln": 1.5, "trigger": "battle_start"},
        {"type": "onRevive", "trigger": "passive",
         "damagePerTag": {"tag": "fire", "value": 5, "damageType": "magic"},
         "foePoison": 7},
    ],
    "hammer": [
        {"type": "applyStun", "chance": 0.45, "duration": 0.5, "trigger": "on_hit"},
    ],
    "poison_dagger": [
        {"type": "poison", "value": 2, "trigger": "on_hit"},
    ],
    "darksaber": [
        {"type": "spendStack", "stack": "mana", "value": 1, "trigger": "on_hit", "foePoison": 1},
        {"type": "damagePerFoeDebuff", "value": 0.5, "trigger": "passive"},
    ],
    "glowing_crown": [
        {"type": "periodic", "interval": 2.4, "trigger": "passive", "cleanseDebuffs": 1, "heal": 5},
        {"type": "invulnOnStaminaSpend", "staminaCost": 10, "duration": 2, "trigger": "passive"},
    ],
    "king_crown": [
        {"type": "periodic", "interval": 2.4, "trigger": "passive", "heal": 8},
        {"type": "invulnOnStaminaSpend", "staminaCost": 10, "duration": 2.5, "trigger": "passive"},
    ],
    "heroic_potion": [
        {"type": "zeroStamina", "restoreStamina": 2, "gainStack": {"stack": "empower", "value": 1}, "trigger": "passive"},
    ],
    "strong_heroic_potion": [
        {"type": "zeroStamina", "restoreStamina": 4, "gainStack": {"stack": "empower", "value": 1}, "trigger": "passive"},
    ],
    "winged_boots": [
        {"type": "hpThreshold", "threshold": 0.7, "direction": "below", "once": True, "trigger": "passive",
         "gainStack": {"stack": "luck", "value": 1}, "cleanseDebuffs": 15, "dodgeReady": True},
    ],
    "stone_skin_potion": [
        {"type": "stackThreshold", "stack": "block", "threshold": 45, "once": True, "trigger": "passive",
         "convertHp": {"hpCost": 15, "stack": "regen", "stackGain": 30}},
    ],
    "holy_spear": [
        {"type": "cleanseDebuffs", "value": 1, "trigger": "on_hit"},
        {"type": "invulnOnStaminaSpend", "staminaCost": 25, "duration": 3, "trigger": "passive"},
    ],
    "ripsaw_blade": [
        {"type": "stealWeaponDamage", "value": 1, "trigger": "on_hit"},
    ],
    "katana": [
        {"type": "stealWeaponDamage", "value": 1, "trigger": "on_hit"},
    ],
    "belladonnas_shade": [
        {"type": "poison", "value": 2, "chance": 0.7, "trigger": "on_hit"},
    ],
    "corrupted_armor": [
        {"type": "gainStack", "stack": "block", "value": 85, "trigger": "battle_start"},
        {"type": "periodic", "interval": 2.4, "trigger": "passive", "cleanseDebuffs": 2},
    ],
    "stone_golem": [
        {"type": "gainStack", "stack": "block", "value": 1, "trigger": "on_hit"},
        {"type": "applyStun", "chance": 0.3, "duration": 0.5, "trigger": "on_hit"},
    ],
    "snake": [
        {"type": "periodic", "interval": 2.2, "trigger": "passive", "foePoison": 2},
    ],
    "goobert": [
        {"type": "activationThreshold", "count": 6, "heal": 12, "gainStack": {"stack": "heat", "value": 2},
         "once": True, "trigger": "passive"},
    ],
    "king_goobert": [
        {"type": "activationThreshold", "count": 6, "heal": 35, "once": True, "trigger": "passive"},
        {"type": "invulnOnStaminaSpend", "staminaCost": 4, "duration": 1.5, "trigger": "passive"},
    ],
    "pan": [
        {"type": "damagePerTag", "tag": "food", "value": 1, "trigger": "passive"},
    ],
    # --- Этап 4: доп. атака, сердца, питомцы/еда, удача ---
    "dagger": [
        {"type": "extraAttackOnStun", "trigger": "passive"},
    ],
    "poison_dagger": [
        {"type": "extraAttackOnStun", "trigger": "passive"},
    ],
    "spectral_dagger": [
        {"type": "spendStack", "stack": "mana", "value": 1, "trigger": "on_hit", "attackBuff": 6},
        {"type": "extraAttackOnStun", "trigger": "passive"},
    ],
    "fortunas_hope": [
        {"type": "gainStack", "stack": "luck", "value": 1, "trigger": "on_hit", "chance": 0.75},
    ],
    "eggscalibur": [
        {"type": "damagePerTag", "tag": "food", "value": 1, "trigger": "passive"},
    ],
    "rat_chef": [
        {"type": "tagScaledStack", "stack": "luck", "perTag": 1, "tag": "food", "trigger": "battle_start"},
        {"type": "periodic", "interval": 7, "trigger": "passive", "restoreStamina": 2,
         "gainStack": {"stack": "empower", "value": 1}},
        {"type": "cooldownMultPerTag", "tags": ["pet", "food"], "perTag": 0.15, "trigger": "passive"},
    ],
    "heart_container": [
        {"type": "periodic", "interval": 3, "trigger": "passive", "gainHeart": 1},
        {"type": "heartThreshold", "count": 7, "once": True, "trigger": "passive",
         "maxHp": 100, "gainStack": {"stack": "regen", "value": 2}},
    ],
    "hedgehog": [
        {"type": "periodic", "interval": 5, "trigger": "passive", "damage": 10, "damageType": "magic",
         "damagePerStackBonus": {"stack": "spikes", "value": 0.5}},
        {"type": "hpThreshold", "threshold": 0.7, "direction": "below", "once": True, "trigger": "passive",
         "gainStack": {"stack": "spikes", "value": 2}, "heal": 25},
        {"type": "cooldownMultPerTag", "tags": ["pet", "food"], "perTag": 0.15, "trigger": "passive"},
    ],
    "hyper_hedgehog": [
        {"type": "periodic", "interval": 5, "trigger": "passive", "damage": 10, "damageType": "magic",
         "damagePerStackBonus": {"stack": "spikes", "value": 1}},
        {"type": "hpThreshold", "threshold": 0.7, "direction": "below", "once": True, "trigger": "passive",
         "gainStack": {"stack": "spikes", "value": 4}, "heal": 35},
        {"type": "cooldownMultPerTag", "tags": ["pet", "food"], "perTag": 0.15, "trigger": "passive"},
    ],
    "banana": [
        {"type": "periodic", "interval": 5, "trigger": "passive", "heal": 4, "restoreStamina": 1},
    ],
    "acorn_collar": [
        {"type": "passiveLuck", "value": 2, "trigger": "passive"},
        {"type": "critPerStack", "stack": "luck", "value": 0.05, "trigger": "passive"},
    ],
    "snake": [
        {"type": "periodic", "interval": 2.2, "trigger": "passive", "foePoison": 2},
        {"type": "gainStack", "stack": "mana", "value": 4, "trigger": "battle_start"},
        {"type": "tagScaledMaxHp", "tag": "pet", "perTag": 40, "trigger": "battle_start"},
    ],
    "stamina_sack": [
        {"type": "passiveMaxStamina", "value": 1, "trigger": "passive"},
    ],
    "lucky_clover": [
        {"type": "gainStack", "stack": "luck", "value": 1, "trigger": "battle_start"},
    ],
    "shovel": [
        {"type": "poison", "value": 1, "chance": 0.4, "trigger": "on_hit"},
    ],
    # --- Этап 5: зелья, дебафф-крит, питомцы, еда, перерождение ---
    "health_potion": [
        {"type": "hpThreshold", "threshold": 0.5, "direction": "below", "once": True, "trigger": "passive",
         "heal": 11, "cleanseDebuffs": 4},
    ],
    "strong_health_potion": [
        {"type": "hpThreshold", "threshold": 0.5, "direction": "below", "once": True, "trigger": "passive",
         "heal": 24, "gainStack": {"stack": "regen", "value": 3}, "cleanseDebuffs": 4},
    ],
    "mana_potion": [
        {"type": "hpThreshold", "threshold": 0.5, "direction": "below", "once": True, "trigger": "passive",
         "gainStack": {"stack": "mana", "value": 4}, "maxHp": 18},
    ],
    "strong_mana_potion": [
        {"type": "hpThreshold", "threshold": 0.5, "direction": "below", "once": True, "trigger": "passive",
         "gainStack": {"stack": "mana", "value": 9}, "maxHp": 25},
    ],
    "stone_shoes": [
        {"type": "hpThreshold", "threshold": 0.7, "direction": "below", "once": True, "trigger": "passive",
         "gainStack": {"stack": "luck", "value": 1}, "gainBlock": 45,
         "timedDamageReduction": {"stat": "magic", "value": 0.35, "duration": 7}},
    ],
    "bloody_dagger": [
        {"type": "gainStack", "stack": "empower", "value": 1, "trigger": "on_hit"},
        {"type": "extraAttackOnStun", "trigger": "passive"},
        {"type": "healPerTag", "tag": "vampiric", "value": 4, "trigger": "passive"},
    ],
    "cursed_dagger": [
        {"type": "extraAttackOnStun", "trigger": "passive"},
        {"type": "poison", "value": 2, "trigger": "on_hit"},
        {"type": "critPerFoeDebuff", "value": 0.01, "trigger": "passive"},
    ],
    "pandamonium": [
        {"type": "poison", "value": 1, "trigger": "on_hit"},
        {"type": "critPerFoeDebuff", "value": 0.04, "trigger": "passive"},
        {"type": "damagePerTag", "tag": "food", "value": 1, "trigger": "passive"},
    ],
    "fancy_fencing_rapier": [
        {"type": "spendStack", "stack": "luck", "value": 3, "trigger": "on_hit", "attackBuff": 3},
        {"type": "gainStack", "stack": "luck", "value": 3, "trigger": "on_miss"},
    ],
    "prismatic_sword": [
        {"type": "lifestealPerTag", "tag": "cold", "value": 0.15, "trigger": "passive"},
        {"type": "cooldownMultPerTag", "tags": ["fire"], "perTag": 0.08, "trigger": "passive"},
        {"type": "gainStack", "stack": "mana", "value": 1, "trigger": "on_hit", "chance": 0.12},
    ],
    "moon_shield": [
        {"type": "shieldBlockMult", "value": 0.3, "trigger": "passive"},
        {"type": "gainStack", "stack": "block", "value": 5, "trigger": "battle_start"},
    ],
    "miss_fortune": [
        {"type": "periodic", "interval": 2.1, "trigger": "passive",
         "spendStack": {"stack": "luck", "value": 1}, "gainDominantStack": 3},
    ],
    "squirrel": [
        {"type": "periodic", "interval": 4, "trigger": "passive", "stealWeaponDamage": 1},
        {"type": "cooldownMultPerTag", "tags": ["pet", "food"], "perTag": 0.15, "trigger": "passive"},
    ],
    "squirrel_archer": [
        {"type": "stealWeaponDamage", "value": 1, "trigger": "on_hit"},
        {"type": "cooldownMultPerTag", "tags": ["pet", "food"], "perTag": 0.15, "trigger": "passive"},
    ],
    "toad": [
        {"type": "periodic", "interval": 3.8, "trigger": "passive",
         "gainStack": {"stack": "mana", "value": 1}, "foePoison": 1},
        {"type": "stackThreshold", "stack": "empower", "threshold": 10, "once": True, "trigger": "passive", "heal": 12},
    ],
    "crow": [
        {"type": "periodic", "interval": 3, "trigger": "passive", "stealWeaponDamage": 1},
        {"type": "cooldownMultPerTag", "tags": ["pet", "debuff"], "perTag": 0.06, "trigger": "passive"},
    ],
    "pestilence_flask": [
        {"type": "onFoeHeal", "trigger": "passive", "foePoison": 3, "selfPoison": 1},
    ],
    "strong_pestilence_flask": [
        {"type": "onFoeHeal", "trigger": "passive", "foePoison": 3, "selfPoison": 1},
        {"type": "periodic", "interval": 3.5, "trigger": "passive", "foePoison": 3},
    ],
    "garlic": [
        {"type": "periodic", "interval": 4, "trigger": "passive",
         "gainStack": {"stack": "block", "value": 3}, "cleanseDebuffs": 1, "cleanseChance": 0.3},
    ],
    "carrot": [
        {"type": "periodic", "interval": 2.7, "trigger": "passive", "cleanseDebuffs": 1,
         "gainStack": {"stack": "luck", "value": 1}, "chance": 0.55},
    ],
    "blueberries": [
        {"type": "periodic", "interval": 3.5, "trigger": "passive",
         "gainWeakestStack": {"minStack": 10, "altStack": "mana", "value": 1}},
    ],
    "heart_of_darkness": [
        {"type": "periodic", "interval": 4, "trigger": "passive", "stealWeaponDamage": 2},
        {"type": "heartThreshold", "count": 7, "once": True, "trigger": "passive",
         "maxHp": 100, "gainStack": {"stack": "regen", "value": 4}},
        {"type": "cooldownMultPerTag", "tags": ["dark", "debuff"], "perTag": 0.2, "trigger": "passive"},
    ],
    # --- Этап 6: посохи, пробитие блока, battle rage, зелья HP-порога ---
    "spear": [
        {"type": "breakBlockOnHit", "value": 4, "trigger": "on_hit"},
    ],
    "bow_and_arrow": [
        {"type": "onHitCapBonus", "value": 1, "cap": 7, "trigger": "on_hit"},
    ],
    "piercing_arrow": [
        {"type": "critDamageMult", "value": 0.5, "trigger": "passive"},
        {"type": "breakBlockOnCrit", "value": 15, "trigger": "passive"},
    ],
    "axe": [
        {"type": "gainStack", "stack": "empower", "value": 1, "trigger": "on_hit"},
    ],
    "falcon_blade": [
        {"type": "cooldownStartMult", "value": 0.4, "trigger": "battle_start"},
        {"type": "repeatCast", "trigger": "passive"},
    ],
    "molten_dagger": [
        {"type": "spendStack", "stack": "heat", "value": 1, "trigger": "on_attack", "attackBuff": 2},
        {"type": "extraAttackOnStun", "trigger": "passive"},
    ],
    "flame_whip": [
        {"type": "spendStack", "stack": "heat", "value": 1, "trigger": "on_attack",
         "attackBuff": 8, "gainStack": {"stack": "spikes", "value": 4}},
    ],
    "belladonnas_whisper": [
        {"type": "poison", "value": 1, "trigger": "on_hit"},
        {"type": "damagePerFoeDebuff", "value": 0.5, "trigger": "passive"},
    ],
    "magic_staff": [
        {"type": "spendStack", "stack": "mana", "value": 3, "trigger": "on_attack",
         "attackBuff": 6, "permanentDamage": 2},
    ],
    "staff_of_fire": [
        {"type": "spendStack", "stack": "mana", "value": 2, "trigger": "on_attack",
         "extraSpend": {"stack": "heat", "value": 2}, "attackBuff": 6},
    ],
    "staff_of_unhealing": [
        {"type": "periodic", "interval": 2, "trigger": "passive", "heal": 20},
    ],
    "serpent_staff": [
        {"type": "spendStack", "stack": "mana", "value": 4, "trigger": "on_attack",
         "attackBuff": 2, "foePoison": 1, "duplicateChance": 0.4},
    ],
    "critwood_staff": [
        {"type": "spendStack", "stack": "mana", "value": 3, "trigger": "on_attack",
         "attackBuff": 7, "guaranteedCrit": 1.5},
    ],
    "snow_stick": [
        {"type": "poison", "value": 3, "trigger": "on_hit"},
        {"type": "selfPoison", "value": 2, "trigger": "on_hit"},
    ],
    "spell_scroll_frostbolt": [
        {"type": "periodic", "interval": 3, "trigger": "passive", "damage": 5, "damageType": "magic", "consumesUse": True},
        {"type": "activationLimit", "base": 3, "perTag": 1, "tag": "cold", "excludeSelf": True, "trigger": "passive"},
    ],
    "dragonscale_armor": [
        {"type": "battleRageLowHp", "trigger": "passive",
         "gainBlock": 45, "damageReduction": 0.08, "duration": 5},
    ],
    "shield_of_valor": [
        {"type": "shieldBlockMult", "value": 0.3, "trigger": "passive"},
        {"type": "onDefend", "chance": 0.3, "trigger": "passive", "preventDamage": 14, "drainStamina": 0.7},
    ],
    "frozen_buckler": [
        {"type": "shieldBlockMult", "value": 0.15, "trigger": "passive"},
        {"type": "onDefend", "chance": 0.3, "trigger": "passive", "preventDamage": 12, "drainStamina": 0.9, "foePoison": 1},
    ],
    "vampiric_gloves": [
        {"type": "periodic", "interval": 4, "trigger": "passive", "once": True, "cooldownBoost": 0.35},
    ],
    "gloves_of_power": [
        {"type": "statMult", "stat": "damage", "value": 0.2, "trigger": "passive"},
        {"type": "statMult", "stat": "cooldown", "value": 0.1, "trigger": "passive"},
        {"type": "gainStack", "stack": "empower", "value": 7, "trigger": "on_hit"},
    ],
    "claws_of_attack": [
        {"type": "hitCounter", "threshold": 4, "trigger": "on_hit",
         "gainStack": {"stack": "spikes", "value": 1}},
    ],
    "doom_cap": [
        {"type": "periodic", "interval": 3.1, "trigger": "passive", "foePoison": 3},
    ],
    "oil_lamp": [
        {"type": "gainStack", "stack": "heat", "value": 2, "trigger": "battle_start"},
        {"type": "periodic", "interval": 3.4, "trigger": "passive", "weaponDamageBonus": 1},
    ],
    "vampiric_potion": [
        {"type": "mutualHpThreshold", "threshold": 0.8, "once": True, "trigger": "passive",
         "gainStack": {"stack": "mana", "value": 3}, "damage": 15, "damageType": "magic", "lifesteal": 1.0},
    ],
    "chili_pepper": [
        {"type": "periodic", "interval": 4.5, "trigger": "passive",
         "gainStack": {"stack": "heat", "value": 1}, "heal": 5},
        {"type": "stackThreshold", "stack": "heat", "threshold": 10, "trigger": "passive",
         "cleanseDebuffs": 1, "once": False},
    ],
    "fly_agaric": [
        {"type": "periodic", "interval": 3.6, "trigger": "passive", "foePoison": 1},
    ],
    "cheese": [
        {"type": "periodic", "interval": 3.8, "trigger": "passive", "maxHp": 10, "randomTimedBuff": True},
    ],
    "rainbow_goobert": [
        {"type": "activationThreshold", "count": 9, "once": True, "trigger": "passive",
         "heal": 40, "restoreStamina": 2,
         "gainStack": {"stack": "block", "value": 20},
         "maxHp": 20, "weaponDamageStart": 4, "foePoison": 3},
    ],
    # --- Этап 7: onDefend щиты, свитки, meta-adjacent, оружие ---
    "broom": [
        {"type": "attackBuff", "value": 2, "trigger": "on_miss"},
        {"type": "poison", "value": 1, "chance": 0.33, "trigger": "on_hit"},
    ],
    "poison_spear": [
        {"type": "breakBlockOnHit", "value": 6, "trigger": "on_hit"},
        {"type": "poison", "value": 3, "trigger": "on_hit"},
        {"type": "selfPoison", "value": 2, "trigger": "on_hit"},
    ],
    "molten_spear": [
        {"type": "preventMiss", "trigger": "passive",
         "spendStack": {"stack": "heat", "value": 1}, "attackBuff": 5},
        {"type": "breakBlockOnHit", "value": 5, "trigger": "on_hit"},
    ],
    "wooden_buckler": [
        {"type": "onDefend", "chance": 0.3, "trigger": "passive", "preventDamage": 7, "drainStamina": 0.3},
    ],
    "sun_shield": [
        {"type": "onDefend", "chance": 0.3, "trigger": "passive", "preventDamage": 14, "drainStamina": 0.7},
        {"type": "stackThreshold", "stack": "block", "threshold": 12, "once": False, "trigger": "passive",
         "damage": 4, "damageType": "magic", "targetSide": "foe",
         "spendStack": {"stack": "block", "value": 12}},
    ],
    "sun_armor": [
        {"type": "periodic", "interval": 3, "trigger": "passive",
         "spendStack": {"stack": "block", "value": 1}, "heal": 12, "cleanseDebuffs": 2},
    ],
    "blood_amulet": [
        {"type": "gainStack", "stack": "regen", "value": 2, "trigger": "battle_start"},
        {"type": "passiveMaxHp", "value": 20, "trigger": "passive"},
    ],
    "cauldron": [
        {"type": "periodic", "interval": 2.6, "trigger": "passive", "randomPick": [
            {"heal": 20},
            {"gainStack": {"stack": "regen", "value": 6}},
            {"gainStack": {"stack": "luck", "value": 5}},
        ]},
        {"type": "cooldownMultPerTag", "tags": ["food", "potion"], "perTag": 0.15, "trigger": "passive"},
    ],
    "healing_herbs": [
        {"type": "gainStack", "stack": "luck", "value": 2, "trigger": "battle_start"},
    ],
    "villain_sword": [
        {"type": "damagePerTag", "tag": "dark", "value": 4, "trigger": "passive"},
    ],
    "strong_vampiric_potion": [
        {"type": "mutualHpThreshold", "threshold": 0.8, "once": True, "trigger": "passive",
         "gainStack": {"stack": "mana", "value": 5}, "damage": 20, "damageType": "magic", "lifesteal": 1.0},
    ],
    "mana_orb_charm": [
        {"type": "onActivate", "gainStack": {"stack": "mana", "value": 1}, "chance": 0.5},
        {"type": "invulnOnStaminaSpend", "staminaCost": 35, "duration": 2, "trigger": "passive"},
    ],
    "pocket_sand": [
        {"type": "gainStack", "stack": "luck", "value": 1, "trigger": "battle_start"},
    ],
    "molten_greatsword": [
        {"type": "spendStack", "stack": "heat", "value": 2, "trigger": "on_hit",
         "gainStack": {"stack": "heat", "value": 4}},
        {"type": "stackThreshold", "stack": "heat", "threshold": 5, "once": False,
         "trigger": "passive", "gainStack": {"stack": "empower", "value": 1}},
    ],
    "impractically_large_greatsword": [
        {"type": "stackThreshold", "stack": "heat", "threshold": 5, "direction": "above", "once": False,
         "trigger": "passive", "gainStack": {"stack": "empower", "value": 1}},
    ],
    # --- Этап 8: зелья-пороги, губерты, питомцы, огонь, meta-adjacent ---
    "lightsaber": [
        {"type": "invulnOnStaminaSpend", "staminaCost": 3, "duration": 0, "foeSlow": 8,
         "slowDuration": 6, "trigger": "passive"},
        {"type": "damagePerFoeDebuff", "value": 1, "trigger": "passive"},
    ],
    "demonic_flask": [
        {"type": "foeHpThreshold", "threshold": 0.5, "once": True, "trigger": "passive",
         "damagePerFoeDebuffMult": 5, "damageType": "magic"},
    ],
    "strong_demonic_flask": [
        {"type": "foeHpThreshold", "threshold": 0.5, "selfThreshold": 0.25, "once": True,
         "trigger": "passive", "damagePerFoeDebuffMult": 8, "damageType": "magic"},
    ],
    "divine_potion": [
        {"type": "debuffThreshold", "threshold": 10, "once": True, "trigger": "passive", "cleanseDebuffs": 10},
    ],
    "strong_divine_potion": [
        {"type": "debuffThreshold", "threshold": 10, "once": True, "trigger": "passive",
         "cleanseDebuffs": 10, "gainDominantStack": 8},
    ],
    "strong_stone_skin_potion": [
        {"type": "stackThreshold", "stack": "block", "threshold": 45, "once": True, "trigger": "passive",
         "convertHp": {"hpCost": 15, "stackGain": 35, "stack": "regen"},
         "gainStack": {"stack": "empower", "value": 2}},
    ],
    "leather_boots": [
        {"type": "hpThreshold", "threshold": 0.7, "direction": "below", "once": True, "trigger": "passive",
         "gainStack": {"stack": "luck", "value": 1}, "gainBlock": 15},
    ],
    "dragonskin_boots": [
        {"type": "battleRageLowHp", "trigger": "passive", "cleanseDebuffs": 3,
         "gainStack": {"stack": "luck", "value": 1}, "gainBlock": 20, "cooldownBoost": 0.4},
    ],
    "cap_of_discomfort": [
        {"type": "timedDamageReduction", "value": 0.25, "duration": 5, "trigger": "battle_start"},
    ],
    "steel_goobert": [
        {"type": "activationThreshold", "count": 6, "once": True, "trigger": "passive",
         "weaponDamageStart": 2, "gainStack": {"stack": "block", "value": 16}},
    ],
    "light_goobert": [
        {"type": "activationThreshold", "count": 6, "once": True, "trigger": "passive",
         "heal": 20, "foePoison": 6},
    ],
    "poison_goobert": [
        {"type": "activationThreshold", "count": 5, "once": True, "trigger": "passive",
         "heal": 9, "foePoison": 4},
    ],
    "chili_goobert": [
        {"type": "activationThreshold", "count": 6, "once": True, "trigger": "passive",
         "heal": 12, "gainStack": {"stack": "heat", "value": 2}},
    ],
    "carrot_goobert": [
        {"type": "activationThreshold", "count": 5, "once": True, "trigger": "passive",
         "cleanseDebuffs": 3, "gainStack": {"stack": "empower", "value": 2}},
    ],
    "rat": [
        {"type": "periodic", "interval": 3.3, "trigger": "passive", "damage": 5, "damageType": "magic",
         "foePoison": 1, "chance": 0.75},
        {"type": "cooldownMultPerTag", "tags": ["pet", "food"], "perTag": 0.15, "trigger": "passive"},
    ],
    "torch": [
        {"type": "gainStack", "stack": "empower", "value": 1, "trigger": "on_hit", "chance": 0.25},
    ],
    "burning_torch": [
        {"type": "gainStack", "stack": "heat", "value": 2, "trigger": "battle_start"},
        {"type": "gainStack", "stack": "empower", "value": 1, "trigger": "on_hit", "chance": 0.3},
    ],
    "forging_hammer": [
        {"type": "damagePerTotalStacks", "value": 1, "trigger": "passive"},
    ],
    "lucky_piggy": [
        {"type": "gainStack", "stack": "luck", "value": 2, "trigger": "battle_start"},
        {"type": "procChanceBonus", "value": 0.12, "trigger": "passive"},
    ],
    "draconic_orb": [
        {"type": "stackThreshold", "stack": "heat", "threshold": 15, "once": True, "trigger": "passive",
         "guaranteedCritHits": 3},
        {"type": "periodic", "interval": 3.8, "trigger": "passive",
         "stealFoeStack": {"stack": "heat", "value": 1}},
    ],
    "obsidian_dragon": [
        {"type": "stackThreshold", "stack": "heat", "threshold": 8, "once": False, "trigger": "passive",
         "itemDamage": 2, "guaranteedCritHits": 1},
    ],
    "phoenix": [
        {"type": "onActivate", "hpCost": 10},
        {"type": "revive", "hpRatio": 0.06, "invuln": 1, "trigger": "passive"},
    ],
    "dragon_claws": [
        {"type": "procChanceBonus", "value": 0.1, "trigger": "passive"},
        {"type": "battleRageLowHp", "trigger": "passive", "cooldownBoost": 0.4},
    ],
    "offering_bowl": [
        {"type": "gainStack", "stack": "luck", "value": 1, "trigger": "battle_start"},
    ],
    "piggybank": [
        {"type": "max_hp_per_start_item", "value": 2, "trigger": "battle_start"},
    ],
    # --- Этап 9: снег/лёд, уголь, факел, питомцы, аксессуары ---
    "ruby_chonk": [
        {"type": "gainStack", "stack": "heat", "value": 1, "trigger": "on_hit"},
        {"type": "applyStun", "duration": 0.4, "chance": 0.3, "selfStaminaBelow": 12, "trigger": "on_hit"},
    ],
    "ice_dragon": [
        {"type": "gainStack", "stack": "cold", "value": 1, "targetSide": "foe", "trigger": "on_hit"},
        {"type": "stackThreshold", "stack": "cold", "threshold": 10, "targetSide": "foe", "once": True,
         "trigger": "passive", "gainBlock": 90},
        {"type": "statMult", "stat": "magicDamage", "value": -0.2, "trigger": "passive"},
    ],
    "amethyst_whelp": [
        {"type": "gainWeakestStack", "value": 1, "count": 4, "trigger": "battle_start"},
        {"type": "stealRandomStack", "value": 1, "trigger": "on_hit"},
    ],
    "shelly": [
        {"type": "periodic", "interval": 13, "trigger": "passive", "cleanseDebuffs": 6, "heal": 40},
        {"type": "procChanceBonus", "value": 0.25, "trigger": "passive"},
        {"type": "cooldownMultPerTag", "tags": ["potion"], "perTag": 0.20, "trigger": "passive"},
    ],
    "wolpertinger": [
        {"type": "periodic", "interval": 5, "trigger": "passive", "gainWeakestStack": {"value": 1, "count": 3}},
        {"type": "staminaRegenPerStack", "value": 0.007, "trigger": "passive"},
        {"type": "cooldownMultPerTag", "tags": ["pet", "luck"], "perTag": 0.15, "trigger": "passive"},
    ],
    "paradise_birb": [
        {"type": "periodic", "interval": 2.7, "trigger": "passive",
         "gainStack": {"stack": "empower", "value": 1}, "chance": 0.07},
        {"type": "procChanceBonus", "value": 0.07, "trigger": "passive"},
        {"type": "statMult", "stat": "heal", "value": 0.07, "trigger": "passive"},
        {"type": "cooldownMultPerTag", "tags": ["pet"], "perTag": 0.07, "trigger": "passive"},
    ],
    "cthulhu": [
        {"type": "periodic", "interval": 3.3, "trigger": "passive", "damage": 10, "damageType": "magic",
         "lifesteal": 1.0, "gainWeakestStack": True},
        {"type": "cooldownMultPerTag", "tags": ["food"], "perTag": 0.15, "trigger": "passive"},
    ],
    "tim": [
        {"type": "stealRandomStack", "value": 1, "chance": 0.5, "trigger": "on_hit"},
        {"type": "foeHpThreshold", "threshold": 0.3, "once": True, "trigger": "passive",
         "heal": 50, "gainDominantStack": 5},
    ],
    "corrupted_crystal": [
        {"type": "foeHpThreshold", "threshold": 0.3, "once": False, "trigger": "passive", "damageMult": 0.5},
        {"type": "debuffThreshold", "threshold": 7, "once": True, "trigger": "passive", "gainDominantStack": 6},
        {"type": "periodic", "interval": 3.9, "trigger": "passive", "foePoison": 2},
    ],
    "lump_of_coal": [
        {"type": "onHitCapBonus", "value": 1, "cap": 99, "chance": 0.7, "trigger": "on_hit"},
        {"type": "gainStack", "stack": "heat", "value": 8, "trigger": "battle_start"},
        {"type": "periodic", "interval": 3, "trigger": "passive", "gainWeakestStack": True},
    ],
    "burning_coal": [
        {"type": "gainStack", "stack": "heat", "value": 12, "trigger": "battle_start"},
        {"type": "bonusDamageOnHit", "value": 6, "chance": 0.12, "trigger": "on_hit",
         "gainStack": {"stack": "heat", "value": 1}},
        {"type": "periodic", "interval": 5, "trigger": "passive", "gainStack": {"stack": "heat", "value": 2},
         "cleanseDebuffs": 3},
    ],
    "magic_torch": [
        {"type": "staminaSpendOnHit", "staminaCost": 1, "itemDamage": 1, "weaponDamage": 1, "trigger": "on_hit"},
    ],
    "sir_sand": [
        {"type": "timedDamageReduction", "value": 0.25, "duration": 7, "bothSides": True, "trigger": "battle_start"},
        {"type": "poison", "value": 3, "bothSides": True, "trigger": "battle_start"},
    ],
    "stone": [
        {"type": "activationLimit", "base": 1, "trigger": "passive"},
        {"type": "destroyFoeStacks", "value": 4, "trigger": "on_hit"},
    ],
    "snowball": [
        {"type": "gainStack", "stack": "cold", "value": 2, "targetSide": "foe", "trigger": "battle_start"},
    ],
    "snowmaster": [
        {"type": "periodic", "interval": 1.3, "trigger": "passive",
         "applyColdOrSelf": True, "coldThreshold": 10, "cleanseDebuffs": 1},
        {"type": "cooldownMultPerTag", "tags": ["cold"], "perTag": 0.10, "trigger": "passive"},
    ],
    "frozen_flame": [
        {"type": "tagScaledStack", "stack": "heat", "tag": "fire", "perTag": 8, "trigger": "battle_start"},
        {"type": "stackThreshold", "stack": "heat", "threshold": 6, "once": False, "trigger": "passive",
         "gainStack": {"stack": "heat", "value": 2, "targetSide": "foe"}},
        {"type": "crit", "chance": 0.015, "trigger": "passive"},
        {"type": "critDamageMult", "value": 0.02, "trigger": "passive"},
    ],
    "blood_harvester": [
        {"type": "stackGainMult", "value": 1.0, "trigger": "passive"},
        {"type": "cooldownMultPerTotalStacks", "perStack": 0.05, "maxStacks": 40, "trigger": "passive"},
    ],
    "prismatic_orb": [
        {"type": "tagScaledStack", "stack": "mana", "tag": "magic", "perTag": 2, "trigger": "battle_start"},
        {"type": "tagScaledStack", "stack": "mana", "tag": "fire", "perTag": 1, "trigger": "battle_start"},
        {"type": "statMult", "stat": "heal", "value": 0.04, "trigger": "passive", "tag": "cold"},
        {"type": "periodic", "interval": 8, "trigger": "passive", "gainAllStacks": 1},
    ],
    "unsettling_presence": [
        {"type": "healAsDamageMult", "value": 0.3, "trigger": "passive"},
        {"type": "periodic", "interval": 3, "trigger": "passive", "spendRandomStack": 1, "heal": 12},
    ],
    "time_dilator": [
        {"type": "statMult", "stat": "cooldown", "value": 0.30, "trigger": "passive"},
        {"type": "periodic", "interval": 1, "trigger": "passive", "cooldownBoostItem": 0.06},
    ],
    "more_stats": [
        {"type": "maxHpPercentStart", "value": 0.12, "trigger": "battle_start"},
        {"type": "statMult", "stat": "damage", "value": 0.05, "trigger": "passive"},
    ],
    "djinn_lamp": [
        {"type": "periodic", "interval": 1.6, "trigger": "passive", "randomPick": [
            {"gainStack": {"stack": "luck", "value": 1}},
            {"gainStack": {"stack": "mana", "value": 1}},
            {"gainStack": {"stack": "spikes", "value": 1}},
        ]},
    ],
    "pineapple": [
        {"type": "periodic", "interval": 2.9, "trigger": "passive",
         "gainStack": {"stack": "luck", "value": 1}, "heal": 4},
        {"type": "cooldownMultPerTag", "tags": ["food"], "perTag": 0.10, "trigger": "passive"},
    ],
    "snowcake": [
        {"type": "periodic", "interval": 3, "trigger": "passive",
         "gainStack": {"stack": "cold", "value": 1, "targetSide": "foe"},
         "foeColdBonus": {"threshold": 10, "magicDamageMult": 0.1, "damage": 10, "damageType": "magic"}},
        {"type": "cooldownMultPerTag", "tags": ["food"], "perTag": 0.10, "trigger": "passive"},
    ],
    "platinum_customer_card": [
        {"type": "procChanceBonus", "value": 0.10, "trigger": "passive"},
        {"type": "periodic", "interval": 4, "trigger": "passive", "cleanseDebuffs": 2},
    ],
    # --- Этап 10: предметы без патчей (миграция) ---
    "shell_totem": [
        {"type": "periodic", "interval": 3.4, "trigger": "passive", "hpThreshold": 0.7,
         "healIfBelow": 8, "gainStackIfAbove": {"stack": "empower", "value": 1}},
        {"type": "cooldownMultPerTag", "tags": ["holy"], "perTag": 0.15, "trigger": "passive"},
    ],
    "flute": [
        {"type": "periodic", "interval": 4.7, "trigger": "passive",
         "randomPick": [{"block": 14}, {"restoreStamina": 2}, {"gainStack": {"stack": "luck", "value": 2}}]},
        {"type": "cooldownMultPerAdjacent", "perAdjacent": 0.10, "maxBonus": 0.60, "trigger": "passive"},
    ],
    "fanfare": [
        {"type": "periodic", "interval": 3, "trigger": "passive",
         "drainFoeStamina": 1, "cooldownPenalty": 0.8, "stunEvery": 5, "stunDuration": 1},
    ],
    "leaf_badge": [
        {"type": "periodic", "interval": 2.2, "trigger": "passive", "gainWeakestStack": {"value": 1, "count": 1}},
    ],
    "skull_badge": [
        {"type": "periodic", "interval": 1.5, "trigger": "passive", "foePoison": 1},
    ],
    "stone_badge": [
        {"type": "periodic", "interval": 3, "trigger": "passive", "gainStack": {"stack": "block", "value": 1}},
    ],
    "rainbow_badge": [
        {"type": "periodic", "interval": 7, "trigger": "passive", "gainWeakestStack": {"value": 1, "count": 3}},
    ],
    "puzzle_badge": [
        {"type": "statMult", "stat": "cooldown", "value": 0.20, "trigger": "passive"},
        {"type": "periodic", "interval": 5, "trigger": "passive", "cooldownBoostItem": 0.50},
    ],
    "stable_recombobulator": [
        {"type": "periodic", "interval": 2.5, "trigger": "passive",
         "gainWeakestStack": {"value": 1, "count": 1}, "cleanseDebuffs": 1},
    ],
    "unstable_recombobulator": [
        {"type": "periodic", "interval": 4, "trigger": "passive",
         "randomPick": [{"gainStack": {"stack": "luck", "value": 1}}, {"foePoison": 1}, {"heal": 5}]},
    ],
    "lil_chestnut": [
        {"type": "periodic", "interval": 6, "trigger": "passive", "gainDominantStack": 3},
        {"type": "cooldownMultPerItemCost", "perCost": 0.01, "trigger": "passive"},
    ],
    "gingerbread_jerry": [
        {"type": "periodic", "interval": 3, "trigger": "passive",
         "spendStack": {"stack": "heat", "value": 1},
         "gainStack": {"stack": "empower", "value": 1}, "gainHeart": 1},
        {"type": "cooldownMultPerTag", "tags": ["food"], "perTag": 0.10, "trigger": "passive"},
    ],
    "repeater": [
        {"type": "periodic", "interval": 12, "trigger": "passive", "gainWeakestStack": {"value": 1, "count": 2}},
    ],
    "mr_struggles": [
        {"type": "periodic", "interval": 3, "trigger": "passive", "damage": 4, "damageType": "magic"},
    ],
    "mrs_struggles": [
        {"type": "periodic", "interval": 4.7, "trigger": "passive", "stripFoeStacksOnceEach": True},
        {"type": "cooldownMultPerTag", "tags": ["dark"], "perTag": 0.10, "trigger": "passive"},
    ],
    "happy_bomb": [
        {"type": "periodic", "interval": 12, "trigger": "passive", "damage": 20, "damageType": "magic"},
    ],
    "pop": [
        {"type": "periodic", "interval": 8, "trigger": "passive", "foePoison": 3},
        {"type": "cooldownMultPerSocket", "perSocket": 0.03, "maxBonus": 0.60, "trigger": "passive"},
    ],
    "cubert": [
        {"type": "periodic", "interval": 4, "trigger": "passive",
         "gainStack": {"stack": "cold", "value": 1, "targetSide": "foe"}},
    ],
    "wonky_snowman": [
        {"type": "slow", "value": 0.12, "duration": 4, "trigger": "on_hit", "chance": 0.5},
    ],
    "ace_of_spades": [
        {"type": "buffTimed", "stat": "damage", "value": 0.15, "duration": 4, "trigger": "on_hit", "chance": 0.5},
    ],
    "the_lovers": [
        {"type": "heal", "value": 3, "trigger": "battle_start"},
    ],
    "the_fool": [
        {"type": "gainStack", "stack": "luck", "value": 1, "trigger": "battle_start"},
    ],
    "reverse": [
        {"type": "gainStack", "stack": "empower", "value": 2, "trigger": "battle_start"},
    ],
    # --- Этап 10 (продолжение): камни, карты, сумки, дракончики ---
    "artifact_stone_cold": [
        {"type": "activationLimit", "base": 1, "trigger": "passive"},
        {"type": "gainStack", "stack": "cold", "value": 3, "targetSide": "foe", "trigger": "on_hit"},
        {"type": "periodic", "interval": 5, "trigger": "passive",
         "gainStack": {"stack": "cold", "value": 1, "targetSide": "foe"}, "heal": 4},
    ],
    "artifact_stone_heat": [
        {"type": "activationLimit", "base": 1, "trigger": "passive"},
        {"type": "gainStack", "stack": "heat", "value": 3, "trigger": "on_hit"},
        {"type": "stackThreshold", "stack": "heat", "threshold": 10, "once": True,
         "trigger": "passive", "weaponDamage": 8},
    ],
    "artifact_stone_death": [
        {"type": "activationLimit", "base": 1, "trigger": "passive"},
        {"type": "fatigueDamageOnHit", "value": 1, "poison": 2, "trigger": "on_hit"},
        {"type": "critPerFoeFatigue", "value": 0.07, "trigger": "passive"},
    ],
    "bag_of_stones": [
        {"type": "stonesMultiThrow", "trigger": "passive"},
    ],
    "pumpkin": [
        {"type": "applyStun", "duration": 0.5, "chance": 0.5, "trigger": "on_hit"},
        {"type": "onFatigueStart", "gainStack": {"stack": "heat", "value": 10}, "trigger": "passive"},
        {"type": "cooldownMultPerTag", "tags": ["food"], "perTag": 0.10, "trigger": "passive"},
    ],
    "emerald_whelp": [
        {"type": "selfPoisonStart", "value": 3, "trigger": "battle_start"},
        {"type": "poison", "value": 3, "trigger": "on_hit"},
    ],
    "sapphire_whelp": [
        {"type": "gainStack", "stack": "block", "value": 6, "trigger": "battle_start"},
        {"type": "spendStack", "stack": "block", "value": 1, "trigger": "on_hit",
         "gainStack": {"stack": "block", "value": 10}},
        {"type": "gainWeakestStack", "value": 1, "trigger": "on_hit"},
    ],
    "deck_of_cards": [
        {"type": "gainStack", "stack": "luck", "value": 2, "trigger": "battle_start"},
        {"type": "procChanceBonus", "value": 0.05, "trigger": "passive"},
    ],
    "white_eyes_blue_dragon": [
        {"type": "gainStack", "stack": "luck", "value": 12, "trigger": "battle_start"},
        {"type": "cardScaledBonus", "stack": "luck", "perCard": 5, "trigger": "battle_start"},
        {"type": "gainStack", "stack": "cold", "value": 3, "targetSide": "foe", "trigger": "battle_start"},
    ],
    "holo_fire_lizard": [
        {"type": "statMult", "stat": "magicDamage", "value": 0.08, "trigger": "battle_start"},
        {"type": "cardScaledDamage", "base": 12, "perCard": 4, "damageType": "magic", "trigger": "battle_start"},
        {"type": "gainStack", "stack": "heat", "value": 4, "trigger": "battle_start"},
    ],
    "darkest_lotus": [
        {"type": "cardScaledBonus", "stack": "empower", "perCard": 4, "trigger": "battle_start"},
        {"type": "gainStack", "stack": "empower", "value": 4, "trigger": "battle_start"},
        {"type": "stealRandomStack", "value": 3, "trigger": "battle_start"},
    ],
    "jimbo": [
        {"type": "gainWeakestStack", "value": 1, "count": 7, "trigger": "battle_start"},
        {"type": "procChanceBonus", "value": 0.10, "trigger": "passive"},
        {"type": "passiveDefense", "value": 2, "trigger": "passive"},
    ],
    "fanny_pack": [
        {"type": "cooldownMultPerTag", "tags": ["bag"], "perTag": 0.10, "trigger": "passive"},
    ],
    "holdall": [
        {"type": "neutralScaledStack", "stack": "heat", "perItem": 8, "trigger": "battle_start"},
    ],
    "ranger_bag": [
        {"type": "crit", "chance": 0.10, "trigger": "passive"},
        {"type": "critPerStack", "stack": "luck", "value": 0.03, "trigger": "passive"},
    ],
    "duffle_bag": [
        {"type": "hpThreshold", "threshold": 0.5, "direction": "below", "once": True, "trigger": "passive",
         "gainBlock": 20, "cooldownBoost": 0.30,
         "timedDamageReduction": {"value": 0.20, "duration": 5}},
        {"type": "battleRageLowHp", "trigger": "passive", "cooldownBoost": 0.30},
    ],
    "storage_coffin": [
        {"type": "onActivate", "foePoison": 1, "chance": 0.22, "trigger": "passive"},
    ],
    "relic_case": [
        {"type": "periodic", "interval": 2.5, "trigger": "passive", "weaponDamageBonus": 1},
    ],
    "utility_pouch": [
        {"type": "statMult", "stat": "damage", "value": 0.30, "trigger": "passive"},
        {"type": "statMult", "stat": "cooldown", "value": 0.30, "trigger": "passive"},
        {"type": "periodic", "interval": 5, "trigger": "passive", "cooldownBoostItem": 0.35},
        {"type": "lifesteal", "value": 0.35, "trigger": "passive"},
    ],
    "potion_belt": [
        {"type": "procChanceBonus", "value": 0.08, "trigger": "passive"},
        {"type": "debuffThreshold", "threshold": 4, "once": True, "trigger": "passive", "cleanseDebuffs": 10},
    ],
    "vineweave_basket": [
        {"type": "statMult", "stat": "heal", "value": 0.10, "trigger": "passive"},
        {"type": "healPerTag", "tag": "nature", "value": 0.03, "trigger": "passive"},
    ],
    "present": [
        {"type": "gainStack", "stack": "luck", "value": 5, "trigger": "battle_start"},
        {"type": "heal", "value": 15, "trigger": "battle_start"},
    ],
    "maneki_neko": [
        {"type": "procChanceBonus", "value": 0.03, "trigger": "passive"},
        {"type": "passiveLuck", "value": 1, "trigger": "passive"},
    ],
    "wooden_sword": [
        {"type": "onHitCapBonus", "value": 1, "cap": 2, "chance": 0.25, "trigger": "on_hit"},
    ],
    "shortbow": [
        {"type": "onHitCapBonus", "value": 1, "cap": 3, "trigger": "on_hit"},
    ],
    "shiny_shell": [
        {"type": "healPerTag", "tag": "holy", "value": 3, "trigger": "passive", "adjacent": True},
        {"type": "periodic", "interval": 5, "trigger": "passive", "heal": 5},
    ],
    "wolf_badge": [
        {"type": "hpThreshold", "threshold": 0.5, "direction": "below", "once": True, "trigger": "passive",
         "cooldownBoost": 0.25},
        {"type": "battleRageLowHp", "trigger": "passive", "cooldownBoost": 0.25},
    ],
    "magic_badge": [
        {"type": "gainStack", "stack": "mana", "value": 5, "trigger": "battle_start"},
        {"type": "procChanceBonus", "value": 0.30, "trigger": "passive"},
    ],
    "flame_badge": [
        {"type": "procChanceBonus", "value": 0.05, "trigger": "passive"},
    ],
    "twine_badge": [
        {"type": "procChanceBonus", "value": 0.05, "trigger": "passive"},
    ],
    "leather_bag": [
        {"type": "cooldownMultPerTag", "tags": ["accessory"], "perTag": 0.05, "trigger": "passive"},
    ],
    "customer_card": [
        {"type": "procChanceBonus", "value": 0.10, "trigger": "passive"},
    ],
}

DESCRIPTION_OVERRIDES = {
    "walrus_tusk": "В начале боя: получить 1 шип. +8% урона, +1 защиты.",
    "thorn_whip": "При попадании: +1 шип. +1 урона за каждый шип.",
    "bloodthorne": "При попадании: +1 шип. Потратить 1 шип: +1 HP и ещё +1 шип. +1 урона за шип.",
    "tusk_poker": "При попадании: 50% шанс +1 шип. +1 урона за шип.",
    "tusk_piercer": "В начале боя: +4 шипа. При попадании: потратить 1 шип → +9 урона следующей атаке.",
    "spiked_shield": "При блоке: 30% шанс +1 шип.",
    "spiked_collar": "В начале боя: +1 шип.",
    "hungry_blade": "В начале боя: +1 шип. При попадании: +1 шип. +1 урона за шип.",
    "hero_sword": "В начале боя: всё оружие получает +1 урона.",
    "hero_long_sword": "В начале боя: всё оружие получает +3 урона.",
    "crossblades": "В начале боя: всё оружие получает +10 урона.",
    "fortunas_grace": "В начале боя: +5 удачи.",
    "leather_armor": "В начале боя: +45 блока.",
    "stone_armor": "В начале боя: +120 блока. Каждые 4с: снять 1 яд с себя и 2 с противника.",
    "holy_armor": "В начале боя: +65 блока и +2 блока за каждый предмет брони. Каждые 2.2с: потратить 2 блока (очистка).",
    "vampiric_armor": "В начале боя: −50 HP → +100 регена и +4 блока. Каждые 2.8с: −10 HP → +20 регена.",
    "protective_purse": "+1 слот рюкзака. В начале боя: +15 блока.",
    "ice_armor": "В начале боя: +100 блока и +4 блока.",
    "moon_armor": "В начале боя: +50 блока и +20 за каждый предмет брони. Каждые 2.6с: +3 блока.",
    "burning_sword": "При попадании: 60% +1 жар. При 7 жара: оружие +1 урона.",
    "burning_blade": "При попадании: +1 жар. При 6 жара: оружие +1 урона.",
    "friendly_fire": "Каждые 3с: −1 жар → +2 жара. При 20 жара: 100 маг. урона.",
    "manathirst": "При попадании: +2 маны, +1 урона за ману. При 30 маны: 10 маг. урона.",
    "frostbite": "+1 урона за яд у противника. Когда у противника 30 яда: +12 HP (раз).",
    "death_scythe": "Когда у противника 25 яда: +65% крит (раз).",
    "gloves_of_haste": "В начале боя: предметы срабатывают на 20% быстрее.",
    "whetstone": "В начале боя: оружие +1 урона.",
    "dancing_dragon": "В начале боя: +1 усиление и +1 удача. +1 урона за усиление.",
    # --- Этап 3 ---
    "dark_lantern": "В начале боя: −50% HP. Перед поражением: перерождение с 50% HP, неуязвимость 1.5с, урон и яд по тегам огня.",
    "hammer": "При попадании: 45% шанс оглушить на 0.5с.",
    "poison_dagger": "При попадании: +2 яда.",
    "darksaber": "При атаке: потратить 1 ману → +1 яд противнику. +0.5 урона за каждый дебафф противника.",
    "glowing_crown": "Каждые 2.4с: снять 1 дебафф и +5 HP. Потратить 10 выносливости: неуязвимость 2с.",
    "king_crown": "Каждые 2.4с: +8 HP. Потратить 10 выносливости: неуязвимость 2.5с.",
    "heroic_potion": "При нулевой выносливости: +2 выносливости и +1 усиление.",
    "strong_heroic_potion": "При нулевой выносливости: +4 выносливости и +1 усиление.",
    "winged_boots": "При HP ниже 70%: +1 удача, снять 15 дебаффов, уклонение (раз).",
    "stone_skin_potion": "При 45 блока: −15 HP → +30 регена (раз).",
    "holy_spear": "При попадании: снять 1 дебафф. Потратить 25 выносливости: неуязвимость 3с.",
    "ripsaw_blade": "При попадании: украсть 1 урона с оружия противника.",
    "katana": "При попадании: украсть 1 урона с оружия противника.",
    "belladonnas_shade": "При попадании: 70% шанс +2 яда.",
    "corrupted_armor": "В начале боя: +85 блока. Каждые 2.4с: снять 2 дебаффа.",
    "stone_golem": "При попадании: +1 блок, 30% шанс оглушить на 0.5с.",
    "snake": "Каждые 2.2с: наложить 2 яда на противника.",
    "goobert": "После 6 активаций предметов: +12 HP и +2 жара (раз).",
    "king_goobert": "После 6 активаций: +35 HP. Потратить 4 выносливости: неуязвимость 1.5с.",
    "pan": "+1 урона за каждый предмет с тегом «еда».",
    # --- Этап 4 ---
    "dagger": "При оглушении противника: дополнительная атака.",
    "poison_dagger": "При попадании: +2 яда. При оглушении: доп. атака.",
    "spectral_dagger": "При атаке: −1 мана → +6 урона. При оглушении: доп. атака.",
    "fortunas_hope": "При попадании: 75% шанс +1 удача.",
    "eggscalibur": "+1 урона за каждый предмет с тегом «еда».",
    "rat_chef": "В начале боя: +1 удача за еду. Каждые 7с: +2 выносливости и +1 усиление. Быстрее на 15% за питомца/еду.",
    "heart_container": "Каждые 3с: +1 сердце. При 7 сердцах: +100 макс. HP и +2 регена (раз).",
    "hedgehog": "Каждые 5с: 10 маг. урона +0.5 за шип. При HP <70%: +2 шипа и +25 HP (раз).",
    "hyper_hedgehog": "Каждые 5с: 10 маг. урона +1 за шип. При HP <70%: +4 шипа и +35 HP (раз).",
    "banana": "Каждые 5с: +4 HP и +1 выносливости.",
    "acorn_collar": "+2 удачи. +5% крит за каждую удачу.",
    "snake": "В начале боя: +4 маны и +40 макс. HP за питомца. Каждые 2.2с: +2 яда.",
    "stamina_sack": "+3 слота рюкзака. +1 макс. выносливости.",
    "lucky_clover": "В начале боя: +1 удача.",
    "shovel": "При попадании: 40% шанс +1 яда.",
    # --- Этап 5 ---
    "health_potion": "При HP ниже 50%: +11 HP и снять 4 дебаффа (раз).",
    "strong_health_potion": "При HP ниже 50%: +24 HP, +3 регена и снять 4 дебаффа (раз).",
    "mana_potion": "При HP ниже 50%: +4 маны и +18 макс. HP (раз).",
    "strong_mana_potion": "При HP ниже 50%: +9 маны и +25 макс. HP (раз).",
    "stone_shoes": "При HP ниже 70%: +1 удача, +45 блока, −35% маг. урона на 7с (раз).",
    "bloody_dagger": "При попадании: +1 усиление. +4 лечения за вампирский предмет. Доп. атака при оглушении.",
    "cursed_dagger": "Доп. атака при оглушении. +2 яда. +1% крит за дебафф противника.",
    "pandamonium": "+1 урона за еду. +1 яд при попадании. +4% крит за дебафф противника.",
    "fancy_fencing_rapier": "При попадании: −3 удачи → +3 урона. При промахе: +3 удачи.",
    "prismatic_sword": "+15% вампиризм за холод. +8% скорости за огонь. 12% +1 мана при попадании.",
    "moon_shield": "+30% блока. В начале боя: +5 блока.",
    "miss_fortune": "Каждые 2.1с: −1 удача → +3 к самому большому стаку.",
    "squirrel": "Каждые 4с: украсть 1 урона у оружия противника. Быстрее на 15% за питомца/еду.",
    "squirrel_archer": "При попадании: украсть 1 урона. Быстрее на 15% за питомца/еду.",
    "toad": "Каждые 3.8с: +1 мана и +1 яд. При 10 усилениях: +12 HP (раз).",
    "crow": "Каждые 3с: украсть 1 урона. Предметы на 6% быстрее за питомца/дебафф.",
    "pestilence_flask": "Когда противник лечится: +3 яда ему и +1 себе.",
    "strong_pestilence_flask": "Когда противник лечится: +3 яда. Каждые 3.5с: +3 яда.",
    "garlic": "Каждые 4с: +3 блока. 30% снять 1 дебафф.",
    "carrot": "Каждые 2.7с: снять 1 дебафф. 55% +1 удача.",
    "blueberries": "Каждые 3.5с: +1 к самому слабому стаку (×2 маны при 10+ маны).",
    "heart_of_darkness": "Каждые 4с: украсть 2 урона. При 7 сердцах: +100 HP и +4 регена. Быстрее за тёмные предметы.",
    # --- Этап 6 ---
    "spear": "При попадании: снять 4 блока у противника.",
    "bow_and_arrow": "При попадании: +1 урона (до 7).",
    "piercing_arrow": "+50% крит. урона. При крите: снять 15 блока.",
    "axe": "При попадании: +1 усиление.",
    "falcon_blade": "В начале боя: предметы на 40% быстрее. Атакует дважды.",
    "molten_dagger": "При атаке: −1 жар → +2 урона. Доп. атака при оглушении.",
    "molten_greatsword": "При попадании: −2 жара → +4 жара.",
    "flame_whip": "При атаке: −1 жар → +8 урона и +4 шипа.",
    "belladonnas_whisper": "При попадании: +1 яд. +0.5 урона за дебафф противника.",
    "magic_staff": "При атаке: −3 маны → +6 урона и +2 урона навсегда.",
    "staff_of_fire": "При атаке: −2 маны и −2 жара → +6 урона.",
    "staff_of_unhealing": "Каждые 2с: +20 HP.",
    "serpent_staff": "При атаке: −4 маны → +2 урона и +1 яд (40% дубль).",
    "critwood_staff": "При атаке: −3 маны → +7 урона и гарантированный крит 1.5с.",
    "snow_stick": "При попадании: +3 яда противнику и +2 себе.",
    "spell_scroll_frostbolt": "Каждые 3с: 5 маг. урона. До 3+ использований за холод.",
    "dragonscale_armor": "При боевой ярости (<50% HP): +45 блока, −8% урона.",
    "shield_of_valor": "Блок +30%. При блоке (30%): −14 урона, −0.7 выносливости.",
    "frozen_buckler": "Блок +15%. При блоке (30%): −12 урона, −0.9 выносливости, +1 яд.",
    "vampiric_gloves": "Через 4с: предметы на 35% быстрее.",
    "gloves_of_power": "+20% урона, −10% скорости. При попадании: +7 усиления.",
    "claws_of_attack": "Каждые 4 попадания: +1 шип.",
    "doom_cap": "Каждые 3.1с: +3 яда.",
    "oil_lamp": "В начале боя: +2 жара. Каждые 3.4с: оружие +1 урона.",
    "vampiric_potion": "Оба ниже 80% HP: +3 маны, 15 маг. урона с 100% вампиризмом.",
    "chili_pepper": "Каждые 4.5с: +1 жар и +5 HP. При 10 жара: снять 1 дебафф.",
    "fly_agaric": "Каждые 3.6с: +1 яд.",
    "cheese": "Каждые 3.8с: +10 макс. HP и случайный бафф.",
    "rainbow_goobert": "После 9 активаций: +40 HP, +2 выносливости, +20 блока, +20 HP, оружие +4, +3 яда.",
    "piggybank": "В начале боя: +2 макс. HP за каждый предмет «начало боя».",
    # --- Этап 7 ---
    "broom": "При промахе: +2 урона след. атаке. При попадании: 33% +1 яд.",
    "poison_spear": "При попадании: +3 яда, +2 себе, снять 6 блока.",
    "molten_spear": "Перед промахом: −1 жар → попадание и +5 урона. Снять 5 блока.",
    "wooden_buckler": "При блоке/уклонении (30%): −7 урона, −0.3 выносливости противнику.",
    "sun_shield": "При 12 блока: 4 маг. урона. При блоке (30%): −14 урона, −0.7 выносливости.",
    "sun_armor": "Каждые 3с: −1 блок → +12 HP и снять 2 дебаффа.",
    "blood_amulet": "В начале боя: +2 регена и +20 макс. HP.",
    "cauldron": "В магазине: улучшить зелье. Каждые 2.6с: случайный эффект (лечение/реген/удача).",
    "healing_herbs": "В начале боя: +2 удачи.",
    "villain_sword": "+4 урона за каждый тёмный предмет.",
    "strong_vampiric_potion": "Оба ниже 80% HP: +5 маны, 20 маг. урона с 100% вампиризмом.",
    "mana_orb_charm": "При активации: 50% +1 мана. −35 выносливости: неуязвимость 2с.",
    "pocket_sand": "В начале боя: +1 удача.",
    "impractically_large_greatsword": "При 5+ жара: +1 усиление.",
    "molten_greatsword": "При попадании: −2 жара → +4 жара. При 5+ жара: +1 усиление.",
    # --- Этап 8 ---
    "lightsaber": "−3 выносливости: замедление 8 на 6с. +1 урона за дебафф противника.",
    "demonic_flask": "Противник <50% HP: 5 маг. урона за каждый его дебафф.",
    "strong_demonic_flask": "Противник <50% или вы <25% HP: 8 маг. урона за дебафф.",
    "divine_potion": "При 10+ дебаффах: снять 10.",
    "strong_divine_potion": "При 10+ дебаффах: снять 10 и +8 к сильнейшему стаку.",
    "strong_stone_skin_potion": "При 45 блока: −15 HP → +35 регена и +2 усиления.",
    "leather_boots": "При HP <70%: +1 удача и +15 блока (раз).",
    "dragonskin_boots": "При боевой ярости: снять 3 дебаффа, +1 удача, +20 блока.",
    "cap_of_discomfort": "В начале боя: −25% получаемого урона на 5с.",
    "steel_goobert": "После 6 активаций: оружие +2 урона и +16 блока.",
    "light_goobert": "После 6 активаций: +20 HP и +6 яда.",
    "poison_goobert": "После 5 активаций: +9 HP и +4 яда.",
    "chili_goobert": "После 6 активаций: +12 HP и +2 жара.",
    "carrot_goobert": "После 5 активаций: снять 3 дебаффа и +2 усиления.",
    "rat": "Каждые 3.3с: 5 маг. урона и 75% +1 яд.",
    "torch": "При попадании: 25% +1 усиление.",
    "burning_torch": "В начале боя: +2 жара. При попадании: 30% +1 усиление.",
    "forging_hammer": "+1 урона за каждый стак.",
    "lucky_piggy": "В начале боя: +2 удачи. Эффекты на 12% чаще.",
    "draconic_orb": "При 15 жара: 3 гарантированных крита. Каждые 3.8с: украсть 1 жар.",
    "obsidian_dragon": "При 8 жара: +2 урона и гарантированный крит.",
    "phoenix": "При атаке: −10 HP. Перерождение с 6% HP.",
    "dragon_claws": "+10% к прокам. Боевая ярость: предметы на 40% быстрее.",
    "offering_bowl": "В начале боя: +1 удача. Контейнер: переработка в магазине.",
    # --- Этап 9 ---
    "ruby_chonk": "При попадании: +1 жар. При <12 выносливости: 30% оглушение 0.4с.",
    "ice_dragon": "При попадании: +1 холод противнику. При 10 холода у него: +90 блока. −20% маг. урона.",
    "amethyst_whelp": "В начале боя: +4 случайных стака. При попадании: украсть стак у противника.",
    "shelly": "Каждые 13с: снять 6 дебаффов и +40 HP. +25% к снятию дебаффов.",
    "wolpertinger": "Каждые 5с: +3 к слабейшим стакам. +0.7% реген выносливости за стак.",
    "paradise_birb": "Каждые 2.7с: 7% шанс +1 усиление, +7% лечения и скорости (до ×10).",
    "cthulhu": "Каждые 3.3с: 10 маг. урона с вампиризмом и случайный стак. Быстрее за еду.",
    "tim": "При попадании: 50% украсть стак. Противник <30% HP: +50 HP и +5 к сильнейшему стаку.",
    "corrupted_crystal": "Противник <30% HP: +50% урона. При 7 дебаффах: +6 к сильнейшему стаку. Каждые 3.9с: +2 яда.",
    "lump_of_coal": "70% +1 урона при атаке. В начале боя: +8 жара. Каждые 3с: случайный стак.",
    "burning_coal": "12% +6 урона и +1 жар. В начале боя: +12 жара. Каждые 5с: +2 жара, снять 3 дебаффа.",
    "magic_torch": "При попадании: −1 выносливости → +1 урона этому предмету и оружию.",
    "sir_sand": "В начале боя: оба игрока −25% урона на 7с и +3 яда.",
    "stone": "1 бросок за бой. При попадании: уничтожить 4 стака противника.",
    "snowball": "В начале боя: наложить 2 холода на противника.",
    "snowmaster": "Каждые 1.3с: холод (или себе, если у него <10). Снять 1 дебафф. Быстрее за холод.",
    "frozen_flame": "В начале боя: +8 жара за огонь. При 6 жара: +2 жара противнику. +1.5% крит.",
    "blood_harvester": "Стаки на 100% эффективнее. Предметы на 5% быстрее за каждый стак (макс. +200%).",
    "pop": "Каждые 8с: +3 яда. Атаки на 3% быстрее за каждый заполненный сокет (до 60%).",
    "lil_chestnut": "При обновлении магазина: 40% торговое предложение. Каждые 6с: +3 к сильнейшему стаку. На 1% быстрее за стоимость предметов.",
    "flute": "Каждые 4.7с: +14 блока, +2 выносливости или +2 удачи (случайно). На 10% быстрее за соседа (до 60%).",
    "fanfare": "Каждые 3с: −1 выносливости противнику. Каждые 5 срабатываний: оглушение 1с.",
    "mrs_struggles": "Каждые 4.7с: снять по 1 стаку каждого типа у противника. На 10% быстрее за тёмный предмет.",
    "prismatic_orb": "В начале боя: мана за магию/огонь. Каждые 8с: +1 ко всем стакам.",
    "unsettling_presence": "+30% лечения как маг. урон. Каждые 3с: −1 стак и +12 HP.",
    "time_dilator": "Предметы на 30% медленнее. Каждую 1с: самый долгий кулдаун −6%.",
    "more_stats": "В начале боя: +12% макс. HP. +5% урона оружия.",
    "djinn_lamp": "Каждые 1.6с: +1 удача, мана или шип (случайно).",
    "pineapple": "Каждые 2.9с: +1 удача и +4 HP. Быстрее за еду.",
    "snowcake": "Каждые 3с: +1 холод. При 10+ холода у противника: +10% маг. урона и 10 маг. урона.",
    "platinum_customer_card": "+10% к прокам. Каждые 4с: снять 2 дебаффа.",
    # --- Этап 10 ---
    "shell_totem": "Каждые 3.4с: +8 HP при HP <70%, иначе +1 усиление. Быстрее за святой предмет.",
    "happy_bomb": "Каждые 12с: 20 маг. урона.",
    "artifact_stone_cold": "1 бросок. При попадании: +3 холода. Каждые 5с: +1 холод и +4 HP.",
    "artifact_stone_heat": "1 бросок. При попадании: +3 жара. При 10 жара: оружие +8 урона.",
    "artifact_stone_death": "1 бросок. Урон от усталости при попадании. +7% крит за уровень усталости противника.",
    "bag_of_stones": "Камни можно метать многократно.",
    "pumpkin": "50% оглушение. При усталости: +10 жара. Быстрее за еду.",
    "emerald_whelp": "В начале боя: +3 яда себе. При попадании: +3 яда противнику.",
    "sapphire_whelp": "В начале боя: +6 блока. При попадании: −1 блок → +10 блока и случайный стак.",
    "deck_of_cards": "В начале боя: +2 удачи. +5% к прокам.",
    "white_eyes_blue_dragon": "При открытии: +12 удачи (+5 за карту). +3 холода противнику.",
    "holo_fire_lizard": "При открытии: +8% маг. урона, 12 (+4/карта) маг. урона, +4 жара.",
    "darkest_lotus": "При открытии: +4 усиления (+4/карта). Украсть 3 стака.",
    "jimbo": "При открытии: +7 случайных стаков. +10% к прокам.",
    "fanny_pack": "Предметы внутри на 10% быстрее.",
    "holdall": "В начале боя: +8 жара за нейтральный предмет внутри.",
    "ranger_bag": "Внутри: +10% крит и +3% за стак.",
    "duffle_bag": "При HP <50%: боевая ярость, −20% урона, +20 блока.",
    "storage_coffin": "При активации предмета внутри: 22% +1 яд.",
    "relic_case": "Каждые 2.5с: оружие внутри +1 урона.",
    "utility_pouch": "Оружие внутри: +30% урона, −30% скорости. +35% вампиризм.",
    "potion_belt": "+8% к прокам. После 4 зелий: снять 10 дебаффов.",
    "vineweave_basket": "+10% лечения и +3% за предмет природы внутри.",
    "present": "В начале боя: +5 удачи и +15 HP.",
    "maneki_neko": "+1 удача и +3% к прокам.",
    "wooden_sword": "25% +1 урона (до 2).",
    "shortbow": "При попадании: +1 урона (до 3).",
    "shiny_shell": "Каждые 5с: +5 HP и +3 за соседний святой предмет.",
    "wolf_badge": "При HP <50%: боевая ярость на 5с (раз).",
    "magic_badge": "В начале боя: +5 маны. +30% к дублированию баффов.",
    "flame_badge": "Магазин: предметы пироманта. +5% к прокам.",
    "twine_badge": "Магазин: предметы авантюриста. +5% к прокам.",
    "leather_bag": "+4 слота рюкзака.",
    "customer_card": "Магазин: повышение редкости. +10% к прокам.",
    "wonky_snowman": "50% замедление при попадании.",
    "ace_of_spades": "При попадании: 50% +15% урона на 4с.",
    "the_lovers": "В начале боя: +3 HP.",
    "the_fool": "В начале боя: +1 удача.",
    "reverse": "В начале боя: +2 усиления.",
}


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    items = data["items"] if isinstance(data, dict) else data
    desc_fixed = 0
    effects_patched = 0

    for item in items:
        iid = item.get("id")
        word = infer_stack_word(item)

        if iid in DESCRIPTION_OVERRIDES:
            item["description"] = DESCRIPTION_OVERRIDES[iid]
            desc_fixed += 1
        else:
            new_desc = fix_description(item.get("description") or "", word)
            if new_desc != item.get("description"):
                item["description"] = new_desc
                desc_fixed += 1

        if iid in BATTLE_EFFECT_PATCHES:
            item["effects"] = merge_effects(item.get("effects"), BATTLE_EFFECT_PATCHES[iid])
            effects_patched += 1

    if isinstance(data, dict):
        data["items"] = items
        out = data
    else:
        out = items
    SRC.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Описаний исправлено: {desc_fixed}")
    print(f"Предметов с новыми effects: {effects_patched}")


if __name__ == "__main__":
    main()
