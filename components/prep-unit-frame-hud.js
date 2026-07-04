/**
 * MMORPG unit-frame HUD на экране подготовки (игрок слева, противник справа).
 */

function isPrepUnitFrameHudActive() {
  if (typeof isPrepHudPresetUnitFrame !== "function" || !isPrepHudPresetUnitFrame()) return false;
  const root = document.documentElement;
  return root.dataset.prepLayout === "side"
    || root.dataset.uiSurface === "tablet-side"
    || root.dataset.uiSurface === "desktop";
}

function syncPrepUnitFrameHudChrome() {
  const heroCard = document.getElementById("prep-hero-card");
  const strip = document.getElementById("prep-unit-frame-hud");
  const active = isPrepUnitFrameHudActive()
    && phase === "prep"
    && !gameOver
    && !(typeof isLobby2pMode === "function" && isLobby2pMode() && lobbyState?.isSplitLobby);

  heroCard?.classList.toggle("hidden", active);
  heroCard?.toggleAttribute("hidden", active);
  heroCard?.toggleAttribute("aria-hidden", active);

  if (strip) {
    strip.classList.toggle("hidden", !active);
    strip.toggleAttribute("aria-hidden", !active);
  }

  if (!active && strip) {
    strip.innerHTML = "";
  }
}

function renderPrepUnitFramePortraitHtml(profile, side) {
  const src = typeof getPrepHudPortraitSrc === "function"
    ? getPrepHudPortraitSrc(profile, side)
    : profile?.classIconSrc || null;
  const name = profile?.className || profile?.name || "Герой";
  const classId = profile?.classId || "";
  if (src) {
    return `
      <div class="prep-unit-frame__portrait-ring" data-class="${classId}">
        <img class="prep-unit-frame__portrait-img" src="${src}" alt="${name}" draggable="false">
      </div>`;
  }
  return `
    <div class="prep-unit-frame__portrait-ring" data-class="${classId}" data-fallback="${profile?.classIcon || "🧙"}">
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
}) {
  const name = typeof getPrepHeroCardName === "function"
    ? getPrepHeroCardName(profile)
    : profile?.className || profile?.name || "Герой";
  const portrait = renderPrepUnitFramePortraitHtml(profile, team);
  const bars = renderPrepUnitFrameBarsHtml(profile, team, extras);
  const pet = team === "player" ? renderPrepUnitFrameCompanionHtml(companion) : "";
  const extrasHtml = renderPrepUnitFrameExtrasHtml(mutationHtml, enhancementHtml, modifierStripHtml);
  const badgeHtml = badge
    ? `<span class="prep-unit-frame__level-badge" aria-label="Раунд">${badge}</span>`
    : "";

  return `
    <div class="prep-unit-frame prep-unit-frame--${team}${isActive ? " is-active" : ""}" data-team="${team}">
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

function syncPrepUnitFrameHud(context = {}) {
  syncPrepUnitFrameHudChrome();
  if (!isPrepUnitFrameHudActive() || phase !== "prep") return;

  const strip = document.getElementById("prep-unit-frame-hud");
  if (!strip) return;

  const {
    playerProfile,
    enemyProfile,
    playerState = {},
    enemyState = {},
    playerMutRt = {},
    enemyMutRt = {},
    playerMutationHtml = "",
    enemyMutationHtml = "",
    playerEnhancementHtml = "",
    enemyEnhancementHtml = "",
    playerModifierHtml = "",
    enemyModifierHtml = "",
    playerCompanion = null,
    enemyCompanion = null,
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
      companion: enemyCompanion,
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
}
