/**
 * BB Fidelity: полноэкранный VS-экран перед боем (classic / versus).
 */
const BBVsOverlay = (() => {
  const HOLD_MS = 1800;
  const STALE_MS = 6000;

  let active = false;
  let onComplete = null;
  let timerId = null;
  let startedAt = 0;

  function shouldUse() {
    return typeof shouldUseBBVsScreen === "function" && shouldUseBBVsScreen();
  }

  function isActive() {
    return active;
  }

  function playSfx(id) {
    if (typeof playGameSfx === "function") playGameSfx(id);
    else if (typeof playPrepSfx === "function") playPrepSfx(id);
  }

  function resolvePortraitSrc(classId) {
    if (typeof getClassHeroPortraitSrc === "function") {
      return getClassHeroPortraitSrc(classId);
    }
    const cls = typeof getClassById === "function" ? getClassById(classId) : null;
    return cls?.heroPortraitSrc || cls?.iconSrc || null;
  }

  function resolveLabel(classId, side) {
    if (typeof isVersusMode === "function" && isVersusMode()) {
      return side === "player" ? "Игрок 1" : "Игрок 2";
    }
    if (typeof getHeroLabel === "function") {
      const hero = getHeroLabel(classId);
      if (hero) return hero;
    }
    const cls = typeof getClassById === "function" ? getClassById(classId) : null;
    if (side === "enemy" && cls?.name) return cls.name;
    return cls?.heroLabel || cls?.name || (side === "player" ? "Игрок" : "Противник");
  }

  function resolveSubLabel(classId) {
    const cls = typeof getClassById === "function" ? getClassById(classId) : null;
    return cls?.name || "";
  }

  function populateFighter(side, classId) {
    const portrait = document.getElementById(`bb-vs-${side}-portrait`);
    const name = document.getElementById(`bb-vs-${side}-name`);
    const sub = document.getElementById(`bb-vs-${side}-sub`);
    const src = resolvePortraitSrc(classId);
    if (portrait) {
      if (src) {
        portrait.src = src;
        portrait.alt = resolveSubLabel(classId);
        portrait.hidden = false;
      } else {
        portrait.removeAttribute("src");
        portrait.alt = "";
        portrait.hidden = true;
      }
    }
    if (name) name.textContent = resolveLabel(classId, side);
    if (sub) {
      const subText = resolveSubLabel(classId);
      sub.textContent = subText;
      sub.hidden = !subText || subText === name?.textContent;
    }
  }

  function hide() {
    const overlay = document.getElementById("bb-vs-overlay");
    if (!overlay) return;
    overlay.classList.remove("bb-vs-overlay--visible");
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.removeAttribute("data-bb-vs-active");
  }

  /** Останавливает таймер/колбэк, оверлей не трогает (чтобы не мелькал prep под VS). */
  function release() {
    active = false;
    onComplete = null;
    startedAt = 0;
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  /** Снять VS после того, как battle уже в DOM — без вспышки prep. */
  function dismiss() {
    release();
    hide();
  }

  function finish() {
    const cb = onComplete;
    // Не hide(): executeBattleStart держит VS до applyPhase("battle").
    release();
    if (cb) cb();
  }

  function cancel() {
    dismiss();
  }

  function show() {
    const overlay = document.getElementById("bb-vs-overlay");
    if (!overlay) {
      finish();
      return;
    }

    const playerId = typeof playerClass !== "undefined" ? playerClass : "warrior";
    const enemyId = typeof enemyClass !== "undefined" ? enemyClass : "mage";
    populateFighter("player", playerId);
    populateFighter("enemy", enemyId);

    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.setAttribute("data-bb-vs-active", "true");
    void overlay.offsetWidth;
    overlay.classList.add("bb-vs-overlay--visible");
    playSfx("prep_phase_start");
  }

  function start(cb) {
    cancel();
    if (!shouldUse()) {
      if (typeof cb === "function") cb();
      return;
    }
    active = true;
    onComplete = typeof cb === "function" ? cb : null;
    startedAt = Date.now();
    show();
    timerId = setTimeout(() => {
      playSfx("battle_countdown_go");
      finish();
    }, HOLD_MS);
  }

  function tickStaleGuard() {
    if (!active || !startedAt) return;
    if (Date.now() - startedAt > STALE_MS) {
      console.warn("BBVsOverlay stale — forcing battle start");
      finish();
    }
  }

  return { shouldUse, isActive, start, cancel, release, dismiss, tickStaleGuard, HOLD_MS };
})();

function syncBBVsOverlay() {
  if (typeof BBVsOverlay !== "undefined" && BBVsOverlay.isActive()) {
    BBVsOverlay.tickStaleGuard();
  }
}

if (typeof window !== "undefined") {
  window.BBVsOverlay = BBVsOverlay;
  window.syncBBVsOverlay = syncBBVsOverlay;
}
