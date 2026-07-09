/**
 * Ключи веток (unlock_build) и каталог троек для bias магазина.
 */
import type { BuildKeyChip } from "../types/game";

type BuildUnlockSpec = {
  id: string;
  label: string;
  mutation?: string;
  companion?: string;
  supportItemIds?: string[];
};

type KeyItemDef = {
  id: string;
  name: string;
  icon: string;
  unlockBuild: string;
  description?: string;
  isBuildKey: boolean;
  [key: string]: unknown;
};

function getBuildKeyPlayerDescription(buildId: string): string {
  const spec = BUILD_UNLOCK_CATALOG[buildId];
  const label = spec?.label || buildId;
  switch (buildId) {
    case "triple_pyro_mage":
      return `Открывает ветку «${label}»: чаще огненные опоры и рецепты в магазине.`;
    case "triple_zrecrela":
      return `Открывает ветку «${label}»: видны рецепты и чаще святые опоры.`;
    case "triple_paladin":
      return `Открывает ветку «${label}»: чаще святые опоры ветки.`;
    case "triple_assassin":
      return `Открывает ветку «${label}»: чаще ядовитые опоры.`;
    default:
      return `Открывает ветку «${label}»: чаще предметы этой ветки в магазине.`;
  }
}

const BUILD_UNLOCK_CATALOG: Record<string, BuildUnlockSpec> = {
  triple_pyro_mage: {
    id: "triple_pyro_mage",
    label: "Огненный пиромант",
    mutation: "m_pyro",
    companion: "s_spark",
    supportItemIds: ["fire_staff"],
  },
  triple_zrecrela: {
    id: "triple_zrecrela",
    label: "ЖРЕЦИЛА",
    mutation: "p_zrecrela",
    companion: "s_spark",
    supportItemIds: ["armor_holy_choir", "accessory_musical_slippers"],
  },
  triple_paladin: {
    id: "triple_paladin",
    label: "Паладин",
    mutation: "p_paladin",
    companion: "s_blade",
    supportItemIds: ["weapon_holy_mace", "boots_steadfast"],
  },
  triple_assassin: {
    id: "triple_assassin",
    label: "Ассасин",
    mutation: "r_assassin",
    companion: "s_shadow",
    supportItemIds: ["dagger", "armor_light_weave"],
  },
};

const KEY_ITEM_CATALOG: Record<string, KeyItemDef> = {
  key_ember_codex: {
    id: "key_ember_codex",
    name: "Пепельный кодекс",
    icon: "📕",
    color: "#e85d04",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "fire"],
    description: getBuildKeyPlayerDescription("triple_pyro_mage"),
    isBuildKey: true,
    unlockBuild: "triple_pyro_mage",
    metaEffects: [{ type: "unlock_build", build: "triple_pyro_mage", phase: "passive" }],
    buildHints: "Ключ ветки · положите в рюкзак",
  },
  key_hymn_folio: {
    id: "key_hymn_folio",
    name: "Фолиант гимна",
    icon: "📜",
    color: "#d4a72c",
    shape: [[0, 0]],
    rarity: "epic",
    cost: 5,
    tags: ["key", "holy", "musical"],
    description: getBuildKeyPlayerDescription("triple_zrecrela"),
    isBuildKey: true,
    unlockBuild: "triple_zrecrela",
    metaEffects: [{ type: "unlock_build", build: "triple_zrecrela", phase: "passive" }],
    buildHints: "Ключ ветки · положите в рюкзак",
  },
  key_paladin_oath: {
    id: "key_paladin_oath",
    name: "Клятва паладина",
    icon: "⚔️",
    color: "#79c0ff",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "holy"],
    description: getBuildKeyPlayerDescription("triple_paladin"),
    isBuildKey: true,
    unlockBuild: "triple_paladin",
    metaEffects: [{ type: "unlock_build", build: "triple_paladin", phase: "passive" }],
    buildHints: "Ключ ветки · положите в рюкзак",
  },
  key_shadow_pact: {
    id: "key_shadow_pact",
    name: "Договор тени",
    icon: "🗡️",
    color: "#8b949e",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "poison"],
    description: getBuildKeyPlayerDescription("triple_assassin"),
    isBuildKey: true,
    unlockBuild: "triple_assassin",
    metaEffects: [{ type: "unlock_build", build: "triple_assassin", phase: "passive" }],
    buildHints: "Ключ ветки · положите в рюкзак",
  },
};

const SHOP_KEY_ROLL_CHANCE = 0.1;

function registerKeyItemsInCatalog(): void {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.values(KEY_ITEM_CATALOG).forEach((def) => {
    ITEM_CATALOG[def.id] = { ...def };
  });
}

function collectUnlockedBuilds(items: Array<{ itemId?: string }> = []): Set<string> {
  const builds = new Set<string>();
  if (typeof collectMetaEffectsFromItems !== "function") return builds;
  collectMetaEffectsFromItems(items).forEach((effect: { type?: string; build?: string }) => {
    if (effect.type === "unlock_build" && effect.build) builds.add(effect.build);
  });
  return builds;
}

function hasBuildKeyInLoadout(items: Array<{ itemId?: string }> = [], buildId: string): boolean {
  return (items || []).some((item) => {
    const def = item?.itemId
      ? (ITEM_CATALOG[item.itemId] as { isBuildKey?: boolean; unlockBuild?: string } | undefined)
      : undefined;
    return def?.isBuildKey && def.unlockBuild === buildId;
  });
}

function getShopEligibleKeyItems(ctx: { round?: number; loadoutItems?: Array<{ itemId?: string }> } = {}): KeyItemDef[] {
  const roundNum = ctx.round ?? 1;
  if (roundNum < 4) return [];
  const loadoutItems = ctx.loadoutItems || [];
  return Object.values(KEY_ITEM_CATALOG).filter((def) => {
    if (loadoutItems.some((item) => item?.itemId === def.id)) return false;
    if (hasBuildKeyInLoadout(loadoutItems, def.unlockBuild)) return false;
    return true;
  });
}

function tryRollShopKeyItem(ctx: { round?: number; loadoutItems?: Array<{ itemId?: string }> } = {}): string | null {
  if ((ctx.round ?? 1) < 4) return null;
  if (Math.random() > SHOP_KEY_ROLL_CHANCE) return null;
  const pool = getShopEligibleKeyItems(ctx);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function collectPrepBuildKeyIconChips(items: Array<{ itemId: string }> = []): BuildKeyChip[] {
  const unlocked = collectUnlockedBuilds(items);
  const keys = (items || []).filter((item) => ITEM_CATALOG[item?.itemId]?.isBuildKey);
  const chips: BuildKeyChip[] = [];

  keys.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const spec = BUILD_UNLOCK_CATALOG[def?.unlockBuild];
    const label = spec?.label || def?.unlockBuild || def?.name;
    chips.push({
      icon: def?.icon || "🔑",
      tipTitle: def?.name || "Ключ ветки",
      tipLines: [`ветка «${label}»`, def?.description || ""].filter(Boolean),
      active: true,
      kind: "key",
      ariaLabel: `${def?.name || "Ключ"}: ветка «${label}»`,
    });
  });

  [...unlocked]
    .filter((buildId) => !keys.some((item) => ITEM_CATALOG[item.itemId]?.unlockBuild === buildId))
    .forEach((buildId) => {
      const spec = BUILD_UNLOCK_CATALOG[buildId];
      chips.push({
        icon: "🗝️",
        tipTitle: spec?.label || buildId,
        tipLines: ["Ветка открыта", "В магазине чаще предметы этой ветки"],
        active: true,
        kind: "key",
        ariaLabel: `${spec?.label || buildId}: ветка открыта`,
      });
    });

  return chips;
}

function renderPrepBuildKeyStatusHtml(items: Array<{ itemId: string }> = []): string {
  const chips = collectPrepBuildKeyIconChips(items);
  if (!chips.length) return "";
  const chipsHtml = chips.map((chip) => (
    typeof renderPrepModIconChipHtml === "function"
      ? renderPrepModIconChipHtml(chip)
      : `${chip.icon}`
  )).join("");
  return `
    <div class="prep-modifier-strip prep-modifier-strip--key prep-modifier-strip--icons" aria-label="Ключи веток">
      <div class="prep-modifier-chips prep-modifier-chips--icons">${chipsHtml}</div>
    </div>
  `;
}

function scoreTripleSupportShopBias(item: { recommendedTriple?: boolean }, ctx: object = {}): number {
  if (!item?.recommendedTriple) return 0;
  return typeof scoreShopItemPickWeight === "function"
    ? scoreShopItemPickWeight(item, ctx) - 1
    : 0;
}

registerKeyItemsInCatalog();
