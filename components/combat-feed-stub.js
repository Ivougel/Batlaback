/**
 * Заглушка CombatLog до lazy-load components/combat-feed.js.
 */
var __combatFeedStubQueue = [];

var CombatLog = {
  _stub: true,
  addEvent(payload) {
    if (payload && String(payload.text || "").trim()) __combatFeedStubQueue.push({ ...payload });
    while (__combatFeedStubQueue.length > 48) __combatFeedStubQueue.shift();
  },
  ingestBattleLog() {},
  trackSynergies() {},
  resetSynergyTracking() {},
  notifyPurchase() {},
  notifySell() {},
  notifyItemPlaced() {},
  notifyCraft() {},
  notifyBackpack() {},
  notifyGemSocketed() {},
  hideTooltip() {},
  onExternalTooltipHide() {},
  isEnabled() {
    return true;
  },
  setEnabled() {},
  syncCombatFeedPhase() {},
  init() {},
};

var __combatFeedLoadPromise = null;

function ensureCombatFeedReady() {
  if (typeof CombatLog !== "undefined" && CombatLog.init && !CombatLog._stub) {
    CombatLog.init();
    return Promise.resolve();
  }
  if (typeof RuntimeLoader === "undefined" || !RuntimeLoader.ensureCombatFeedBundle) {
    return Promise.resolve();
  }
  if (!__combatFeedLoadPromise) {
    __combatFeedLoadPromise = RuntimeLoader.ensureCombatFeedBundle()
      .then(() => {
        if (typeof CombatLog?.init === "function" && !CombatLog._stub) CombatLog.init();
      })
      .finally(() => {
        __combatFeedLoadPromise = null;
      });
  }
  return __combatFeedLoadPromise;
}

function syncCombatFeedSettingsUi() {
  const cb = document.getElementById("settings-combat-feed-enabled");
  if (!cb) return;
  if (typeof CombatLog?.isEnabled === "function" && !CombatLog._stub) {
    cb.checked = CombatLog.isEnabled();
  }
}

function initCombatFeedControls() {
  void ensureCombatFeedReady();
}
