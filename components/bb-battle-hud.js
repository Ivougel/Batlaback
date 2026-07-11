/**
 * BB Fidelity battle: компактный центральный HUD (HP / stamina) между сетками.
 */
const BBBattleHud = (() => {
  function isActive() {
    return typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout();
  }

  function mount() {
    const hud = document.getElementById("bb-battle-hud");
    if (!hud) return;
    const active = isActive();
    hud.classList.toggle("hidden", !active);
    hud.toggleAttribute("hidden", !active);
    hud.setAttribute("aria-hidden", active ? "false" : "true");
    document.documentElement.toggleAttribute("data-bb-battle-hud", active);
    if (!active) {
      document.getElementById("bb-battle-hud-enemy")?.replaceChildren();
      document.getElementById("bb-battle-hud-player")?.replaceChildren();
    }
  }

  function getBarsRoot(team) {
    const slot = document.getElementById(`bb-battle-hud-${team}`);
    return slot?.querySelector(".battle-hud-vitals-column")
      || slot?.querySelector(".bb-battle-hud__vitals")
      || slot;
  }

  function syncVitals(state) {
    if (!state || !isActive()) return;
    ["player", "enemy"].forEach((team) => {
      const side = team === "player" ? state.player : state.enemy;
      const barsRoot = getBarsRoot(team);
      if (!barsRoot || !side) return;

      const hpCurrent = side.hp ?? 0;
      const hpMax = side.maxHp ?? 100;
      const staminaCurrent = side.stamina ?? 0;
      const staminaMax = side.maxStamina ?? 40;
      const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
      const staminaPct = Math.max(0, Math.min(100, (staminaCurrent / Math.max(1, staminaMax)) * 100));
      const sig = [
        Math.round(hpPct * 10),
        Math.round(staminaPct * 10),
        Math.round(hpCurrent),
        Math.round(staminaCurrent),
      ].join("|");
      if (!syncVitals._sig) syncVitals._sig = {};
      if (syncVitals._sig[team] === sig) return;
      syncVitals._sig[team] = sig;

      const hpFill = barsRoot.querySelector(".avatar-hero-hp-fill");
      const hpLabel = barsRoot.querySelector(".avatar-hero-hp-label");
      const staminaFill = barsRoot.querySelector(".avatar-hero-stamina-fill");
      const staminaLabel = barsRoot.querySelector(".avatar-hero-stamina-label");
      const staminaBar = barsRoot.querySelector(".avatar-hero-stamina-bar");

      if (hpFill) hpFill.style.width = `${hpPct}%`;
      if (hpLabel) {
        hpLabel.textContent = typeof formatHeroHpLabel === "function"
          ? formatHeroHpLabel(hpCurrent, hpMax)
          : `${Math.ceil(hpCurrent)}/${hpMax}`;
      }
      if (staminaFill) staminaFill.style.width = `${staminaPct}%`;
      if (staminaLabel) {
        staminaLabel.textContent = typeof formatHeroStaminaLabel === "function"
          ? formatHeroStaminaLabel(staminaCurrent, staminaMax)
          : `${Math.ceil(staminaCurrent)}/${staminaMax}`;
      }
      if (staminaBar) {
        staminaBar.classList.toggle("stat-stamina-spending", (side.staminaSpendFlash || 0) > 0);
      }
    });
  }

  function mergeLiveVitals(profile, side, battleState) {
    if (!side) return profile;
    const live = typeof computeCombatProfileFromBattleSide === "function"
      ? computeCombatProfileFromBattleSide(
        side,
        profile?.classId,
        profile?.name || profile?.heroLabel,
        battleState,
      )
      : null;
    if (!profile) return live;
    if (!live) {
      return {
        ...profile,
        hpCurrent: Math.ceil(side.hp ?? profile.hpCurrent ?? profile.hp ?? 0),
        hpMax: side.maxHp ?? profile.hpMax ?? profile.hp ?? 100,
        stamina: side.stamina ?? profile.stamina,
        staminaCurrent: side.stamina ?? profile.staminaCurrent ?? profile.stamina,
        staminaMax: side.maxStamina ?? profile.staminaMax ?? 40,
        staminaSpendFlash: side.staminaSpendFlash || 0,
      };
    }
    return { ...profile, ...live };
  }

  function renderSide(team, profile, battleState = null) {
    const slot = document.getElementById(`bb-battle-hud-${team}`);
    if (!slot || !profile) return;
    const side = battleState?.[team];
    const merged = mergeLiveVitals(profile, side, battleState);
    const barsHtml = typeof renderAvatarBarsHTML === "function"
      ? renderAvatarBarsHTML(merged, team)
      : "";
    const name = merged.heroLabel || merged.className || merged.name || (team === "player" ? "Игрок" : "Противник");
    const portraitSrc = typeof getClassHeroPortraitSrc === "function"
      ? getClassHeroPortraitSrc(merged.classId)
      : merged.classIconSrc;
    const portraitHtml = portraitSrc
      ? `<img class="bb-battle-hud__portrait" src="${portraitSrc}" alt="" draggable="false">`
      : `<span class="bb-battle-hud__portrait-fallback" aria-hidden="true">${merged.classIcon || "🧙"}</span>`;
    slot.innerHTML = `
      <div class="bb-battle-hud__side bb-battle-hud__side--${team}" data-team="${team}">
        ${portraitHtml}
        <div class="bb-battle-hud__vitals">
          <div class="bb-battle-hud__name">${name}</div>
          ${barsHtml}
        </div>
      </div>`;
    if (typeof syncBattleHudRuntimeChips === "function" && side) {
      syncBattleHudRuntimeChips(team, side, battleState);
    }
    if (!syncVitals._sig) syncVitals._sig = {};
    delete syncVitals._sig[team];
  }

  function sync(viewState, playerProfile, enemyProfile) {
    mount();
    if (!isActive()) return;
    const state = viewState || (typeof getDisplayBattleState === "function" ? getDisplayBattleState() : null);
    if (!state) return;

    const hasFreshProfiles = !!(playerProfile && enemyProfile);
    const needsBootstrap = !document.getElementById("bb-battle-hud-player")?.querySelector(".avatar-hero-bars");
    if (hasFreshProfiles || needsBootstrap) {
      const player = playerProfile || state._heroProfiles?.player;
      const enemy = enemyProfile || state._heroProfiles?.enemy;
      if (player) renderSide("player", player, state);
      if (enemy) renderSide("enemy", enemy, state);
    }

    syncVitals(state);

    const roundEl = document.getElementById("bb-battle-hud-round");
    if (roundEl) {
      const r = typeof round !== "undefined" ? round : 1;
      const max = typeof RUN_BATTLES !== "undefined" ? RUN_BATTLES : 10;
      roundEl.textContent = `Раунд ${r}/${max}`;
    }
  }

  return { isActive, mount, sync, syncVitals };
})();

function syncBBBattleHud(viewState, playerProfile, enemyProfile) {
  BBBattleHud.sync(viewState, playerProfile, enemyProfile);
}

function syncBBBattleHudVitals(viewState) {
  BBBattleHud.syncVitals(viewState);
}

if (typeof window !== "undefined") {
  window.BBBattleHud = BBBattleHud;
  window.syncBBBattleHud = syncBBBattleHud;
  window.syncBBBattleHudVitals = syncBBBattleHudVitals;
}
