/**
 * MMORPG unit-frame HUD — только фаза боя (prep всегда с карточкой героя).
 */

function isPrepUnitFrameHudActive() {
  return false;
}

function isBattleUnitFrameHudActive() {
  if (typeof isPrepHudPresetUnitFrame !== "function" || !isPrepHudPresetUnitFrame()) return false;
  if (phase !== "battle" && phase !== "replay") return false;
  return document.documentElement.dataset.battleHeroPlacement === "flank-arena";
}

function syncUnitFrameHudChrome() {
  const root = document.documentElement;
  const heroCard = document.getElementById("prep-hero-card");
  const strip = document.getElementById("prep-unit-frame-hud");
  const battleActive = isBattleUnitFrameHudActive() && !gameOver;
  const active = battleActive;

  root.toggleAttribute("data-battle-unit-frame-hud", battleActive);

  if (phase === "prep") {
    heroCard?.classList.remove("hidden");
    heroCard?.removeAttribute("hidden");
    heroCard?.removeAttribute("aria-hidden");
  } else {
    heroCard?.classList.add("hidden");
    heroCard?.setAttribute("hidden", "");
    heroCard?.setAttribute("aria-hidden", "true");
  }

  if (strip) {
    strip.classList.toggle("hidden", !active);
    strip.toggleAttribute("aria-hidden", !active);
    strip.classList.toggle("prep-unit-frame-hud--battle", battleActive);
  }

  if (!active && strip) {
    strip.innerHTML = "";
    strip.removeAttribute("data-battle-sig");
  }
}

/** @deprecated alias */
function syncPrepUnitFrameHudChrome() {
  syncUnitFrameHudChrome();
}

function renderPrepUnitFramePortraitHtml(profile, side) {
  const src = typeof getPrepHudPortraitSrc === "function"
    ? getPrepHudPortraitSrc(profile, side)
    : profile?.classIconSrc || null;
  const name = profile?.className || profile?.name || "Герой";
  const classId = profile?.classId || "";
  if (src) {
    return `
      <div class="prep-unit-frame__portrait-ring" data-class="${classId}" data-team="${side}" role="button" tabindex="0" aria-label="${name}">
        <img class="prep-unit-frame__portrait-img" src="${src}" alt="${name}" draggable="false">
      </div>`;
  }
  return `
    <div class="prep-unit-frame__portrait-ring" data-class="${classId}" data-team="${side}" data-fallback="${profile?.classIcon || "🧙"}" role="button" tabindex="0" aria-label="${name}">
      <span class="prep-unit-frame__portrait-fallback" aria-hidden="true">${profile?.classIcon || "🧙"}</span>
    </div>`;
}

function renderPrepUnitFrameBarsHtml(profile, team, extras = {}) {
  const hpCurrent = extras.hpCurrent ?? profile.hpCurrent ?? profile.hp ?? 0;
  const hpMax = extras.hpMax ?? profile.hpMax ?? profile.hp ?? 100;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const resourceLabel = extras.resourceLabel ?? "0";
  const resourcePct = Math.max(0, Math.min(100, extras.resourcePct ?? 100));
  const resourceKind = extras.resourceKind || "gold";

  return `
    <div class="prep-unit-frame__bars">
      <div class="avatar-hero-hp-bar prep-unit-frame__hp-bar">
        <div class="avatar-hero-hp-track">
          <div class="avatar-hero-hp-fill avatar-hero-hp-fill-${team}" style="width:${hpPct}%"></div>
        </div>
        <span class="avatar-hero-hp-label">${Math.ceil(hpCurrent)}/${hpMax}</span>
      </div>
      <div class="prep-unit-frame__resource-bar prep-unit-frame__resource-bar--${resourceKind}">
        <div class="prep-unit-frame__resource-track">
          <div class="prep-unit-frame__resource-fill" style="width:${resourcePct}%"></div>
        </div>
        <span class="prep-unit-frame__resource-label">${resourceLabel}</span>
      </div>
    </div>`;
}

function renderPrepUnitFrameCompanionHtml(companion) {
  if (!companion) return "";
  const label = typeof renderPrepCompanionLabelHtml === "function"
    ? renderPrepCompanionLabelHtml(companion)
    : companion.name || "Спутник";
  const icon = companion.icon || "🐾";
  return `
    <div class="prep-unit-frame__pet" aria-label="Спутник">
      <div class="prep-unit-frame__pet-portrait" aria-hidden="true">${icon}</div>
      <div class="prep-unit-frame__pet-vitals">
        <span class="prep-unit-frame__pet-name">${label}</span>
      </div>
    </div>`;
}

function renderPrepUnitFrameExtrasHtml(mutationHtml, enhancementHtml, modifierStripHtml) {
  const chunks = [mutationHtml, enhancementHtml, modifierStripHtml].filter(Boolean);
  if (!chunks.length) return "";
  return `<div class="prep-unit-frame__extras">${chunks.join("")}</div>`;
}

function renderPrepUnitFrameSideHtml({
  team,
  profile,
  extras,
  mutationHtml,
  enhancementHtml,
  modifierStripHtml,
  companion,
  badge,
  isActive,
  battle = false,
}) {
  const name = typeof getPrepHeroCardName === "function"
    ? getPrepHeroCardName(profile)
    : profile?.className || profile?.name || "Герой";
  const portrait = renderPrepUnitFramePortraitHtml(profile, team);
  const bars = battle && typeof renderAvatarBarsHTML === "function"
    ? `<div class="unit-frame-battle-hud-mount">${renderAvatarBarsHTML(profile, team)}</div>`
    : renderPrepUnitFrameBarsHtml(profile, team, extras);
  const pet = !battle && team === "player" ? renderPrepUnitFrameCompanionHtml(companion) : "";
  const extrasHtml = battle ? "" : renderPrepUnitFrameExtrasHtml(mutationHtml, enhancementHtml, modifierStripHtml);
  const badgeHtml = badge
    ? `<span class="prep-unit-frame__level-badge" aria-label="Раунд">${badge}</span>`
    : "";
  const battleClass = battle ? " prep-unit-frame--battle" : "";

  return `
    <div class="prep-unit-frame prep-unit-frame--${team}${battleClass}${isActive ? " is-active" : ""}" data-team="${team}">
      <div class="prep-unit-frame__shell">
        <div class="prep-unit-frame__main">
          ${team === "player" ? portrait : ""}
          <div class="prep-unit-frame__vitals">
            <div class="prep-unit-frame__name">${name}</div>
            ${bars}
          </div>
          ${team === "enemy" ? `${portrait}${badgeHtml}` : ""}
        </div>
        ${pet}
        ${extrasHtml}
      </div>
    </div>`;
}

function parseHpLabel(hpLabel, profile) {
  const match = String(hpLabel || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return {
      hpCurrent: Number(match[1]),
      hpMax: Number(match[2]),
    };
  }
  const max = profile?.hpMax ?? profile?.hp ?? 100;
  return { hpCurrent: max, hpMax: max };
}

function bindUnitFramePortraitClicks(root) {
  if (!root || root.dataset.portraitClicksBound === "1") return;
  root.dataset.portraitClicksBound = "1";
  root.addEventListener("click", (e) => {
    const ring = e.target.closest(".prep-unit-frame__portrait-ring");
    if (!ring) return;
    const team = ring.dataset.team || ring.closest(".prep-unit-frame")?.dataset.team;
    if (!team) return;
    if (phase === "battle" || phase === "replay") {
      if (typeof toggleBattleInventoryPopover === "function") toggleBattleInventoryPopover(team);
      return;
    }
    if (team === "player" && typeof setPrepViewSide === "function") setPrepViewSide("player");
    else if (team === "enemy" && typeof setPrepViewSide === "function") setPrepViewSide("enemy");
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const ring = e.target.closest(".prep-unit-frame__portrait-ring");
    if (!ring) return;
    e.preventDefault();
    ring.click();
  });
}

function getUnitFrameBattleHudMount(team) {
  return document.querySelector(`.prep-unit-frame--${team} .unit-frame-battle-hud-mount`);
}

function syncPrepUnitFrameHud(context = {}) {
  syncUnitFrameHudChrome();
  if (!isPrepUnitFrameHudActive()) return;

  const strip = document.getElementById("prep-unit-frame-hud");
  if (!strip) return;

  strip.removeAttribute("data-portrait-clicks-bound");

  const {
    playerProfile,
    enemyProfile,
    playerState = {},
    enemyState = {},
    playerMutationHtml = "",
    enemyMutationHtml = "",
    playerEnhancementHtml = "",
    enemyEnhancementHtml = "",
    playerModifierHtml = "",
    enemyModifierHtml = "",
    playerCompanion = null,
    playerHpLabel,
    enemyHpLabel,
    roundLabel = "",
    activeSide = prepViewSide || "player",
  } = context;

  const playerHp = parseHpLabel(playerHpLabel, playerProfile);
  const enemyHp = parseHpLabel(enemyHpLabel, enemyProfile);
  const runBattles = typeof RUN_BATTLES !== "undefined" ? RUN_BATTLES : 10;
  const roundPct = Math.max(0, Math.min(100, (Number(roundLabel) || round || 1) / runBattles * 100));

  const playerGoldMax = Math.max(playerState.gold || 0, 30);
  const enemyGoldMax = Math.max(enemyState.gold || 0, 30);

  strip.innerHTML = `
    ${renderPrepUnitFrameSideHtml({
      team: "player",
      profile: playerProfile,
      extras: {
        ...playerHp,
        resourceLabel: `💰 ${playerState.gold ?? 0}`,
        resourcePct: ((playerState.gold ?? 0) / playerGoldMax) * 100,
        resourceKind: "gold",
      },
      mutationHtml: playerMutationHtml,
      enhancementHtml: playerEnhancementHtml,
      modifierStripHtml: playerModifierHtml,
      companion: playerCompanion,
      isActive: activeSide === "player",
    })}
    ${renderPrepUnitFrameSideHtml({
      team: "enemy",
      profile: enemyProfile,
      extras: {
        ...enemyHp,
        resourceLabel: `Раунд ${roundLabel || round || 1}`,
        resourcePct: roundPct,
        resourceKind: "round",
      },
      mutationHtml: enemyMutationHtml,
      enhancementHtml: enemyEnhancementHtml,
      modifierStripHtml: enemyModifierHtml,
      badge: roundLabel || String(round || 1),
      isActive: activeSide === "enemy",
    })}
  `;

  const playerFrame = strip.querySelector(".prep-unit-frame--player");
  const enemyFrame = strip.querySelector(".prep-unit-frame--enemy");
  if (playerFrame && typeof bindPrepEnhancementStrip === "function") {
    bindPrepEnhancementStrip("player", playerFrame);
  }
  if (enemyFrame && typeof bindPrepEnhancementStrip === "function") {
    bindPrepEnhancementStrip("enemy", enemyFrame);
  }
  if (typeof bindPrepCompanionTooltip === "function") {
    bindPrepCompanionTooltip(strip);
  }
  bindUnitFramePortraitClicks(strip);
}

function syncBattleUnitFrameHud(state, playerProfile, enemyProfile) {
  syncUnitFrameHudChrome();
  if (!isBattleUnitFrameHudActive()) return;

  const strip = document.getElementById("prep-unit-frame-hud");
  if (!strip || !playerProfile || !enemyProfile) return;

  const sig = [
    typeof profileHeroShellSignature === "function" ? profileHeroShellSignature(playerProfile) : "",
    typeof profileHeroShellSignature === "function" ? profileHeroShellSignature(enemyProfile) : "",
    typeof profileBarsSignature === "function" ? profileBarsSignature(playerProfile) : "",
    typeof profileBarsSignature === "function" ? profileBarsSignature(enemyProfile) : "",
  ].join("|");

  if (strip.dataset.battleSig !== sig) {
    strip.dataset.battleSig = sig;
    strip.removeAttribute("data-portrait-clicks-bound");
    strip.innerHTML = `
      ${renderPrepUnitFrameSideHtml({ team: "player", profile: playerProfile, battle: true })}
      ${renderPrepUnitFrameSideHtml({ team: "enemy", profile: enemyProfile, battle: true })}
    `;
    bindUnitFramePortraitClicks(strip);
  }

  if (state) {
    if (typeof syncAvatarHeroResourceBars === "function") {
      syncAvatarHeroResourceBars("player", state);
      syncAvatarHeroResourceBars("enemy", state);
    }
    if (typeof syncAllDamageSummaryDisplays === "function") {
      syncAllDamageSummaryDisplays(state);
    }
  }
}
