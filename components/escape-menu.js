/**
 * Меню по Escape — в духе World of Warcraft.
 */

let escapeMenuHandlers = null;
let escapeMenuPausedBattle = false;
let escapeMenuPausedReplay = false;

function initEscapeMenu(handlers = {}) {
  escapeMenuHandlers = handlers;

  document.getElementById("btn-escape-resume")?.addEventListener("click", () => {
    hideEscapeMenu({ sfx: false });
  });

  document.getElementById("btn-escape-settings")?.addEventListener("click", () => {
    if (typeof showSettingsPopup === "function") showSettingsPopup();
  });

  document.getElementById("btn-escape-main-menu")?.addEventListener("click", () => {
    hideEscapeMenu({ sfx: false });
    escapeMenuHandlers?.returnToMainMenu?.();
  });

  document.getElementById("escape-menu-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "escape-menu-overlay") hideEscapeMenu();
  });
}

function isEscapeMenuOpen() {
  return isPopupOpen("escape-menu-overlay");
}

function canOpenEscapeMenu() {
  if (escapeMenuHandlers?.isPhaseTransitioning?.()) return false;
  if (escapeMenuHandlers?.isTypingBlocked?.()) return false;
  if (isPopupOpen("overlay") && escapeMenuHandlers?.getGameOver?.()) return false;
  if (isPopupOpen("bb-run-complete-overlay")) return false;
  return true;
}

function syncEscapeMenuActions() {
  const mainBtn = document.getElementById("btn-escape-main-menu");
  if (mainBtn) {
    const showMain = escapeMenuHandlers?.isActiveGameSession?.() === true;
    mainBtn.classList.toggle("hidden", !showMain);
  }
  const wikiBtn = document.getElementById("btn-escape-wiki");
  if (wikiBtn) {
    const showWiki = typeof shouldShowBBItemWiki === "function"
      && shouldShowBBItemWiki()
      && escapeMenuHandlers?.isActiveGameSession?.() === true;
    wikiBtn.classList.toggle("hidden", !showWiki);
    wikiBtn.toggleAttribute("hidden", !showWiki);
  }
}

function pauseForEscapeMenu() {
  escapeMenuPausedBattle = false;
  escapeMenuPausedReplay = false;

  const phase = escapeMenuHandlers?.getPhase?.();
  if (phase === "replay") {
    if (escapeMenuHandlers?.isReplayPlaying?.()) {
      escapeMenuHandlers?.togglePause?.();
      escapeMenuPausedReplay = true;
    }
    return;
  }

  if (
    phase === "battle"
    && escapeMenuHandlers?.isBattleActive?.()
    && !escapeMenuHandlers?.isBattlePaused?.()
  ) {
    escapeMenuHandlers?.togglePause?.();
    escapeMenuPausedBattle = true;
  }
}

function resumeFromEscapeMenuPause() {
  if (escapeMenuPausedReplay && escapeMenuHandlers?.isReplayPlaying?.() === false) {
    escapeMenuHandlers?.togglePause?.();
    escapeMenuPausedReplay = false;
  } else if (escapeMenuPausedBattle && escapeMenuHandlers?.isBattlePaused?.()) {
    escapeMenuHandlers?.togglePause?.();
    escapeMenuPausedBattle = false;
  }
}

function showEscapeMenu() {
  const overlay = document.getElementById("escape-menu-overlay");
  if (!overlay || isEscapeMenuOpen()) return;
  syncEscapeMenuActions();
  pauseForEscapeMenu();
  if (typeof playGameSfx === "function") playGameSfx("ui_open");
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("escape-menu-open");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  requestAnimationFrame(() => {
    document.getElementById("btn-escape-resume")?.focus({ preventScroll: true });
  });
}

function hideEscapeMenu(options = {}) {
  const overlay = document.getElementById("escape-menu-overlay");
  if (!overlay || !isEscapeMenuOpen()) return;
  if (options.sfx !== false && typeof playGameSfx === "function") playGameSfx("ui_close");
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("escape-menu-open");
  resumeFromEscapeMenuPause();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function handleEscapeKey() {
  if (escapeMenuHandlers?.closeNestedPopups?.()) return true;
  if (isEscapeMenuOpen()) {
    hideEscapeMenu();
    return true;
  }
  if (canOpenEscapeMenu()) {
    showEscapeMenu();
    return true;
  }
  return false;
}
