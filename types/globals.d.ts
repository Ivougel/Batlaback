/**
 * Глобальные типы для checkJs / TypeScript.
 */

/// <reference path="./game.d.ts" />

/** @type {Record<string, object>} */
var ITEM_CATALOG;

/** @type {Record<string, object>} */
var CLASS_CATALOG;

/** @type {import("./game").ItemUnlockTiersApi} */
var ItemUnlockTiers;

/** @type {Set<string>} */
var CRAFT_OUTPUT_IDS;

/** @type {{ itemId?: string } | null} */
var dragPayload;

/** @type {{ type?: string; side?: string } | null} */
var dragFrom;

declare function cellRect(team: string, col: number, row: number): { x: number; y: number; w: number; h: number };
declare function roundRect(x: number, y: number, w: number, h: number, r: number): void;
declare function getRecipesUsingIngredient(itemId: string): import("./game").CraftRecipe[];
declare function isCraftRecipeAvailable(recipe: import("./game").CraftRecipe, ctx?: object | null): boolean;
/** @type {string | null | undefined} */
var pendingPlayerClass;

/** @type {string | null | undefined} */
var playerClass;

/** @type {import("./game").MetaProgressApi} */
var MetaProgress;

declare function shouldFilterToPool120(): boolean;
declare function getVisibleCraftRecipes(ctx?: object | null): import("./game").CraftRecipe[];
declare function getAdjacentItems(
  pool: object[],
  item: object,
): Map<string, { strong: boolean; item: object }>;
declare function resolveLoadoutPlacement(
  containers: object[],
  items: object[],
  outputId: string,
  col: number,
  row: number,
  rotation: number,
  excludeUid: string | null,
): { valid: boolean; col: number; row: number; rotation: number };
declare function createPlacedItem(itemId: string, col: number, row: number, rotation: number): object;
declare function isItemInPool120(id: string): boolean;
declare function isCraftOutputItemId(id: string): boolean;
declare function getItemShopRarityTier(item: { id?: string }): string;
declare function isShopEligibleItem(item: { id?: string }, heroId: string, level: number): boolean;
declare function getItemIcons(def: object): string[];
declare function getItemIconCell(item: object): [number, number];
declare function findItemAtSlot(items: object[], col: number, row: number): object | null;
declare function findLoadoutItemPlacement(
  containers: object[],
  items: object[],
  itemId: string,
  rotation: number,
): { col: number; row: number; rotation: number } | null;
declare function escapeTooltipHtml(text: unknown): string;
declare function getItemDisplayName(def: object): string;
declare function renderPrepModIconChipHtml(chip: object): string;
declare function normalizeMechanicTags(text: unknown): string;
declare function formatMechanicTagsHtml(text: unknown, options?: { normalize?: boolean }): string;
declare function formatItemTagMechanic(tag: string): string;
declare function tryResolveCrafting(
  containers: object[],
  items: object[],
  ctx?: object | null,
): { items: object[]; crafted: import("./game").CraftRecipe[] };
declare function getRecipeForOutput(itemId: string): import("./game").CraftRecipe | null;
declare function getCraftTooltipLines(itemId: string, side?: string | null): object[];
declare function isCraftIngredient(itemId: string): boolean;
declare function getAllCraftRecipes(): import("./game").CraftRecipe[];
declare function getCraftOutputItemIds(): string[];
declare function getCraftIngredientItemIds(): string[];
declare function syncCraftPartnerBenchDom(benchIndices?: number[]): void;
declare function clearCraftPartnerBenchDom(): void;
declare function drawPrepCraftHighlights(
  ctx: CanvasRenderingContext2D,
  time: number,
  side: string,
  items: object[],
  bench: object[],
  dragContext?: { shopItemId?: string; containers?: object[]; ctx?: object } | null,
): boolean;
declare function drawPrepPendingCraftHighlights(
  ctx: CanvasRenderingContext2D,
  time: number,
  side: string,
  items: object[],
): boolean;
declare function syncCraftPreviewFromDrag(): void;

/** @type {(id: string) => object | undefined} */
var getClassById;

/** @type {(item: object) => object} */
var createRuntimeState;

/** @type {(item: object) => [number, number][]} */
var getItemCells;

/** @type {(host: object, guest: object, effect: object) => void} */
var applySynergyEffect;

/** @type {(tag: string) => string} */
var formatTagLabel;

/** @type {number} */
var CELL_TILE_PAD;

/** @type {string} */
var phase;

/** @type {{ speed?: number } | null | undefined} */
var replayPlayback;

/** @type {object | null | undefined} */
var battleState;

declare function countTaggedItemsOnSide(side: import("./game").BattleSideState, tag: string): number;
declare function isGemItem(itemId: string | null | undefined): boolean;
declare function getItemSocketCount(itemId: string): number;
declare function playGameSfx(id: string, opts?: Record<string, unknown>): boolean;
declare function playButtonSfx(target: Element | string | null): boolean;
declare function setSfxVolume(volume: number): number;
declare function syncSfxVolumeUi(volume: number): void;
declare function pushBattleLog(state: object, entry: object): void;
declare function battleTeamLabel(team: string): string;
declare function queueHitAnimation(
  state: object,
  item: object | null,
  team: string,
  text: string,
  color: string,
): void;
declare function applyOnReviveItemEffects(
  state: object | null | undefined,
  side: object,
  foe: object | undefined,
  team: string,
): void;
declare function applyGainStackEffect(
  state: object,
  effect: object,
  item: object,
  self: object,
  team: string,
  foe?: object | null,
): unknown;
declare function getProfileAvatarViewportCenter(team: string): { x: number; y: number };
declare function resolveFloatOriginViewport(
  options?: object,
  kind?: string,
  targetTeam?: string,
): { x: number; y: number };
declare function allocateHeroFloatLane(state: object, team: string): number;
declare function getProfileAvatarFloatAnchor(team: string, lane: number): { x: number; y: number } | null;
declare function getItemViewportCenter(item: object, team: string): { x: number; y: number };
declare function cellRect(team: string, col: number, row: number): { x: number; y: number; w: number; h: number };
declare function canvasPointToViewport(x: number, y: number): { x: number; y: number };
declare function recordBenefitEffect(
  state: object,
  team: string,
  item: object,
  amount: number,
  benefitKind: string,
): void;
declare function isAggregatedWeaponDamage(text: string, color: string, kind: string): boolean;
declare function getBattleStatsStaminaBarCenter(team: string): { x: number; y: number };
declare function getBattlefieldCenterViewport(): { x: number; y: number };
declare function easeOutCubic(t: number): number;
declare function getFatigueOriginViewport(team: string): { x: number; y: number };
declare function getProfileDebuffChipCenter(team: string, debuffId: string): { x: number; y: number };
declare function getBattleStatsPanelCenter(): { x: number; y: number };
declare function sampleFloatTrajectory(
  trajectory: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  team: string,
  ease: number,
): { x: number; y: number };
declare function quadraticBezier(
  from: { x: number; y: number },
  ctrl: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
): { x: number; y: number };
declare function getArcControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  team: string,
): { x: number; y: number };
declare function tickAttackVisuals(state: object, dt: number): void;
declare function enqueueAttackVisual(state: object, event: import("./game").AttackEvent): void;
declare function resolveItemAttackVisual(
  def: { attackVisual?: string; tags?: string[] } | null | undefined,
  effect?: { type?: string; damageType?: string } | null,
): import("./game").AttackVisualId;
declare function resolveAttackTargetTeam(
  sourceTeam: string,
  effect: { type?: string } | null | undefined,
  def: { effects?: Array<{ type?: string }> } | null | undefined,
): string;
declare function buildAttackEvent(
  state: { elapsed?: number; _attackEventUid?: number },
  item: { uid: string; itemId: string },
  sourceTeam: string,
  effect: { type?: string; damageType?: string } | null | undefined,
  context?: import("./game").AttackEventContext,
): import("./game").AttackEvent;
declare function emitAttackEvent(state: object, event: import("./game").AttackEvent): void;
declare function emitEffectAttackVisual(
  state: object,
  item: { uid: string; itemId: string },
  sourceTeam: string,
  effect: { type?: string; damageType?: string },
  context?: import("./game").AttackEventContext,
): void;
declare function hideBattleCountdownOverlay(): void;
declare function renderBattleCountdown(state: { countdown: { active: boolean; label: string | null } }): void;
declare function executeBattleStart(): void;
declare function initEmojiOrbitSpeed(): void;
declare function initEmojiOrbitSpeedControls(): void;
declare function syncEmojiOrbitSpeedSettingsUi(): void;
declare function getEmojiOrbitDurationSec(): number;
declare function getEmojiOrbitParticleDurationSec(particleIndex?: number): number;
declare function initLightBattleFxControls(): void;
declare function syncLightBattleFxSettingsUi(): void;

/** @type {number} */
var round;

/** @type {string} */
var prepViewSide;

/** @type {import("./game").CraftRecipe[]} */
var ITEM_RECIPES;

declare const SfxThemes: {
  defaultId: string;
  META: Record<string, { id: string; label: string; emoji: string; hint?: string }>;
  build?: (
    themeId: string,
    api: {
      tone: (freq: number, duration: number, opts?: object) => void;
      noiseBurst: (duration: number, opts?: object) => void;
      arpeggio: (notes: number[], gap?: number, opts?: object) => void;
    },
  ) => Record<string, (options?: Record<string, unknown>) => void>;
};

declare const CombatLog: {
  notifyCraft(item: object): void;
  notifyPurchase(item: object): void;
  notifySell(item: object, refund: number): void;
  addEvent?(event: { type?: string; text?: string; mergeKey?: string; icon?: string }): void;
};

declare const rt: {
  getPhase(): string;
};

declare function getSideState(side: string): import("./game").PrepShopSideState;
declare function getShopContextForSide(side?: string, opts?: { isReroll?: boolean }): {
  playerClass?: string;
  round?: number;
  shopModifiers?: import("./game").ShopPoolModifiers | null;
};
declare function getBaseShopPool(playerClass?: string, round?: number): Array<{ id: string; cost?: number; craftOnly?: boolean; tags?: string[]; classRestriction?: string }>;
declare function getExpandedShopPool(ctx: object): Array<{ id: string; cost?: number; craftOnly?: boolean; tags?: string[]; classRestriction?: string }>;
declare function upgradeShopItemToHigherTier(itemId: string, ctx: object): string | null;
declare function detectMatchingCraftClusters(
  containers: object[],
  items: object[],
  ctx: object,
): Array<{ recipe: { id: string } & object; clusterItems: Array<{ uid: string }>; anchor: { col: number; row: number } }>;
declare function getCraftContextFromGame(sideKey?: string): object;
declare function applyRecipe(
  containers: object[],
  items: object[],
  recipe: object,
  clusterItems: object[],
): { items: object[]; recipe: object } | null;
declare function log(message: string): void;
declare function playPrepSfx(id: string): void;
declare function playPrepCommerceSfx(kind: string, phase: string): void;
declare function playPrepBuyFanfare(def: object): void;
declare function playPrepItemPlacedSfx(item: object, def?: object | null): void;
declare function isVersusMode(): boolean;
declare function recalcSynergies(): void;
declare function renderBench(): void;
declare function renderShop(): void;
declare function updateUI(): void;
declare function getClassDetailGuide(classId: string): {
  builds: Array<{ id: string; name: string; emoji?: string; items?: string[] }>;
} | null;
declare function refreshClassDetailBuildButtons(): void;
declare function rebuildGameSfxTheme(id: string): void;
declare function getSfxVolume(): number;
declare function getMusicVolume(): number;
declare function setMusicVolume(volume: number): number;
declare function syncMusicVolumeUi(volume: number): void;
declare function getMusicTrackId(): string;
declare function setMusicTrack(trackId: string, options?: { autoplay?: boolean }): string;
declare function syncMusicTrackSettingsUi(): void;
declare function initMusicTrackControls(): void;
declare function isNegrovEnabled(): boolean;
declare function setNegrovEnabled(enabled: boolean): boolean;
declare function syncNegrovEnabledUi(enabled: boolean): void;
declare function initMusic(): void;
declare function tryStartMusic(): void;

declare const GameSfx: {
  play: typeof playGameSfx;
  playButton: typeof playButtonSfx;
  getVolume: typeof getSfxVolume;
  setVolume: typeof setSfxVolume;
  rebuildTheme: typeof rebuildGameSfxTheme;
};
declare function flushDeferredLayoutPasses(): void;
declare function scheduleCanvasFit(): void;
declare function applyUiLayout(): void;
declare function settlePrepLayoutForReveal(): void;
declare function getPendingCraftBoardUids(side: string): Set<string>;
declare function syncPendingCraftClustersForSide(side: string, currentRound?: number): void;
declare function syncPendingCraftClustersOnState(
  state: { containers?: object[]; items?: object[] } | null | undefined,
  sideKey: string,
  currentRound?: number,
): void;
declare function resolveDuePendingCraftsForSideInstant(side: string): boolean;
declare function resolveDuePendingCraftsOnPrepEntry(): void;
declare function syncDuePendingCraftClustersOnPrepEntry(): void;
declare function runDuePendingCraftMergeForSide(side: string, onComplete?: () => void): void;
declare function hasActiveCraftMergeAnimations(side?: string | null): boolean;
declare function isCraftMergeBlockingPrep(): boolean;
declare function getCraftMergeChargingUids(side: string): Set<string>;
declare function getCraftMergeHiddenUids(side: string): Set<string>;
declare function boardPointToViewportClient(x: number, y: number): { x: number; y: number } | null;
declare function boardCellClientCenter(col: number, row: number, team?: string): { x: number; y: number };
declare function boardItemClientCenter(item: object, team?: string): { x: number; y: number } | null;
declare function tickCraftMergeAnimations(dt: number): void;
declare function resetPendingCraftState(): void;
declare function initSoundTheme(): void;
declare function initSoundThemeControls(): void;
declare function applySoundTheme(themeId: string, options?: { preview?: boolean }): void;
declare function getSoundThemeId(): string;

declare function updateBattleControlsUI(): void;
declare function drawBackground(): void;
declare function render(): void;
declare function syncUnitFrameHudChrome(): void;
declare function syncPrepUnitFrameHudChrome(): void;
declare function renderPlayerProfiles(): void;

declare function isGameLoopSuspended(): boolean;
declare function isBattleResultFrozen(): boolean;
declare function isBattleResultIdle(): boolean;
declare function drawEmotionLayer(
  canvas: HTMLCanvasElement | null,
  state: object,
  elapsed: number,
): void;
declare function tickBattleArenaPresentation(state: object, elapsed: number): void;
declare function syncStackOrbitFromBattle(state: object): void;
declare function resetStackOrbitVfx(): void;
declare function handleStackOrbitEvent(ev: { type?: string; side?: string; stackType?: string; emoji?: string; count?: number }): void;
declare function getSideStack(side: import("./game").BattleSideState, stackType: string): number;
declare function isSideStunned(side: import("./game").BattleSideState | null | undefined): boolean;
declare function updateBattleAnalyzer(state: object, dt: number): void;
declare function syncBattleAuraFrame(state: object, elapsed: number): void;
declare function shouldSkipFlankBattleCanvasDraw(): boolean;
declare function tickFlankBattleDomOverlay(state: object): void;
declare function renderBattleEffectsOverlay(state: object): void;

interface BattleFxTierApi {
  emotionPresentGapMs(): number;
  arenaPresentGapMs(): number;
  arenaPhysicsGapMs(): number;
  thoughtStepGapMs(): number;
  stackOrbitGapMs(): number;
  stackOrbitParticlesEnabled(): boolean;
  auraPresentGapMs(): number;
  battleAuraFrameEnabled(): boolean;
  isLightBattleFx(): boolean;
  battleResultCountdownTickMs(): number;
  resolvePerfTier(force?: boolean): import("./game").PerfTier;
  isPerfTierAtMost(maxTier: import("./game").PerfTier): boolean;
  isPerfConstrainedDevice(): boolean;
  shouldThrottleGameLoop(): boolean;
  isTouchUiDevice(): boolean;
  isStaticBattleThoughts(): boolean;
  equipThoughtReactionsEnabled(): boolean;
  battleEmotionReactive(): boolean;
  emotionAnalyzeGapMs(): number;
  equipIdleWobbleEnabled(): boolean;
  equipSyncGapMs(): number;
  prepFxReduced(): boolean;
  equipAutoAttackEnabled(): boolean;
  battleGameLoopGapMs(): number;
  battleHudLiteGapMs(): number;
  battleProfileTickMs(): number;
  battleFloatPresentGapMs(): number;
  prepFxStepHz(): number;
  prepHudMoodIntervalMs(): number;
  prepHudMoodCycleEnabled(): boolean;
  prepSynergyFxEnabled(): boolean;
  prepPassLaughFxEnabled(): boolean;
  prepDragArcFxEnabled(): boolean;
  battleHeroLayoutSyncDeepEnabled(): boolean;
  battleResultTheaterEnabled(): boolean;
  battleResultCountUpEnabled(): boolean;
  auraRunnersEnabled(): boolean;
  applyBattleFxTierFlags(): void;
  syncLightBattleFxSettingsUi(): void;
  combatFeedEnterFxEnabled(): boolean;
  battleInventoryPrewarmEnabled(): boolean;
  battleHeroLayoutSyncThrottleMs(): number;
  canvasFitMinIntervalMs(): number;
  canvasFitDeepSyncEnabled(): boolean;
  layoutPassThrottleMs(): number;
}

declare const BattleFxTier: BattleFxTierApi;

declare const ArenaEquipment: {
  tickPhysicsFromClock(now: number): boolean;
};

declare const ArenaAttackStyles: import("./game").ArenaAttackStylesApi;

declare const ThoughtArena: {
  tickFromClock(now: number): boolean;
  triggerEquipHitReaction?(
    victimSide: string,
    payload: { kind: string; intensity: number; duration: number; fromSide: string; styleId: string; itemId: string },
  ): void;
};

declare const ScreenTransitions: ScreenTransitionsApi;

interface ScreenTransitionsApi {
  TIMING: object;
  INTRO_ORDER: readonly string[];
  prefersReducedScreenMotion(): boolean;
  isScreenTransitioning(): boolean;
  clearPhaseTransitionLock(): void;
  showScreenOverlay(el: HTMLElement | null, variant?: string): Promise<void>;
  hideScreenOverlay(el: HTMLElement | null, variant?: string): Promise<void>;
  getIntroDirection(fromStep: string, toStep: string): "forward" | "back";
  pulseIntroStep(overlay: HTMLElement | null, direction: string): Promise<void>;
  transitionPhase(
    newPhase: string,
    applyPhase: (phase: string) => void,
    afterTransition?: () => void,
  ): Promise<void>;
  transitionFromResultToPrep(
    applyPhase: (phase: string) => void,
    afterTransition?: () => void,
    hideOverlayFn?: () => void,
  ): Promise<void>;
  crossfadeMenuToGame(onMidpoint?: () => void): Promise<void | boolean>;
  crossfadeGameToMenu(onMidpoint?: () => void): Promise<void | boolean>;
}

interface LayoutScalesApi {
  readCssPx(name: string, fallback?: number): number;
  uiScale(): number;
  gameScale(): number;
  rosterEmojiSize(): number;
  typeScale(): number;
  typePx(remSize: number): number;
  gamePx(basePx: number): number;
  fxFloatScale(): number;
  fxProjectileScale(): number;
  battleFxScale(): number;
  battleFxPx(basePx: number): number;
  uiSurface(): string;
  isUiSurface(name: string): boolean;
  isTabletSide(): boolean;
}

interface RuntimeLoaderApi {
  BUNDLES: Record<string, readonly string[]>;
  scriptsForMode(mode: string): string[];
  ensureModeBundle(mode: string): Promise<void>;
  ensureCombatFeedBundle(): Promise<void>;
  preloadCombatFeedBundle(): void;
  preloadModeBundle(mode: string): void;
  isBundleLoaded(mode: string): boolean;
}

interface PresentationClockApi {
  registerChannel(id: string, spec: import("./game").PresentationChannelSpec): void;
  unregisterChannel(id: string): void;
  wake(id: string): void;
  shouldOwnLoop(id: string): boolean;
  isPaused(): boolean;
  isBattleCentralized(): boolean;
  tick(now: number, ctx?: import("./game").PresentationTickContext): void;
  setCentralizedBattle(value: boolean): void;
}

interface Window {
  RuntimeLoader: RuntimeLoaderApi;
  PresentationClock: PresentationClockApi;
  LayoutScales: LayoutScalesApi;
  PrepCountdown: PrepCountdownApi;
  EmojiOrbitSpeed: EmojiOrbitSpeedApi;
  BattleFxTier: BattleFxTierApi;
  ScreenTransitions: ScreenTransitionsApi;
  getTrackedBuild: () => import("./game").TrackedBuild | null;
  setTrackedBuild: (classId: string, buildId: string) => boolean;
  clearTrackedBuild: () => void;
  isBuildTrackedItem: (itemId: string) => boolean;
  isTrackedBuildActive: (classId: string, buildId: string) => boolean;
  renderShopTrackBadge: (itemId: string) => string;
  getShopCardTrackExtraClasses: (itemId: string) => string;
  syncBuildTrackShopBar: () => void;
  playPrepCommerceSfx: (kind: string, phase: string) => void;
  playPrepBuyFanfare: (def: object) => void;
  playPrepItemPlacedSfx: (item: object, def?: object | null) => void;
  flushDeferredLayoutPasses: () => void;
  scheduleCanvasFit: () => void;
  applyUiLayout: () => void;
  settlePrepLayoutForReveal: () => void;
  isPrepBenchPopoverOpen?: () => boolean;
  isPrepShopPopoverOpen?: () => boolean;
  syncPrepBenchFabBadge?: () => void;
  syncPrepHeroCardPortraitSize?: () => void;
  countStarredGuestsForHost: (
    hostItem: object,
    items: object[],
    filterSlot?: (slot: import("./game").PlacementSlotCatalogEntry) => boolean,
  ) => number;
  countTagForItemEffect: (
    side: object,
    hostItem: object | null | undefined,
    tag: string,
  ) => number;
  PLACEMENT_SLOT_DEFS: Record<string, import("./game").PlacementSlotCatalogEntry[]>;
  MetaProgress: import("./game").MetaProgressApi;
  GameSfx: typeof GameSfx;
  getSfxVolume: typeof getSfxVolume;
  setSfxVolume: typeof setSfxVolume;
  syncSfxVolumeUi: typeof syncSfxVolumeUi;
  playGameSfx: typeof playGameSfx;
  playButtonSfx: typeof playButtonSfx;
  rebuildGameSfxTheme: typeof rebuildGameSfxTheme;
  getMusicVolume: typeof getMusicVolume;
  setMusicVolume: typeof setMusicVolume;
  syncMusicVolumeUi: typeof syncMusicVolumeUi;
  getMusicTrackId: typeof getMusicTrackId;
  setMusicTrack: typeof setMusicTrack;
  syncMusicTrackSettingsUi: typeof syncMusicTrackSettingsUi;
  initMusicTrackControls: typeof initMusicTrackControls;
  isNegrovEnabled: typeof isNegrovEnabled;
  setNegrovEnabled: typeof setNegrovEnabled;
  syncNegrovEnabledUi: typeof syncNegrovEnabledUi;
  initMusic: typeof initMusic;
  tryStartMusic: typeof tryStartMusic;
}

interface PrepCountdownApi {
  PREP_COUNTDOWN_SEC: number;
  BATTLE_RESULT_VIEW_SEC: number;
  onPrepPhaseStarted(phaseKey: string): void;
  tickPrepTimerAudio(remainingSec: number, active: boolean, phaseKey?: string): void;
  isActive(): boolean;
  cancel(): void;
  start(onComplete?: () => void): void;
  tick(dt: number): boolean;
  render(): void;
  scheduleBattleResultWindow(): void;
  clearBattleResultWindow(): void;
}

interface EmojiOrbitSpeedApi {
  PRESETS: Record<string, { label: string; durationSec: number }>;
  CUSTOM_MIN_SEC: number;
  CUSTOM_MAX_SEC: number;
  getEmojiOrbitPreset(): string;
  getEmojiOrbitDurationSec(): number;
  getEmojiOrbitParticleDurationSec(particleIndex?: number): number;
  setEmojiOrbitPreset(presetId: string): void;
  setEmojiOrbitCustomDuration(durationSec: number): void;
  applyEmojiOrbitSpeed(): void;
  syncEmojiOrbitSpeedSettingsUi(): void;
}

declare function collectUnlockedBuilds(items?: Array<{ itemId?: string }>): Set<string>;
declare function tryRollShopKeyItem(ctx?: object): string | null;
declare function getShopEligibleKeyItems(ctx?: object): object[];
declare function renderPrepBuildKeyStatusHtml(items?: Array<{ itemId: string }>): string;
declare function scoreTripleSupportShopBias(item: object, ctx?: object): number;
declare function collectMetaEffectsFromItems(items: object[]): import("./game").MetaEffect[];
declare function collectShopPoolModifiers(items: object[]): import("./game").ShopPoolModifiers;
declare function buyFromShopForTdTower(
  index: number,
  side: string,
  applyEntry: (entry: object) => boolean,
): boolean;
declare function syncShopHintsVisibility(): void;
declare function rollShopBatch(count: number, ctx: object): string[];
declare function rollShopItemGuaranteed(ctx: object): string;
declare function collectLoadoutTags(items: object[]): string[];
declare function loadoutHasUniqueItem(items: object[]): boolean;
declare function registerPrepShopRuntime(deps: import("./game").PrepShopRuntime): void;
declare function resolveShopEntryMeta(entryId: string): { def?: object; cost?: number; entryId?: string } | null;
declare function applyShopRefreshMeta(
  side: string,
  items: object[],
  unfrozen: number[],
  st: object,
  ctx: object,
  log: (msg: string) => void,
): void;
declare function applyShopEnterMeta(side: string, items: object[], log: (msg: string) => void): boolean;
declare function applyShopBuyMeta(
  side: string,
  items: object[],
  purchasedId: string,
  st: object,
  ctx: object,
  log: (msg: string) => void,
): void;
declare function getSellBonusMultiplier(items: object[]): number;
declare function getRarityCardClasses(rarity: string, base: string): string;
declare function getRarityNameColor(rarity: string): string;
declare function renderItemShapeMiniHTML(def: object, opts?: { size?: string }): string;
declare function getItemIconShellClass(def: object): string;
declare function renderItemIconsHTML(def: object): string;
declare function buildItemCardHTML(def: object, opts?: object): string;
declare function bindItemTooltipEvents(
  el: Element,
  itemId: string,
  side: string | null,
  source: string,
): void;
declare function getPrepShopSlotCount(): number;
declare function scoreShopItemPickWeight(item: object, ctx: object): number;

declare function getPlacementSlotsForItem(itemId: string): import("./game").PlacementSlotCatalogEntry[];
declare function getPlacementSlotCell(
  hostItem: object,
  slot: import("./game").PlacementSlotCatalogEntry,
): [number, number];
declare function collectActivePlacementSlots(items: object[]): import("./game").PlacementSlotActiveEntry[];
declare function applyPlacementSlotModifiers(items: object[]): import("./game").PlacementSlotActiveEntry[];
declare function collectPlacementSlotLinkVisuals(
  items: object[],
  options?: { focusUid?: string | null },
): Array<{
  hostUid: string;
  guestUid: string | null;
  slotCol: number;
  slotRow: number;
  kind: string;
  mode: "active" | "preview";
}>;
declare function collectPlacementSlotVisualEntries(
  items: object[],
  options?: { focusUid?: string | null },
): Array<{ col: number; row: number; kind: string; mode: "active" | "preview" }>;
declare function collectHostPlacementSlotMarkers(
  hostItem: object | null | undefined,
): Array<{ col: number; row: number; kind: string; slotId: string }>;
declare function drawPrepPlacementSlotVisuals(
  ctx: CanvasRenderingContext2D,
  boardItems: object[],
  cellRectFn: (col: number, row: number) => object | null | undefined,
  options?: {
    isDragging?: boolean;
    previewItems?: object[] | null;
    previewUid?: string | null;
    dragHostItem?: object | null;
    time?: number;
  },
): void;
declare function drawAllPlacementSlotVisuals(
  ctx: CanvasRenderingContext2D,
  items: object[],
  cellRectFn: (col: number, row: number) => object | null | undefined,
): void;
declare function getPlacementSlotTooltipLines(itemId: string): string[];

declare function refreshGamepadPrepFocus(): void;
declare function restoreDomSparkleFromTooltipSource(): void;
declare function getShopCardTrackExtraClasses(itemId: string): string;
declare function renderShopTrackBadge(itemId: string): string;
declare function syncBuildTrackShopBar(): void;

declare function syncPrepHudCollapseChrome(): void;

declare function isClassicMode(): boolean;
declare function isMaxAccountMode(): boolean;
declare function getMechanicalClassId(classId: string | null | undefined): string | null;
declare function shouldApplyClassItemRestriction(): boolean;
declare function isItemAllowedForHeroClass(itemOrId: string | { classRestriction?: string }, heroClass: string | null | undefined): boolean;
declare function getLoadoutHeroClass(): string | null;
declare function isPathMode(): boolean;
declare function shouldApplyMetaItemUnlockForHero(heroClass: string | null | undefined): boolean;
declare function getItemPresentationState(
  itemId: string,
  heroClass: string | null | undefined,
  opts?: { heroClass?: string; forceMetaUnlock?: boolean },
): import("./game").ItemPresentationState;
declare function buildLockedItemTooltipLines(
  def: object,
  presentation: import("./game").ItemPresentationState,
): Array<{ text: string; style: string; color: string }>;
declare function formatSynergyHumanDesc(rule: import("./game").SynergyRule): string;
declare function formatActiveSynergyTooltipLines(activeSynergies: Array<{ desc?: string }>): string[];
declare function formatTagsList(tags: string[], sep?: string): string;
declare function isContainerItem(itemId: string): boolean;
declare function applySynergyModifiers(items: object[]): void;
declare function defItem(raw: object): object;
declare function resolveItemSlot(raw: object): string | null;
declare function listTripleSupportItems(filters?: { tripleId?: string }): object[];

/** @type {object[]} */
var playerItems;

/** @type {object[]} */
var enemyItems;

/** @type {{ col: number; row: number } | null} */
var hoverSlot;

/** @type {number} */
var GRID_INNER_W;

/** @type {number} */
var GRID_INNER_H;

/** @type {number} */
var GRID_COLS;

/** @type {number} */
var GRID_ROWS;

/** @type {number} */
var GRID_CELL_GAP;

/** @type {number} */
var GRID_GAP;

/** @type {number} */
var GRID_STRIDE;

/** @type {number} */
var GRID_PLAYER_X;

/** @type {number} */
var ENEMY_X;

/** @type {number} */
var GRID_CELL;

/** @type {number} */
var BACKPACK_Y;

declare function layoutGridOrigin(team: string): number;
declare function layoutBackpackY(): number;
declare function uiPx(value: number): number;

declare const synergyState: {
  previewSynergies: import("./game").SynergyEntry[];
  activeSynergies: import("./game").SynergyEntry[];
  enemyActiveSynergies: import("./game").SynergyEntry[];
  activeSynergyCells: object[];
  enemyActiveSynergyCells: object[];
  previewSynergyCells: object[];
  cellStates: Map<string, object>;
  isDragging: boolean;
};

declare function isBattleStartItem(itemId: string): boolean;
declare function countStarredGuestsForHost(
  hostItem: object,
  items: object[],
  filterSlot?: (slot: import("./game").PlacementSlotCatalogEntry) => boolean,
): number;
declare function countTagForItemEffect(
  side: object,
  hostItem: object | null | undefined,
  tag: string,
): number;

declare function readGameScale(): number;
declare function isTabletSideLayout(): boolean;
