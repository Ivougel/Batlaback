/**
 * BB Fidelity: intro classic/versus — портрет, пергамент, валюты, зелёный CTA.
 */
const BBIntroLayout = (() => {
  let playBtnBound = false;

  function isActive() {
    return typeof shouldUseBBIntroLayout === "function" && shouldUseBBIntroLayout();
  }

  function getHeroPickClassId() {
    const opponentStep = document.getElementById("class-step-opponent");
    const onOpponent = opponentStep && !opponentStep.classList.contains("hidden");
    if (onOpponent) {
      return typeof selectedEnemyClass !== "undefined" ? selectedEnemyClass : null;
    }
    return typeof pendingPlayerClass !== "undefined" ? pendingPlayerClass : null;
  }

  function isOnHeroPickStep() {
    const playerStep = document.getElementById("class-step-player");
    const opponentStep = document.getElementById("class-step-opponent");
    return (playerStep && !playerStep.classList.contains("hidden"))
      || (opponentStep && !opponentStep.classList.contains("hidden"));
  }

  function resolvePortraitSrc(classId) {
    if (typeof getClassHeroPortraitSrc === "function") {
      return getClassHeroPortraitSrc(classId);
    }
    const cls = typeof getClassById === "function" ? getClassById(classId) : null;
    return cls?.heroPortraitSrc || cls?.iconSrc || null;
  }

  function renderCurrencies() {
    const gemsEl = document.getElementById("bb-intro-gems");
    const goldEl = document.getElementById("bb-intro-gold");
    if (!gemsEl || !goldEl) return;

    let gems = 12;
    let gold = 490;
    if (typeof MetaProgress !== "undefined" && MetaProgress.isEnabled?.()) {
      const state = MetaProgress.load?.();
      if (state?.gems != null) gems = state.gems;
    }
    gemsEl.textContent = `💎 ${gems}`;
    goldEl.textContent = `🪙 ${gold}`;
  }

  function renderHeroStage(classId) {
    const stage = document.getElementById("bb-intro-hero-stage");
    const portrait = document.getElementById("bb-intro-hero-portrait");
    const nameEl = document.getElementById("bb-intro-hero-name");
    const levelEl = document.getElementById("bb-intro-hero-level");
    const bonusEl = document.getElementById("bb-intro-hero-bonus");
    const fillEl = document.getElementById("bb-intro-xp-fill");
    const barEl = stage?.querySelector(".bb-intro-xp-bar");
    if (!stage) return;

    const show = isOnHeroPickStep() && !!classId;
    stage.classList.toggle("hidden", !show);
    stage.toggleAttribute("hidden", !show);
    if (!show || !classId) return;

    const cls = typeof getClassById === "function" ? getClassById(classId) : null;
    const src = resolvePortraitSrc(classId);
    if (portrait) {
      if (src) {
        portrait.src = src;
        portrait.alt = cls?.heroLabel || cls?.name || "";
        portrait.hidden = false;
      } else {
        portrait.removeAttribute("src");
        portrait.alt = "";
        portrait.hidden = true;
      }
    }
    if (nameEl) nameEl.textContent = cls?.heroLabel || cls?.noviceLabel || cls?.name || "";
    if (bonusEl) bonusEl.textContent = cls?.bonus || cls?.desc || "";

    let level = 1;
    let xp = 0;
    let xpNeed = 100;
    let maxed = false;
    if (typeof MetaProgress !== "undefined" && MetaProgress.isActiveForPicker?.()) {
      const rec = MetaProgress.getHeroRecord(classId);
      level = rec?.level || 1;
      xp = rec?.xp || 0;
      xpNeed = MetaProgress.xpToNextLevel(classId) || 100;
      maxed = level >= (MetaProgress.getMaxHeroLevel?.() || 10);
    }
    if (levelEl) {
      levelEl.textContent = maxed ? `Ур. ${level} · макс.` : `Ур. ${level}`;
    }
    const pct = maxed ? 100 : Math.max(8, Math.min(100, Math.round((xp / Math.max(1, xpNeed)) * 100)));
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (barEl) {
      barEl.setAttribute("aria-valuenow", String(pct));
      barEl.setAttribute("aria-valuetext", maxed ? "Максимальный уровень" : `${xp} / ${xpNeed} XP`);
    }
    stage.dataset.class = classId;
  }

  function getPlayButtonState() {
    const playerStep = document.getElementById("class-step-player");
    const summaryStep = document.getElementById("class-step-summary");
    const opponentStep = document.getElementById("class-step-opponent");
    const onPlayer = playerStep && !playerStep.classList.contains("hidden");
    const onSummary = summaryStep && !summaryStep.classList.contains("hidden");
    const onOpponent = opponentStep && !opponentStep.classList.contains("hidden");
    const skipCompanion = typeof shouldSkipCompanionIntro === "function" && shouldSkipCompanionIntro();
    const mode = typeof selectedGameMode !== "undefined" ? selectedGameMode : "classic";

    if (onPlayer && pendingPlayerClass) {
      return { show: true, disabled: false, label: "Продолжить" };
    }
    if (onSummary) {
      const ready = !!(pendingPlayerClass && (skipCompanion || pendingPlayerCompanionId));
      return {
        show: true,
        disabled: !ready,
        label: mode === "versus" ? "Игрок 2 →" : "Играть",
      };
    }
    if (onOpponent && selectedEnemyClass) {
      return { show: true, disabled: false, label: "Начать игру" };
    }
    return { show: false, disabled: true, label: "Играть" };
  }

  function syncPlayButton() {
    const btn = document.getElementById("btn-bb-intro-play");
    if (!btn) return;
    if (!isActive()) {
      btn.classList.add("hidden");
      btn.toggleAttribute("hidden", true);
      return;
    }
    const state = getPlayButtonState();
    btn.classList.toggle("hidden", !state.show);
    btn.toggleAttribute("hidden", !state.show);
    btn.disabled = state.disabled;
    btn.textContent = state.label;
  }

  function onPlayClick() {
    const playerStep = document.getElementById("class-step-player");
    const summaryStep = document.getElementById("class-step-summary");
    const opponentStep = document.getElementById("class-step-opponent");
    const onPlayer = playerStep && !playerStep.classList.contains("hidden");
    const onSummary = summaryStep && !summaryStep.classList.contains("hidden");
    const onOpponent = opponentStep && !opponentStep.classList.contains("hidden");

    if (onPlayer && typeof pendingPlayerClass !== "undefined" && pendingPlayerClass) {
      if (typeof shouldSkipCompanionIntro === "function" && shouldSkipCompanionIntro()) {
        if (typeof showSummaryStep === "function") showSummaryStep();
      } else if (typeof showCompanionStep === "function") {
        showCompanionStep({ keepSelection: false });
      }
      return;
    }
    if (onSummary) {
      document.getElementById("btn-class-summary-start")?.click();
      return;
    }
    if (onOpponent) {
      document.getElementById("btn-start-run")?.click();
    }
  }

  function bindPlayButton() {
    if (playBtnBound) return;
    const btn = document.getElementById("btn-bb-intro-play");
    if (!btn) return;
    playBtnBound = true;
    btn.addEventListener("click", onPlayClick);
  }

  function sync() {
    bindPlayButton();
    if (typeof syncBBIntroContext === "function") syncBBIntroContext();

    const header = document.getElementById("bb-intro-header");
    const stage = document.getElementById("bb-intro-hero-stage");
    const active = isActive();
    if (header) {
      header.classList.toggle("hidden", !active);
      header.toggleAttribute("hidden", !active);
      header.setAttribute("aria-hidden", active ? "false" : "true");
    }
    if (stage) {
      stage.classList.toggle("hidden", !active);
      stage.toggleAttribute("hidden", !active);
    }

    if (!active) {
      syncPlayButton();
      return;
    }

    renderCurrencies();
    renderHeroStage(getHeroPickClassId());
    syncPlayButton();
    if (typeof syncIntroHeaderWikiButton === "function") syncIntroHeaderWikiButton();
    if (typeof syncClassicWikiEntry === "function") syncClassicWikiEntry();
  }

  return { sync, isActive, onPlayClick };
})();

function syncBBIntroLayout() {
  BBIntroLayout.sync();
}

if (typeof window !== "undefined") {
  window.BBIntroLayout = BBIntroLayout;
  window.syncBBIntroLayout = syncBBIntroLayout;
}
