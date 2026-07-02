/**
 * Анимированный схематичный портрет героя в prep HUD (вместо текста «Подготовка»).
 */

const PREP_HUD_MOODS = ["breathe", "sway", "alert", "calm"];
let prepHudMoodTimer = null;
let prepHudLastSide = null;

function pickPrepHudMood() {
  return PREP_HUD_MOODS[Math.floor(Math.random() * PREP_HUD_MOODS.length)];
}

function getPrepHudPortraitSrc(profile) {
  const classId = profile?.classId;
  if (classId && typeof getClassHeroPortraitSrc === "function") {
    return getClassHeroPortraitSrc(classId);
  }
  return profile?.classIconSrc || null;
}

function syncPrepHudHero(profile, options = {}) {
  const badge = document.getElementById("run-hud-phase");
  const portrait = document.getElementById("prep-hud-hero-portrait");
  const img = document.getElementById("prep-hud-hero-img");
  const roundEl = document.getElementById("prep-hud-hero-round");
  const portraitSlot = document.querySelector(".prep-hero-card__portrait");
  const root = document.documentElement;
  const heroCardHud = root.dataset.prepLayout === "side" || root.dataset.uiSurface === "tablet-side";
  if (!badge || !portrait || !img) return;

  const side = options.side || prepViewSide || "player";
  const phaseLabels = { prep: "Подготовка", battle: "Бой", replay: "Повтор" };
  const phaseLabel = phaseLabels[phase] || "Подготовка";
  const heroName = profile?.className || profile?.name || "Герой";

  if (phase !== "prep" || gameOver) {
    badge.classList.add("hidden");
    badge.setAttribute("aria-hidden", "true");
    return;
  }

  badge.classList.remove("hidden");
  badge.removeAttribute("aria-hidden");
  badge.setAttribute("aria-label", `${phaseLabel} · ${heroName}`);

  const src = getPrepHudPortraitSrc(profile);
  if (src) {
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.alt = heroName;
    img.hidden = false;
    portrait.removeAttribute("data-fallback");
    if (heroCardHud) {
      root.style.setProperty("--prep-hero-card-portrait-src", `url("${src.replace(/"/g, '\\"')}")`);
      portraitSlot?.classList.add("prep-hero-card__portrait--ready");
    } else {
      root.style.removeProperty("--prep-hero-card-portrait-src");
      portraitSlot?.classList.remove("prep-hero-card__portrait--ready");
    }
  } else {
    img.removeAttribute("src");
    img.alt = heroName;
    img.hidden = true;
    portrait.dataset.fallback = profile?.classIcon || "🧙";
    root.style.removeProperty("--prep-hero-card-portrait-src");
    portraitSlot?.classList.remove("prep-hero-card__portrait--ready");
  }

  if (profile?.classId) portrait.dataset.class = profile.classId;
  else portrait.removeAttribute("data-class");

  if (heroCardHud) {
    portrait.dataset.mood = "calm";
  } else if (side !== prepHudLastSide || options.forceMood) {
    portrait.dataset.mood = pickPrepHudMood();
    prepHudLastSide = side;
  }

  portrait.style.setProperty("--prep-hud-anim-delay", `${-(Math.random() * 3).toFixed(2)}s`);
  portrait.style.setProperty("--prep-hud-anim-rate", `${(0.9 + Math.random() * 0.22).toFixed(2)}`);

  if (roundEl) {
    const roundLabel = typeof RUN_BATTLES !== "undefined"
      ? `${Math.min(round, RUN_BATTLES)}`
      : `${round}`;
    roundEl.textContent = roundLabel;
  }
}

function rerollPrepHudMood() {
  const portrait = document.getElementById("prep-hud-hero-portrait");
  if (!portrait || phase !== "prep") return;
  portrait.dataset.mood = pickPrepHudMood();
}

function startPrepHudMoodCycle() {
  stopPrepHudMoodCycle();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  prepHudMoodTimer = window.setInterval(rerollPrepHudMood, 7200);
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
