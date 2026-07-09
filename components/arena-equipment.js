/**
 * Заглушка: боевое отображение экипировки на арене отключено.
 */
const ArenaEquipment = (() => {
  function clearAll() {}
  function onResize() {}
  function syncBattle() {}
  function triggerDamageStrike() {}
  function tickPhysicsFromClock() {
    return false;
  }
  function estimateBattleDuration() {
    return 24;
  }

  return {
    clearAll,
    onResize,
    syncBattle,
    triggerDamageStrike,
    tickPhysicsFromClock,
    estimateBattleDuration,
  };
})();
