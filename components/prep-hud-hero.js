/**
 * Портрет героя в prep HUD — универсальный слот .hero-portrait-media.
 */

const PREP_HUD_MOODS = ["breathe", "sway", "alert", "calm"];
let prepHudMoodTimer = null;
let prepHudLastSide = null;

function pickPrepHudMood() {
  return PREP_HUD_MOODS[Math.floor(Math.random() * PREP_HUD_MOODS.length)];
}

function getPrepHudPortraitSrc(profile, side) {
  const classId = profile?.classId
    || (typeof getSideMutationRuntime === "function" ? getSideMutationRuntime(side || prepViewSide)?.classId : null);
  if (classId && typeof getClassHudPortraitSrc === "function") {
    return getClassHudPortraitSrc(classId);
  }
  return profile?.classIconSrc || null;
}

function syncPrepHudHero(profile, options = {}) {
  const portraitFrame = document.getElementById("prep-hero-card-portrait-frame");
  const portraitSlot = document.getElementById("prep-hero-card-portrait");
  const img = document.getElementById("prep-hud-hero-img");
  const roundEl = document.getElementById("prep-hud-hero-round");
  const legacyBadge = document.getElementById("run-hud-phase");
  const root = document.documentElement;
  const heroCardHud = root.dataset.prepLayout === "side"
    || root.dataset.uiSurface === "tablet-side"
    || root.dataset.uiSurface === "desktop";
  if (!portraitFrame || !img) return;

  const side = options.side || prepViewSide || "player";
  const phaseLabels = { prep: "Подготовка", battle: "Бой", replay: "Повтор" };
  const phaseLabel = phaseLabels[phase] || "Подготовка";
  const heroName = profile?.className || profile?.name || "Герой";

  if (phase !== "prep" || gameOver) {
    portraitFrame.setAttribute("aria-hidden", "true");
    legacyBadge?.classList.add("hidden");
    legacyBadge?.setAttribute("aria-hidden", "true");
    return;
  }

  portraitFrame.removeAttribute("aria-hidden");
  portraitFrame.setAttribute("aria-label", `${phaseLabel} · ${heroName}`);
  legacyBadge?.classList.add("hidden");
  legacyBadge?.setAttribute("aria-hidden", "true");

  const src = getPrepHudPortraitSrc(profile, side);
  if (src) {
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.alt = heroName;
    img.hidden = false;
    portraitFrame.removeAttribute("data-fallback");
    portraitFrame.dataset.hudPortrait = heroCardHud ? "bust" : "sticker";
    portraitFrame.classList.add("hero-portrait-frame--ready");
    portraitSlot?.classList.add("prep-hero-card__portrait--ready");
    if (heroCardHud) portraitSlot?.setAttribute("data-hud-sticker", "");
    else portraitSlot?.removeAttribute("data-hud-sticker");
  } else {
    img.removeAttribute("src");
    img.alt = heroName;
    img.hidden = true;
    portraitFrame.dataset.fallback = profile?.classIcon || "🧙";
    portraitFrame.removeAttribute("data-hud-portrait");
    portraitFrame.classList.remove("hero-portrait-frame--ready");
    portraitSlot?.classList.remove("prep-hero-card__portrait--ready");
    portraitSlot?.removeAttribute("data-hud-sticker");
  }

  const classId = profile?.classId
    || (typeof getSideMutationRuntime === "function" ? getSideMutationRuntime(side)?.classId : null);
  if (classId) portraitFrame.dataset.class = classId;
  else portraitFrame.removeAttribute("data-class");

  const sideChanged = side !== prepHudLastSide;

  if (heroCardHud) {
    if (sideChanged || options.forceMood || !portraitFrame.dataset.mood) {
      portraitFrame.dataset.mood = pickPrepHudMood();
    }
    portraitSlot?.classList.add("prep-hero-card__portrait--live");
  } else {
    portraitSlot?.classList.remove("prep-hero-card__portrait--live");
    if (sideChanged || options.forceMood) {
      portraitFrame.dataset.mood = pickPrepHudMood();
    }
  }

  if (sideChanged || options.forceMood || !portraitFrame.style.getPropertyValue("--prep-hud-anim-delay")) {
    portraitFrame.style.setProperty("--prep-hud-anim-delay", `${-(Math.random() * 3).toFixed(2)}s`);
    portraitFrame.style.setProperty("--prep-hud-anim-rate", `${(0.9 + Math.random() * 0.22).toFixed(2)}`);
  }
  if (sideChanged) prepHudLastSide = side;

  if (roundEl) {
    const roundLabel = typeof RUN_BATTLES !== "undefined"
      ? `${Math.min(round, RUN_BATTLES)}`
      : `${round}`;
    roundEl.textContent = roundLabel;
  }
}

function rerollPrepHudMood() {
  const portraitFrame = document.getElementById("prep-hero-card-portrait-frame");
  if (!portraitFrame || phase !== "prep") return;
  portraitFrame.dataset.mood = pickPrepHudMood();
}

function startPrepHudMoodCycle() {
  stopPrepHudMoodCycle();
  const enabled = typeof BattleFxTier !== "undefined" && BattleFxTier.prepHudMoodCycleEnabled
    ? BattleFxTier.prepHudMoodCycleEnabled()
    : !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!enabled) return;
  const intervalMs = typeof BattleFxTier !== "undefined" && BattleFxTier.prepHudMoodIntervalMs
    ? BattleFxTier.prepHudMoodIntervalMs()
    : 7200;
  if (!intervalMs) return;
  prepHudMoodTimer = window.setInterval(rerollPrepHudMood, intervalMs);
}

function stopPrepHudMoodCycle() {
  if (prepHudMoodTimer) {
    clearInterval(prepHudMoodTimer);
    prepHudMoodTimer = null;
  }
}

function initPrepHudHero() {
  startPrepHudMoodCycle();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPrepHudHero);
} else {
  initPrepHudHero();
}
