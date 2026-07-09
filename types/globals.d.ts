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

declare function playGameSfx(id: string, opts?: { heavy?: boolean }): void;
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
};

declare const CombatLog: {
  notifyCraft(item: object): void;
  notifyPurchase(item: object): void;
  notifySell(item: object, refund: number): void;
};

declare const rt: {
  getPhase(): string;
};

declare function getSideState(side: string): { containers: object[]; items: object[]; bench?: object[] };
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
  prepLobbyFxReduced(): boolean;
  equipAutoAttackEnabled(): boolean;
  battleGameLoopGapMs(): number;
  battleHudLiteGapMs(): number;
  battleProfileTickMs(): number;
  battleFloatPresentGapMs(): number;
  prepFxStepHz(): number;
  lobbyHpTickMs(): number;
  lobbyProfileTickMs(): number;
  lobbyAvatarTickMs(): number;
  lobbyChromeTickMs(): number;
  lobbyEmotionRefreshMs(): number;
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

declare const ThoughtArena: {
  tickFromClock(now: number): boolean;
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
  lobbyRosterEmojiSize(): number;
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
  syncLobby2pBenchFabBadges?: () => void;
  syncPrepBenchFabBadge?: () => void;
  syncPrepHeroCardPortraitSize?: () => void;
  PLACEMENT_SLOT_DEFS: Record<string, import("./game").PlacementSlotCatalogEntry[]>;
  MetaProgress: import("./game").MetaProgressApi;
}

interface PrepCountdownApi {
  PREP_COUNTDOWN_SEC: number;
  BATTLE_RESULT_VIEW_SEC: number;
  onPrepPhaseStarted(phaseKey: string): void;
  resetLobbyArming(): void;
  tickPrepTimerAudio(remainingSec: number, active: boolean, phaseKey?: string): void;
  isActive(): boolean;
  cancel(): void;
  start(onComplete?: () => void): void;
  tick(dt: number): boolean;
  render(): void;
  tryArmLobbyAutoCountdown(remainingSec: number): void;
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
declare function collectMetaEffectsFromItems(items: object[]): Array<{ type?: string; build?: string }>;
declare function registerPrepShopRuntime(deps: import("./game").PrepShopRuntime): void;
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
declare function collectShopPoolModifiers(items: object[]): object | null;
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

declare function readGameScale(): number;
declare function isTabletSideLayout(): boolean;
