/**
 * Доменные типы игры (постепенное расширение).
 */

export type GameMode = "classic";

export type LoaderMode = "classic" | (string & {});

export type InputMode = "gamepad" | "touch" | "mouse";

export type PrepHudPresetId = "hero-card" | "unit-frame";

export type PrepHeroCardPresetId = "classic" | "banner";

export type VisualThemeId = "meadow" | "diablo";

export type EmojiOrbitPresetId = "slow" | "normal" | "fast" | "custom";

export type PerfTier = "low" | "medium" | "high";

export type BattleSide = "player" | "enemy";

export type BattleStackType =
  | "spikes"
  | "block"
  | "empower"
  | "regen"
  | "luck"
  | "heat"
  | "mana"
  | "cold"
  | "poison";

export interface BattleSideState {
  poisonStacks?: number;
  slowDebuff?: number;
  slowTimer?: number;
  groundFire?: number;
  groundFireTimer?: number;
  stunTimer?: number;
  invulnerableTimer?: number;
  reviveCharges?: number;
  reviveHpRatio?: number;
  reviveInvuln?: number;
  hp?: number;
  maxHp?: number;
  stamina?: number;
  maxStamina?: number;
  hearts?: number;
  coldStacks?: number;
  block?: number;
  luck?: number;
  classId?: string;
  stacks?: Partial<Record<BattleStackType, number>>;
  items?: Array<{ itemId: string; uid: string; runtime?: Record<string, unknown>; col?: number; row?: number }>;
}

export interface StatusChip {
  id: string;
  icon: string;
  value: number;
  title: string;
  lines: string[];
}

export interface ArenaAttackPose {
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
}

export interface ArenaAttackStyleDef {
  id: string;
  phases: { windup: number; strike: number; recover: number };
  hits: () => number[];
  thoughtReaction?: { kind: string; intensity: number; duration: number };
  windup: (atk: ArenaAttackCtx, t: number, vmin: number, params?: ArenaItemParams) => ArenaAttackPose;
  strike: (atk: ArenaAttackCtx, t: number, vmin: number, params?: ArenaItemParams) => ArenaAttackPose;
  recover: (atk: ArenaAttackCtx, t: number, vmin?: number, params?: ArenaItemParams) => ArenaAttackPose;
}

export interface ArenaItemParams {
  spin: number;
  arc: number;
  wobble: number;
  hitsBonus: number;
}

export interface ArenaAttackCtx {
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  homeX?: number;
  homeY?: number;
  homeVpX?: number;
  homeVpY?: number;
  strikeX?: number;
  strikeY?: number;
  useViewport?: boolean;
  useEmojiAvatarArc?: boolean;
  styleId?: string;
}

export interface ArenaEquipBody {
  itemId: string;
  side: string;
  homeX: number;
  homeY: number;
  renderX: number;
  renderY: number;
  x: number;
  y: number;
  rotation?: number;
  displayScale?: number;
  opacity?: number;
}

export interface ArenaAttackState extends ArenaAttackCtx {
  styleId: string;
  styleParams?: ArenaItemParams;
  phase: string;
  phaseT: number;
  hitsTotal: number;
  hitsDone: number;
  hitReacted: boolean;
  projectileFade?: number | null;
  projectileVisual?: ArenaAttackPose | null;
}

export interface ArenaAttackStylesApi {
  STYLES: Record<string, ArenaAttackStyleDef>;
  BY_ITEM: Record<string, string>;
  resolveStyle(def: { id?: string; tags?: string[]; arenaAttackStyle?: string; icon?: string; shape?: unknown[] } | null | undefined): ArenaAttackStyleDef;
  resolveStyleId(def: { id?: string; tags?: string[]; arenaAttackStyle?: string; icon?: string; shape?: unknown[] } | null | undefined): string;
  createAttack(body: ArenaEquipBody, atkBase: Partial<ArenaAttackState> & { styleId?: string }): ArenaAttackState;
  stepAttack(body: ArenaEquipBody, atk: ArenaAttackState, dt: number, vmin: number): boolean;
  itemParams(itemId: string): ArenaItemParams;
  isProjectileStyle(styleId: string): boolean;
  getProjectileGlyph(styleId: string, itemId: string): string;
}

export type AttackVisualId = "slash" | "arrow" | "bolt" | "magic" | "orb" | "aoe" | "support";

export type AttackMotionType = "melee" | "projectile" | "magic" | "aoe" | "support";

export interface AttackEvent {
  id: string;
  timestamp: number;
  sourceItemUid: string;
  sourceItemId: string;
  sourceTeam: string;
  targetTeam: string;
  attackType: AttackMotionType;
  visual: AttackVisualId;
  icon: string;
  damage: number;
  damageType: string;
  duration: number;
  delay: number;
  effects: {
    crit: boolean;
    miss: boolean;
    poison: boolean;
    burn: boolean;
    heal: boolean;
    block: boolean;
    slow: boolean;
  };
}

export interface AttackEventContext {
  visual?: AttackVisualId;
  targetTeam?: string;
  damage?: number;
  damageType?: string;
  isCrit?: boolean;
  miss?: boolean;
}

export interface MetaEffect {
  type?: string;
  phase?: string;
  value?: number;
  tag?: string;
  classId?: string;
  chance?: number;
  sourceItemId?: string;
  sourceUid?: string;
  sourceName?: string;
  target?: string;
  build?: string;
}

export interface ShopPoolModifiers {
  offerTags: Set<string>;
  offerClasses: Set<string>;
  excludePlayerClass: boolean;
  uniqueChanceBonus: number;
  bonusUnique: number;
  sellBonusPct: number;
  startingValue: number;
}

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
  containers?: object[];
  bench: Array<{ itemId: string; uid: string; carriedItems?: Array<{ itemId: string }> }>;
  shop: Array<string | null>;
  shopFrozen: boolean[];
  shopReadyForRound?: number;
  bonusUniqueGranted?: boolean;
  pendingShopBuffs?: number;
  _shopItemsNotGold?: boolean;
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

export interface ItemPresentationState {
  locked: boolean;
  hint: string;
  showStats: boolean;
  showName: boolean;
  showDescription: boolean;
}

export interface SynergyRule {
  id?: string;
  desc?: string;
  adjacency?: "strong" | "weak" | "both";
  neighborTags?: string[];
  target?: "self" | "neighbor";
  apply?: { type: string; value?: number; cap?: number };
}

export interface SynergyEntry {
  items: string[];
  itemUids: string[];
  names: string[];
  icons: string[];
  condition: string;
  effect: string;
  bonus: string;
  desc: string;
  ruleId?: string;
  applyType?: string;
  type: string;
  strength: string;
  status: string;
}

export type PlacementSlotKind = "star" | "diamond";

export interface PlacementSlotDef {
  kind: PlacementSlotKind;
  at: [number, number];
  acceptTags?: string[];
  acceptItemIds?: string[];
  /** Предмет с эффектом «начало боя» (как у Piggybank). */
  acceptBattleStart?: boolean;
  /** Предмет-хост со своими ⭐ (как для Flute). */
  acceptStarHost?: boolean;
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
