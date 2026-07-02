/**
 * Область героя: HP/stamina, дебаффы, benefit/dot stacks.
 */

function getAvatarSlotEl(team) {
  return document.getElementById(team === "player" ? "player-avatar-slot" : "enemy-avatar-slot");
}

const lastSyncedHeroHp = { player: null, enemy: null };
const heroHitAnimTimers = { player: null, enemy: null };

function resetHeroHpTracking(team) {
  lastSyncedHeroHp[team] = null;
  if (heroHitAnimTimers[team]) {
    clearTimeout(heroHitAnimTimers[team]);
    heroHitAnimTimers[team] = null;
  }
}

function maybeTriggerHeroTakingHit(team, shell, hpCurrent) {
  if (!shell) return;
  const prev = lastSyncedHeroHp[team];
  if (prev != null && hpCurrent < prev - 0.01) {
    shell.classList.remove("hero-taking-hit");
    void shell.offsetWidth;
    shell.classList.add("hero-taking-hit");
    if (heroHitAnimTimers[team]) clearTimeout(heroHitAnimTimers[team]);
    heroHitAnimTimers[team] = window.setTimeout(() => {
      shell.classList.remove("hero-taking-hit");
      heroHitAnimTimers[team] = null;
    }, 300);
  }
  lastSyncedHeroHp[team] = hpCurrent;
}

function getBattleHudBarsEl(team) {
  return document.getElementById(team === "player" ? "battle-hud-player" : "battle-hud-enemy");
}

function renderAvatarBarsHTML(profile, team) {
  const hpCurrent = profile.hpCurrent ?? profile.hp ?? 0;
  const hpMax = profile.hpMax ?? profile.hp ?? 100;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const staminaCurrent = profile.staminaCurrent ?? profile.stamina ?? 0;
  const staminaMax = profile.staminaMax ?? 40;
  const staminaPct = Math.max(0, Math.min(100, (staminaCurrent / Math.max(1, staminaMax)) * 100));

  return `
    <div class="avatar-hero-bars">
      <div class="avatar-hero-bars-col">
        <div class="avatar-hero-hp-bar">
          <div class="avatar-hero-hp-track">
            <div class="avatar-hero-hp-fill avatar-hero-hp-fill-${team}" style="width:${hpPct}%"></div>
            <div class="avatar-hero-hp-heal-preview" hidden style="left:${hpPct}%;width:0%"></div>
          </div>
          <span class="avatar-hero-hp-label">${Math.ceil(hpCurrent)}/${hpMax}</span>
        </div>
        <div class="avatar-hero-stamina-bar">
          <div class="avatar-hero-stamina-track">
            <div class="avatar-hero-stamina-fill avatar-hero-stamina-fill-${team}" style="width:${staminaPct}%"></div>
          </div>
          <span class="avatar-hero-stamina-label">${Math.ceil(staminaCurrent)}/${staminaMax}</span>
        </div>
      </div>
    </div>
    <div class="battle-hud-status-stack">
      <div class="battle-hud-runtime-chips" aria-hidden="true" hidden></div>
      <div class="battle-hud-effects-grid">
        <div class="avatar-benefit-stacks battle-hud-benefit-stacks" aria-hidden="true" hidden></div>
        <div class="avatar-hero-debuff-row battle-hud-debuff-row" hidden></div>
        <div class="avatar-dot-stacks battle-hud-dot-stacks" aria-hidden="true" hidden></div>
      </div>
    </div>
  `;
}

function renderAvatarArchetypeBannerHTML(profile) {
  if (!profile?.archetypeEmoji) return "";
  const label = escapeProfileHtml(profile.archetypeLabel || "Архетип");
  const sub = profile.archetypeSub ? escapeProfileHtml(profile.archetypeSub) : "";
  const title = sub ? `${label} · ${sub}` : label;
  const kind = escapeProfileHtml(profile.archetypeKind || "form");
  const pathId = escapeProfileHtml(profile.archetypePathId || "");
  return `
    <div class="avatar-hero-archetype-banner avatar-hero-archetype-banner--${kind}"
         data-archetype-path="${pathId}"
         title="${title}"
         aria-label="${title}"
         tabindex="0">
      <span class="avatar-hero-archetype-banner-pole" aria-hidden="true"></span>
      <span class="avatar-hero-archetype-banner-cloth" aria-hidden="true">
        <span class="avatar-hero-archetype-banner-emoji">${profile.archetypeEmoji}</span>
      </span>
    </div>`;
}

function syncAvatarArchetypeBanner(shell, profile) {
  if (!shell) return;
  const stage = shell.querySelector(".avatar-hero-stage");
  if (!stage) return;
  const sig = profile?.archetypePathId
    ? `${profile.archetypePathId}:${profile.archetypeEmoji}:${profile.archetypeKind}`
    : "";
  let banner = stage.querySelector(".avatar-hero-archetype-banner");
  if (!sig) {
    banner?.remove();
    shell.classList.remove("avatar-hero-has-archetype");
    return;
  }
  if (!banner) {
    stage.insertAdjacentHTML("afterbegin", renderAvatarArchetypeBannerHTML(profile));
    banner = stage.querySelector(".avatar-hero-archetype-banner");
    if (typeof bindAvatarArchetypeBannerInteractions === "function") {
      bindAvatarArchetypeBannerInteractions(banner);
    }
  } else if (banner.dataset.archetypeSig !== sig) {
    banner.outerHTML = renderAvatarArchetypeBannerHTML(profile);
    banner = stage.querySelector(".avatar-hero-archetype-banner");
    if (typeof bindAvatarArchetypeBannerInteractions === "function") {
      bindAvatarArchetypeBannerInteractions(banner);
    }
  }
  if (banner) {
    banner.dataset.archetypeSig = sig;
    if (typeof bindAvatarArchetypeBannerInteractions === "function") {
      bindAvatarArchetypeBannerInteractions(banner);
    }
  }
  shell.classList.toggle("avatar-hero-has-archetype", !!sig);
}

function renderAvatarWeaponBadgeHTML(profile) {
  const icon = profile.weaponIcon || "⚔️";
  const kind = profile.weaponKind || "melee";
  const label = escapeProfileHtml(profile.weaponLabel || "Оружие");
  return `<div class="avatar-hero-weapon-badge avatar-hero-weapon-badge--${escapeProfileHtml(kind)}" title="${label}" aria-label="${label}">${icon}</div>`;
}

function syncAvatarWeaponBadge(shell, profile) {
  if (!shell || !profile) return;
  const badge = shell.querySelector(".avatar-hero-weapon-badge");
  if (!badge) return;
  const icon = profile.weaponIcon || "⚔️";
  const kind = profile.weaponKind || "melee";
  const label = profile.weaponLabel || "Оружие";
  badge.textContent = icon;
  badge.title = label;
  badge.setAttribute("aria-label", label);
  badge.className = `avatar-hero-weapon-badge avatar-hero-weapon-badge--${kind}`;
}

function renderAvatarHeroHTML(profile, team) {
  const className = escapeProfileHtml(profile.className || "—");
  const icon = profile.classIconSrc
    ? `<div class="portrait-zoom-clip"><img class="profile-avatar-img" src="${escapeProfileHtml(profile.classIconSrc)}" alt="${className}" draggable="false"></div>`
    : escapeProfileHtml(profile.classIcon || "❓");
  const gold = profile.gold ?? 0;
  const tooltipDesc = escapeProfileHtml(`💰 ${gold} золота`);
  const displayName = escapeProfileHtml(profile.name || (team === "player" ? "Игрок" : "ИИ"));

  return `
    <div class="avatar-hero-shell avatar-hero-shell-${team}" data-team="${team}">
      <div class="avatar-hero-upper">
        <div class="avatar-hero-name">${displayName}</div>
        <div class="avatar-hero-stage">
          ${renderAvatarArchetypeBannerHTML(profile)}
          <div class="profile-avatar profile-avatar-${team}"
               data-status-title="${className}"
               data-status-desc="${tooltipDesc}"
               tabindex="0"
               aria-label="${className}">${icon}</div>
        </div>
        ${renderAvatarWeaponBadgeHTML(profile)}
      </div>
      <div class="avatar-hero-effects-panel avatar-effects-float" aria-hidden="true">
        <div class="avatar-hero-status-zones" aria-hidden="true">
          <div class="avatar-status-zone avatar-status-zone-buffs">
            <div class="avatar-damage-stacks" aria-hidden="true" hidden></div>
            <div class="avatar-benefit-stacks" aria-hidden="true" hidden></div>
          </div>
          <div class="avatar-status-zone avatar-status-zone-debuffs">
            <div class="avatar-hero-debuff-row" hidden></div>
            <div class="avatar-dot-stacks" aria-hidden="true" hidden></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDebuffChipHTML(chip) {
  const title = escapeProfileHtml((chip.lines || []).join("\n") || chip.title || "");
  const value = Math.ceil(Number(chip.value) || 0);
  const valueHtml = value > 0
    ? `<span class="battle-status-tile-badge avatar-bead-debuff-value">${value > 1 ? value : ""}</span>`
    : "";
  return `<span class="battle-status-tile avatar-bead avatar-bead-debuff avatar-bead-debuff-${escapeProfileHtml(chip.id)}"
    data-status-id="${escapeProfileHtml(chip.id)}"
    data-status-title="${escapeProfileHtml(chip.title || "")}"
    data-status-desc="${title}"
    tabindex="0"
    title="${title}"><span class="battle-status-tile-surface" aria-hidden="true"></span><span class="avatar-bead-debuff-icon battle-status-tile-icon">${chip.icon}</span>${valueHtml}</span>`;
}

function collectPositiveBeads(profile) {
  const seen = new Set();
  return (profile.buffs || []).filter((chip) => {
    if (seen.has(chip.id)) return false;
    seen.add(chip.id);
    return true;
  }).slice(0, 8);
}

function formatHeroHpLabel(hpCurrent, hpMax) {
  return `${Math.ceil(hpCurrent)}/${hpMax}`;
}

function formatHeroStaminaLabel(staminaCurrent, staminaMax) {
  return `${Math.ceil(staminaCurrent)}/${staminaMax}`;
}

function getSideBattleMetrics(state, team) {
  const sideState = team === "player"
    ? state?.commentary?.playerState
    : state?.commentary?.enemyState;
  return sideState?.metrics || null;
}

function syncAvatarHeroHealPreview(barsRoot, hpCurrent, hpMax, projectedHeal2s) {
  if (!barsRoot) return;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const healPreview = barsRoot.querySelector(".avatar-hero-hp-heal-preview");
  if (!healPreview) return;

  const healAmount = Math.max(0, Number(projectedHeal2s) || 0);
  const healPct = Math.min(Math.max(0, 100 - hpPct), (healAmount / Math.max(1, hpMax)) * 100);
  if (healPct < 0.35) {
    healPreview.hidden = true;
    healPreview.style.left = `${hpPct}%`;
    healPreview.style.width = "0%";
    return;
  }

  healPreview.hidden = false;
  healPreview.style.left = `${hpPct}%`;
  healPreview.style.width = `${healPct}%`;
}

function syncAvatarHeroResourceBars(team, state) {
  const slot = getAvatarSlotEl(team);
  const shell = slot?.querySelector(".avatar-hero-shell");
  const barsRoot = getBattleHudBarsEl(team);
  if (!shell || !barsRoot || !state) return;

  const side = team === "player" ? state.player : state.enemy;
  const hpCurrent = side?.hp ?? 0;
  const hpMax = side?.maxHp ?? 100;
  const staminaCurrent = side?.stamina ?? 0;
  const staminaMax = side?.maxStamina ?? 40;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const staminaPct = Math.max(0, Math.min(100, (staminaCurrent / Math.max(1, staminaMax)) * 100));
  const metrics = getSideBattleMetrics(state, team);

  maybeTriggerHeroTakingHit(team, shell, hpCurrent);

  const hpFill = barsRoot.querySelector(".avatar-hero-hp-fill");
  const hpLabel = barsRoot.querySelector(".avatar-hero-hp-label");
  const staminaFill = barsRoot.querySelector(".avatar-hero-stamina-fill");
  const staminaLabel = barsRoot.querySelector(".avatar-hero-stamina-label");

  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (hpLabel) hpLabel.textContent = formatHeroHpLabel(hpCurrent, hpMax);
  if (staminaFill) staminaFill.style.width = `${staminaPct}%`;
  if (staminaLabel) staminaLabel.textContent = formatHeroStaminaLabel(staminaCurrent, staminaMax);
  syncAvatarHeroHealPreview(barsRoot, hpCurrent, hpMax, metrics?.projectedHeal2s ?? 0);
}

function syncAvatarHeroHpOnly(team, hpCurrent, hpMax, state = null) {
  const slot = getAvatarSlotEl(team);
  const shell = slot?.querySelector(".avatar-hero-shell");
  const barsRoot = getBattleHudBarsEl(team);
  if (!shell || !barsRoot) return;
  maybeTriggerHeroTakingHit(team, shell, hpCurrent);
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const hpFill = barsRoot.querySelector(".avatar-hero-hp-fill");
  const hpLabel = barsRoot.querySelector(".avatar-hero-hp-label");
  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (hpLabel) hpLabel.textContent = formatHeroHpLabel(hpCurrent, hpMax);
  const metrics = state ? getSideBattleMetrics(state, team) : null;
  syncAvatarHeroHealPreview(barsRoot, hpCurrent, hpMax, metrics?.projectedHeal2s ?? 0);
}

function isFlankArenaBattleHud() {
  return document.documentElement.dataset.battleHeroPlacement === "flank-arena";
}

function syncAvatarHeroEffects(team, profile, state) {
  const slot = getAvatarSlotEl(team);
  if (!slot) return;
  const shell = slot.querySelector(".avatar-hero-shell");
  const barsRoot = getBattleHudBarsEl(team);
  if (!shell || !barsRoot) return;

  const hpCurrent = profile.hpCurrent ?? profile.hp ?? 0;
  const hpMax = profile.hpMax ?? profile.hp ?? 100;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));

  const staminaCurrent = profile.staminaCurrent ?? profile.stamina ?? 0;
  const staminaMax = profile.staminaMax ?? 40;
  const staminaPct = Math.max(0, Math.min(100, (staminaCurrent / Math.max(1, staminaMax)) * 100));
  const metrics = getSideBattleMetrics(state, team);

  maybeTriggerHeroTakingHit(team, shell, hpCurrent);

  const hpFill = barsRoot.querySelector(".avatar-hero-hp-fill");
  const hpLabel = barsRoot.querySelector(".avatar-hero-hp-label");
  const staminaFill = barsRoot.querySelector(".avatar-hero-stamina-fill");
  const staminaLabel = barsRoot.querySelector(".avatar-hero-stamina-label");
  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (hpLabel) hpLabel.textContent = formatHeroHpLabel(hpCurrent, hpMax);
  if (staminaFill) staminaFill.style.width = `${staminaPct}%`;
  if (staminaLabel) staminaLabel.textContent = formatHeroStaminaLabel(staminaCurrent, staminaMax);
  syncAvatarHeroHealPreview(barsRoot, hpCurrent, hpMax, metrics?.projectedHeal2s ?? 0);

  const debuffRow = (isFlankArenaBattleHud()
    ? barsRoot.querySelector(".avatar-hero-debuff-row")
    : null)
    || shell.querySelector(".avatar-status-zone-debuffs .avatar-hero-debuff-row")
    || shell.querySelector(".avatar-hero-debuff-row");
  const shellDebuffRow = shell.querySelector(".avatar-status-zone-debuffs .avatar-hero-debuff-row")
    || shell.querySelector(".avatar-hero-debuff-row");

  const activeBuffs = collectPositiveBeads(profile);
  const debuffs = profile.debuffs || [];
  if (debuffRow) {
    debuffRow.hidden = debuffs.length === 0;
    debuffRow.innerHTML = debuffs.map(renderDebuffChipHTML).join("");
  }
  if (isFlankArenaBattleHud() && shellDebuffRow && shellDebuffRow !== debuffRow) {
    shellDebuffRow.hidden = true;
    shellDebuffRow.innerHTML = "";
  }
  if (isFlankArenaBattleHud() && typeof clearShellStatusDisplays === "function") {
    clearShellStatusDisplays(team);
  }

  shell.classList.toggle("avatar-hero-has-buffs", activeBuffs.length > 0);
  syncAvatarWeaponBadge(shell, profile);
  shell.classList.toggle("avatar-hero-has-debuffs", debuffs.length > 0);
  syncAvatarArchetypeBanner(shell, profile);
  barsRoot.classList.toggle("avatar-hero-has-buffs", activeBuffs.length > 0);
  barsRoot.classList.toggle("avatar-hero-has-debuffs", debuffs.length > 0);
  if (isFlankArenaBattleHud() && state) {
    const sideState = team === "player" ? state.player : state.enemy;
    if (typeof syncBattleHudRuntimeChips === "function") {
      syncBattleHudRuntimeChips(team, sideState, state);
    }
  }
}

function syncAllAvatarHeroEffects(playerProfile, enemyProfile, state) {
  syncAvatarHeroEffects("player", playerProfile, state);
  syncAvatarHeroEffects("enemy", enemyProfile, state);
  if (isFlankArenaBattleHud() && typeof syncBattleHudAnchors === "function") {
    syncBattleHudAnchors();
  }
}

function profileHeroShellSignature(profile) {
  if (!profile) return "";
  return [
    profile.name,
    profile.classId,
    profile.className,
    profile.classIconSrc || profile.classIcon,
    profile.archetypePathId || "",
    profile.archetypeEmoji || "",
  ].join("|");
}

function profileBarsSignature(profile) {
  if (!profile) return "";
  return `${profile.name}|${profile.classId}|${profile.hpMax}|${profile.staminaMax}`;
}

function syncAvatarHeroPortraitContent(team, profile, opts = {}) {
  const slot = getAvatarSlotEl(team);
  if (!slot || !profile) return false;

  if (opts.forceRebuild) {
    slot.innerHTML = renderAvatarHeroHTML(profile, team);
    slot.dataset.heroShellSig = profileHeroShellSignature(profile);
    resetHeroHpTracking(team);
    return true;
  }

  const displayName = profile.name || (team === "player" ? "Игрок" : "ИИ");
  const className = profile.className || "—";
  let shell = slot.querySelector(".avatar-hero-shell");
  if (!shell) {
    slot.innerHTML = renderAvatarHeroHTML(profile, team);
    slot.dataset.heroShellSig = profileHeroShellSignature(profile);
    resetHeroHpTracking(team);
    return true;
  }

  const nameEl = shell.querySelector(".avatar-hero-name");
  if (nameEl) nameEl.textContent = displayName;

  const avatar = shell.querySelector(".profile-avatar");
  if (!avatar) {
    slot.innerHTML = renderAvatarHeroHTML(profile, team);
    slot.dataset.heroShellSig = profileHeroShellSignature(profile);
    resetHeroHpTracking(team);
    return true;
  }

  const gold = profile.gold ?? 0;
  avatar.dataset.statusTitle = className;
  avatar.dataset.statusDesc = `💰 ${gold} золота`;
  avatar.setAttribute("aria-label", className);

  if (profile.classIconSrc) {
    let img = avatar.querySelector(".profile-avatar-img");
    if (!img) {
      avatar.innerHTML = `<div class="portrait-zoom-clip"><img class="profile-avatar-img" src="${escapeProfileHtml(profile.classIconSrc)}" alt="${escapeProfileHtml(className)}" draggable="false"></div>`;
    } else if (img.getAttribute("src") !== profile.classIconSrc) {
      img.src = profile.classIconSrc;
      img.alt = className;
    }
  } else {
    avatar.innerHTML = escapeProfileHtml(profile.classIcon || "❓");
  }

  syncAvatarWeaponBadge(shell, profile);
  syncAvatarArchetypeBanner(shell, profile);
  slot.dataset.heroShellSig = profileHeroShellSignature(profile);
  return false;
}

function scheduleHeroPortraitLayoutSync() {
  const run = () => {
    if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.invalidateMeasureCache) {
      BattleHeroAnchor.invalidateMeasureCache();
    }
    if (typeof window.syncHeroEmotionSlotAnchors === "function") {
      if (window.syncHeroEmotionSlotAnchors._layout) {
        window.syncHeroEmotionSlotAnchors._layout.player = "";
        window.syncHeroEmotionSlotAnchors._layout.enemy = "";
      }
      window.syncHeroEmotionSlotAnchors._rootEmoji = null;
      window.syncHeroEmotionSlotAnchors();
    }
    if (typeof window.syncBattleSceneGridMetrics === "function") {
      window.syncBattleSceneGridMetrics();
    }
    if (typeof window.scheduleBattleHeroRowSync === "function") {
      window.scheduleBattleHeroRowSync(2);
    }
    if (typeof syncBattleHudAnchors === "function") syncBattleHudAnchors();
  };
  const imgs = ["player-avatar-slot", "enemy-avatar-slot"]
    .map((id) => document.getElementById(id)?.querySelector(".profile-avatar-img"))
    .filter(Boolean);
  if (!imgs.length || imgs.every((img) => img.complete)) {
    requestAnimationFrame(() => requestAnimationFrame(run));
    return;
  }
  let pending = imgs.filter((img) => !img.complete).length;
  const done = () => {
    pending -= 1;
    if (pending <= 0) requestAnimationFrame(run);
  };
  imgs.forEach((img) => {
    if (img.complete) return;
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

function ensureBattleHeroShells(state, playerProfile, enemyProfile, opts = {}) {
  const battleHud = document.getElementById("battle-run-hud");
  if (battleHud) {
    battleHud.hidden = false;
    battleHud.removeAttribute("aria-hidden");
  }
  let shellChanged = false;
  ["player", "enemy"].forEach((team) => {
    const profile = team === "player" ? playerProfile : enemyProfile;
    if (!profile) return;
    const slot = getAvatarSlotEl(team);
    const sig = profileHeroShellSignature(profile);
    const forceRebuild = !!opts.forceRebuild && slot?.dataset.heroShellSig !== sig;
    const rebuilt = syncAvatarHeroPortraitContent(team, profile, { forceRebuild });
    if (rebuilt) shellChanged = true;
    const barsEl = getBattleHudBarsEl(team);
    const barsSig = profileBarsSignature(profile);
    if (barsEl && (
      !barsEl.querySelector(".battle-hud-status-stack")
      || !barsEl.querySelector(".battle-hud-effects-grid")
      || barsEl.dataset.barsSig !== barsSig
    )) {
      barsEl.innerHTML = renderAvatarBarsHTML(profile, team);
      barsEl.dataset.barsSig = barsSig;
    }
  });
  if (shellChanged || opts.forceRebuild) {
    scheduleHeroPortraitLayoutSync();
  }
  if (typeof syncBattleHudAnchors === "function") syncBattleHudAnchors();
}

function getAvatarHeroStageRect(team) {
  const slot = getAvatarSlotEl(team);
  const candidates = [
    slot?.querySelector(".avatar-hero-stage"),
    slot?.querySelector(".profile-avatar"),
    slot,
    slot?.closest(".battle-scene-avatar"),
  ];
  for (const el of candidates) {
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  if (typeof getProfileAvatarViewportCenter === "function") {
    const center = getProfileAvatarViewportCenter(team);
    if (center?.x != null && center?.y != null) {
      const scale = typeof LayoutScales !== "undefined"
        ? LayoutScales.gameScale()
        : (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--game-scale"))
          || Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale"))
          || 1);
      const size = 228 * scale;
      return {
        left: center.x - size / 2,
        top: center.y - size / 2,
        width: size,
        height: size,
      };
    }
  }
  return { left: 0, top: 0, width: 0, height: 0 };
}

function getProfileAvatarFloatAnchor(team, lane = 0) {
  const rect = getAvatarHeroStageRect(team);
  if (!rect.width) {
    const c = getProfileAvatarViewportCenter(team);
    return { x: c.x, y: c.y - 48 - lane * 22 };
  }
  const spreadX = (lane % 3 - 1) * 14;
  return {
    x: rect.left + rect.width / 2 + spreadX,
    y: rect.top - 10 - lane * 24,
  };
}

function syncLiveAvatarHeroFrame(state) {
  if (!state) return;
  syncAvatarHeroResourceBars("player", state);
  syncAvatarHeroResourceBars("enemy", state);
  if (typeof syncAllDamageSummaryDisplays === "function") syncAllDamageSummaryDisplays(state);
}

function allocateHeroFloatLane(state, team) {
  const active = (state.floatingNumbers || []).filter(
    (fn) => fn.team === team && fn.anchorMode === "hero-above" && fn.age < (fn.delay || 0) + fn.maxAge,
  );
  for (let lane = 0; lane < 6; lane += 1) {
    if (!active.some((fn) => fn.lane === lane)) return lane;
  }
  return active.length % 6;
}
