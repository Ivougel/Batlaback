/**
 * Доменные типы игры (постепенное расширение).
 */

export type GameMode = "solo" | "path" | "versus" | "hardbot" | "lobby" | "lobby2p" | "campaign";

export type LoaderMode = "solo" | "lobby" | "lobby2p" | "hardbot" | (string & {});

export type InputMode = "gamepad" | "touch" | "mouse";

export type PrepHudPresetId = "hero-card" | "unit-frame";

export type PrepHeroCardPresetId = "classic" | "banner";

export type VisualThemeId = "meadow" | "diablo";

export type EmojiOrbitPresetId = "slow" | "normal" | "fast" | "custom";

export type PerfTier = "low" | "medium" | "high";

export type BattleSide = "player" | "enemy";

export type SoundThemeId = "classic" | "dopamine" | "gentle" | "meat" | "mirror" | "forest" | (string & {});

export type IntroStepId =
  | "mode"
  | "tdDifficulty"
  | "campaignTrial"
  | "player"
  | "companion"
  | "opponent"
  | "summary";

export interface PendingCraftEntry {
  key: string;
  recipeId: string;
  recipe: object;
  itemUids: string[];
  registeredRound: number;
  anchor: { col: number; row: number };
}

export interface TrackedBuild {
  classId: string;
  buildId: string;
  buildName: string;
  buildEmoji: string;
  className: string;
  itemIds: string[];
}

export interface CraftRecipeInput {
  itemId: string;
  count: number;
}

export interface CraftRecipe {
  id: string;
  inputs: CraftRecipeInput[];
  output: string;
  hint?: string;
}

export interface PlacementSlotCatalogEntry extends PlacementSlotDef {
  id: string;
  desc?: string;
  hostApply?: object;
  guestApply?: object;
}

export interface ItemUnlockSpec {
  minLevel: number;
  scope: "shared" | "hero";
  heroId: string | null;
}

export interface ItemUnlockTiersApi {
  SHARED_STARTER_IDS: Set<string>;
  HERO_STARTER_IDS: Record<string, Set<string>>;
  getSpec(itemId: string): ItemUnlockSpec | null;
  getMinLevel(itemId: string): number;
  isStarterForHero(itemId: string, heroId: string): boolean;
  listShopItemIdsForHero(heroId: string): string[];
  rebuild(): void;
}

export interface HeroProgressRecord {
  unlocked: boolean;
  level: number;
  xp: number;
  runs: number;
  wins: number;
  bestRound: number;
}

export interface MetaRunReward {
  classId?: string;
  heroXp?: number;
  wins?: number;
  losses?: number;
  round?: number;
  runsCompleted?: number;
  heroUnlocked?: string[];
  beforeHeroes?: Record<string, HeroProgressRecord>;
  levelResult?: { leveledUp: boolean; newLevel: number };
  lobbyWon?: boolean;
  playerEliminated?: boolean;
}

export interface MetaProgressApi {
  PATH_MODE_ID: string;
  MAX_HERO_LEVEL: number;
  HERO_UNLOCK_RULES: Record<string, object>;
  isEnabled(): boolean;
  isPathMode(modeId: string | null): boolean;
  isActiveForPicker(): boolean;
  isActiveForRun(): boolean;
  setPickerMode(modeId: string | null): void;
  setRunMode(modeId: string | null): void;
  load(): void;
  save(): void;
  resetProgress(): void;
  isHeroUnlocked(classId: string): boolean;
  getHeroUnlockHint(classId: string): string;
  getHeroLevel(classId: string): number;
  getMaxHeroLevel(): number;
  getHeroRecord(classId: string): HeroProgressRecord;
  xpToNextLevel(classId: string): number;
  isItemUnlocked(itemId: string, heroClass: string): boolean;
  getItemUnlockHint(itemId: string, heroClass: string): string;
  effectiveLevelForItem(itemId: string): number;
  countItemProgress(heroClass: string): { unlocked: number; total: number };
  recordRunEnd(payload?: object): MetaRunReward | null;
  renderRunRewardHtml(reward: MetaRunReward | null): string;
  refreshClassPickerCards(): void;
  applyClassCardState(card: Element | null, classId: string): void;
  getLastRunReward(): MetaRunReward | null;
}

export interface PrepShopSideState {
  gold: number;
  classId: string;
  items: object[];
  bench: Array<{ itemId: string; uid: string; carriedItems?: Array<{ itemId: string }> }>;
  shop: Array<string | null>;
  shopFrozen: boolean[];
  shopReadyForRound?: number;
  bonusUniqueGranted?: boolean;
}

export interface PrepShopRuntime {
  getPrepViewSide(): string;
  getPhase(): string;
  getRound(): number;
  getGameOver(): boolean;
  getSelectedBench(): number;
  setSelectedBench(value: number): void;
  getGoldSpentTotal(): number;
  addGoldSpent(amount: number): void;
  getGoldEarnedTotal(): number;
  getRecentBattleResults(): string[];
  getPlayerItems(): object[];
  getEnemyItems(): object[];
  getShopDidDrag(): boolean;
  setShopDidDrag(value: boolean): void;
  getSuppressShopClickUntil(): number;
  getSideState(side: string): PrepShopSideState;
  canEditPrepSide(side: string): boolean;
  isVersusMode(): boolean;
  isEnemyPrepEditable(): boolean;
  log(message: string): void;
  draw(): void;
  recalcSynergies(): void;
  updateUI(): void;
  playPrepSfx(id: string): void;
  isSyntheticMouseFromTouch(): boolean;
  isTouchUi(): boolean;
  isPrepCommerceDragActive(): boolean;
  getSideCompanionId?(side: string): string | null;
  getSideMutationId?(side: string): string | null;
  getSideMutationFormId?(side: string): string | null;
  beginPendingShopDrag(index: number, event: MouseEvent, side: string): void;
  beginPendingBenchDrag(index: number, event: MouseEvent, side: string): void;
  startBenchDrag?(index: number, event: MouseEvent, side: string): void;
  shouldUseFixedShop?(side: string): boolean;
  applyFixedShop?(side: string): void;
  canRefreshShop?(side: string): boolean;
  canSellShop?(side: string): boolean;
  isLobby2pSplitPrep?(): boolean;
  shouldApplyMetaUnlockForSide?(side: string): boolean;
  renderTdBuildPanel?(): void;
}

export interface PlacementSlotActiveEntry {
  hostUid: string;
  guestUid: string | null;
  hostId: string;
  guestId: string | null;
  slotId: string;
  kind: PlacementSlotKind;
  desc: string;
  hostName: string;
  guestName: string | null;
  cell: [number, number];
}

export interface BuildKeyChip {
  icon: string;
  tipTitle: string;
  tipLines: string[];
  active: boolean;
  kind: string;
  ariaLabel: string;
}

export type PlacementSlotKind = "star" | "diamond";

export interface PlacementSlotDef {
  kind: PlacementSlotKind;
  at: [number, number];
  acceptTags?: string[];
  acceptItemIds?: string[];
  effects?: object[];
}

export interface PresentationTickContext {
  phase?: string;
  presentState?: object;
  elapsed?: number;
}

export interface PresentationChannelSpec {
  gapMs: number | ((ctx: PresentationTickContext) => number);
  enabled?: (ctx: PresentationTickContext) => boolean;
  tick: (now: number, ctx: PresentationTickContext) => void;
}
