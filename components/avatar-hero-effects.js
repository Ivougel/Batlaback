/**
 * Область героя: бусины баффов/дебаффов, HP под аватаром, transient-комpanions.
 */

const DEBUFF_BEAD_LABELS = {
  poison: "яд",
  slow: "замедл.",
  "ground-fire": "огонь",
  stun: "оглуш.",
  invuln: "неуяз.",
  revive: "рев.",
  "arena-fatigue": "устал.",
};

function getAvatarSlotEl(team) {
  return document.getElementById(team === "player" ? "player-avatar-slot" : "enemy-avatar-slot");
}

function renderAvatarHeroHTML(profile, team) {
  const className = escapeProfileHtml(profile.className || "—");
  const icon = profile.classIconSrc
    ? `<img class="profile-avatar-img" src="${escapeProfileHtml(profile.classIconSrc)}" alt="${className}" draggable="false">`
    : escapeProfileHtml(profile.classIcon || "❓");
  const gold = profile.gold ?? 0;
  const tooltipDesc = escapeProfileHtml(`💰 ${gold} золота`);
  const displayName = escapeProfileHtml(profile.name || (team === "player" ? "Игрок" : "ИИ"));
  const hpCurrent = profile.hpCurrent ?? profile.hp ?? 0;
  const hpMax = profile.hpMax ?? profile.hp ?? 100;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const staminaCurrent = profile.staminaCurrent ?? profile.stamina ?? 0;
  const staminaMax = profile.staminaMax ?? 40;
  const staminaPct = Math.max(0, Math.min(100, (staminaCurrent / Math.max(1, staminaMax)) * 100));

  return `
    <div class="avatar-hero-shell avatar-hero-shell-${team}" data-team="${team}">
      <div class="avatar-hero-name">${displayName}</div>
      <div class="avatar-hero-stage">
        <div class="avatar-emotion-orbit" data-team="${team}" aria-hidden="true">
          <span class="avatar-emotion-float avatar-emotion-kayfu avatar-emotion-kayfu-active" aria-hidden="true">🤠</span>
          <span class="avatar-emotion-float avatar-emotion-mood" aria-hidden="true"></span>
          <span class="avatar-emotion-float avatar-emotion-reaction" hidden></span>
          <span class="avatar-battle-timer" hidden aria-hidden="true">0:00</span>
        </div>
        <div class="avatar-effect-orbit" data-team="${team}" aria-hidden="true"></div>
        <div class="avatar-beads avatar-beads-positive" aria-hidden="true" hidden></div>
        <div class="profile-avatar profile-avatar-${team}"
             data-status-title="${className}"
             data-status-desc="${tooltipDesc}"
             tabindex="0"
             aria-label="${className}">${icon}</div>
        <div class="avatar-beads avatar-beads-negative" aria-hidden="true"></div>
      </div>
      <div class="avatar-hero-footer">
        <div class="avatar-damage-stacks" aria-hidden="true" hidden></div>
        <div class="avatar-dot-stacks" aria-hidden="true" hidden></div>
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
        <div class="avatar-benefit-stacks" aria-hidden="true" hidden></div>
        <div class="avatar-hero-debuff-row" hidden></div>
      </div>
    </div>
  `;
}

function getBeadDebuffLabel(chip) {
  if (DEBUFF_BEAD_LABELS[chip.id]) return DEBUFF_BEAD_LABELS[chip.id];
  return (chip.title || chip.id || "эффект").slice(0, 8).toLowerCase();
}

function renderPositiveBeadHTML(bead, index, total) {
  const count = bead.count > 1 ? `<span class="avatar-bead-count">×${bead.count}</span>` : "";
  const title = escapeProfileHtml(bead.title || bead.icon || "");
  const transient = bead.transient ? " avatar-bead-transient" : "";
  const opacity = bead.transient && bead.maxAge
    ? Math.max(0.12, 1 - (bead.age / bead.maxAge) * 0.88)
    : 1;
  return `<span class="avatar-bead avatar-bead-positive avatar-bead-${bead.kind || "buff"}${transient}"
    style="--bead-i:${index};--bead-n:${Math.max(1, total)};opacity:${opacity.toFixed(2)}"
    data-bead-key="${escapeProfileHtml(bead.key || bead.id || "")}"
    title="${title}">${bead.icon}${count}</span>`;
}

function renderDebuffBeadHTML(chip) {
  const label = getBeadDebuffLabel(chip);
  const title = escapeProfileHtml((chip.lines || []).join("\n") || chip.title || "");
  return `<span class="avatar-bead avatar-bead-debuff avatar-bead-debuff-${escapeProfileHtml(chip.id)}"
    data-status-id="${escapeProfileHtml(chip.id)}"
    data-status-title="${escapeProfileHtml(chip.title || "")}"
    data-status-desc="${title}"
    tabindex="0"
    title="${title}"><span class="avatar-bead-debuff-icon">${chip.icon}</span><span class="avatar-bead-debuff-label">${escapeProfileHtml(label)}</span><span class="avatar-bead-debuff-value">${chip.value}</span></span>`;
}

function collectPositiveBeads(profile, team, state) {
  const beads = [];
  const seen = new Set();

  (profile.buffs || []).forEach((chip) => {
    if (seen.has(chip.id)) return;
    seen.add(chip.id);
    beads.push({
      key: chip.id,
      id: chip.id,
      icon: chip.icon,
      count: (chip.id.startsWith("timed-") || chip.id.startsWith("stack-")) && chip.value > 1
        ? chip.value
        : 0,
      kind: chip.id === "block" ? "block" : "buff",
      title: chip.title,
      transient: false,
      age: 0,
      maxAge: 0,
    });
  });

  return beads.slice(0, 8);
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

function syncAvatarHeroHealPreview(shell, hpCurrent, hpMax, projectedHeal2s) {
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const healPreview = shell.querySelector(".avatar-hero-hp-heal-preview");
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
  if (!shell || !state) return;

  const side = team === "player" ? state.player : state.enemy;
  const hpCurrent = side?.hp ?? 0;
  const hpMax = side?.maxHp ?? 100;
  const staminaCurrent = side?.stamina ?? 0;
  const staminaMax = side?.maxStamina ?? 40;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const staminaPct = Math.max(0, Math.min(100, (staminaCurrent / Math.max(1, staminaMax)) * 100));
  const metrics = getSideBattleMetrics(state, team);

  const hpFill = shell.querySelector(".avatar-hero-hp-fill");
  const hpLabel = shell.querySelector(".avatar-hero-hp-label");
  const staminaFill = shell.querySelector(".avatar-hero-stamina-fill");
  const staminaLabel = shell.querySelector(".avatar-hero-stamina-label");

  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (hpLabel) hpLabel.textContent = formatHeroHpLabel(hpCurrent, hpMax);
  if (staminaFill) staminaFill.style.width = `${staminaPct}%`;
  if (staminaLabel) staminaLabel.textContent = formatHeroStaminaLabel(staminaCurrent, staminaMax);
  syncAvatarHeroHealPreview(shell, hpCurrent, hpMax, metrics?.projectedHeal2s ?? 0);
}

function syncAvatarHeroHpOnly(team, hpCurrent, hpMax, state = null) {
  const slot = getAvatarSlotEl(team);
  const shell = slot?.querySelector(".avatar-hero-shell");
  if (!shell) return;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));
  const hpFill = shell.querySelector(".avatar-hero-hp-fill");
  const hpLabel = shell.querySelector(".avatar-hero-hp-label");
  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (hpLabel) hpLabel.textContent = formatHeroHpLabel(hpCurrent, hpMax);
  const metrics = state ? getSideBattleMetrics(state, team) : null;
  syncAvatarHeroHealPreview(shell, hpCurrent, hpMax, metrics?.projectedHeal2s ?? 0);
}

function syncAvatarCompanionBeads(team, state) {
  const slot = getAvatarSlotEl(team);
  const posEl = slot?.querySelector(".avatar-beads-positive");
  if (!posEl || !state?.avatarCompanions?.[team]) return;

  const companions = state.avatarCompanions[team].filter((c) => c.age < c.maxAge);
  const keys = new Set(companions.map((c) => c.key));

  posEl.querySelectorAll(".avatar-bead-transient").forEach((el) => {
    if (!keys.has(el.dataset.beadKey)) el.remove();
  });

  companions.forEach((c, i) => {
    let el = posEl.querySelector(`.avatar-bead-transient[data-bead-key="${CSS.escape(c.key)}"]`);
    const opacity = Math.max(0.12, 1 - (c.age / c.maxAge) * 0.88);
    const countHtml = c.count > 1 ? `<span class="avatar-bead-count">×${c.count}</span>` : "";
    if (!el) {
      posEl.insertAdjacentHTML("beforeend", `<span class="avatar-bead avatar-bead-positive avatar-bead-${c.kind || "buff"} avatar-bead-transient"
        style="--bead-i:${i};--bead-n:${Math.max(1, companions.length)};opacity:${opacity.toFixed(2)}"
        data-bead-key="${escapeProfileHtml(c.key)}"
        title="${escapeProfileHtml(c.title || "")}">${c.icon}${countHtml}</span>`);
      return;
    }
    el.style.opacity = String(opacity);
    el.style.setProperty("--bead-i", String(i));
    el.style.setProperty("--bead-n", String(Math.max(1, companions.length)));
    const countEl = el.querySelector(".avatar-bead-count");
    if (c.count > 1) {
      if (countEl) countEl.textContent = `×${c.count}`;
      else el.insertAdjacentHTML("beforeend", `<span class="avatar-bead-count">×${c.count}</span>`);
    } else if (countEl) {
      countEl.remove();
    }
  });
}

function syncAvatarHeroEffects(team, profile, state) {
  const slot = getAvatarSlotEl(team);
  if (!slot) return;
  const shell = slot.querySelector(".avatar-hero-shell");
  if (!shell) return;

  const hpCurrent = profile.hpCurrent ?? profile.hp ?? 0;
  const hpMax = profile.hpMax ?? profile.hp ?? 100;
  const hpPct = Math.max(0, Math.min(100, (hpCurrent / Math.max(1, hpMax)) * 100));

  const staminaCurrent = profile.staminaCurrent ?? profile.stamina ?? 0;
  const staminaMax = profile.staminaMax ?? 40;
  const staminaPct = Math.max(0, Math.min(100, (staminaCurrent / Math.max(1, staminaMax)) * 100));
  const metrics = getSideBattleMetrics(state, team);

  const hpFill = shell.querySelector(".avatar-hero-hp-fill");
  const hpLabel = shell.querySelector(".avatar-hero-hp-label");
  const staminaFill = shell.querySelector(".avatar-hero-stamina-fill");
  const staminaLabel = shell.querySelector(".avatar-hero-stamina-label");
  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (hpLabel) hpLabel.textContent = formatHeroHpLabel(hpCurrent, hpMax);
  if (staminaFill) staminaFill.style.width = `${staminaPct}%`;
  if (staminaLabel) staminaLabel.textContent = formatHeroStaminaLabel(staminaCurrent, staminaMax);
  syncAvatarHeroHealPreview(shell, hpCurrent, hpMax, metrics?.projectedHeal2s ?? 0);

  const posEl = shell.querySelector(".avatar-beads-positive");
  const debuffRow = shell.querySelector(".avatar-hero-debuff-row");
  const negRing = shell.querySelector(".avatar-beads-negative");

  const posBeads = collectPositiveBeads(profile, team, state);
  if (posEl) {
    const persistent = posBeads.filter((b) => !b.transient);
    posEl.querySelectorAll(".avatar-bead-positive:not(.avatar-bead-transient)").forEach((el) => el.remove());
    persistent.forEach((b, i) => {
      posEl.insertAdjacentHTML("beforeend", renderPositiveBeadHTML(b, i, persistent.length));
    });
  }
  const debuffs = profile.debuffs || [];
  if (debuffRow && !shell.querySelector(".avatar-effect-orbit")) {
    debuffRow.innerHTML = debuffs.map(renderDebuffBeadHTML).join("");
  }
  if (negRing) negRing.innerHTML = "";

  shell.classList.toggle("avatar-hero-has-buffs", posBeads.length > 0);
  shell.classList.toggle("avatar-hero-has-debuffs", debuffs.length > 0);
}

function syncAllAvatarHeroEffects(playerProfile, enemyProfile, state) {
  syncAvatarHeroEffects("player", playerProfile, state);
  syncAvatarHeroEffects("enemy", enemyProfile, state);
}

function initAvatarCompanions(state) {
  if (!state.avatarCompanions) {
    state.avatarCompanions = { player: [], enemy: [] };
  }
  if (state._beadUid == null) state._beadUid = 0;
}

function queueAvatarCompanionBead(state, team, item, kind, iconOverride) {
  if (!state || !team) return;
  initAvatarCompanions(state);
  const def = item?.itemId ? ITEM_CATALOG[item.itemId] : null;
  const icon = iconOverride || def?.icon || (kind === "heal" ? "❤" : "🛡");
  const key = item?.uid ? `item-${item.uid}` : `${kind}-${icon}`;
  const list = state.avatarCompanions[team];
  const existing = list.find((b) => b.key === key && b.age < b.maxAge);
  if (existing) {
    existing.count += 1;
    existing.age = 0;
    return;
  }
  state._beadUid += 1;
  list.push({
    uid: `cbead-${state._beadUid}`,
    key,
    icon,
    kind: kind || "buff",
    count: 1,
    age: 0,
    maxAge: 2.6,
    title: def?.name || "",
  });
}

function tickAvatarCompanions(state, dt) {
  if (!state?.avatarCompanions) return;
  ["player", "enemy"].forEach((team) => {
    state.avatarCompanions[team] = state.avatarCompanions[team]
      .map((b) => ({ ...b, age: b.age + dt }))
      .filter((b) => b.age < b.maxAge);
  });
}

function getAvatarHeroStageRect(team) {
  const slot = getAvatarSlotEl(team);
  const stage = slot?.querySelector(".avatar-hero-stage");
  if (stage) {
    const rect = stage.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  const avatar = slot?.querySelector(".profile-avatar");
  if (avatar) return avatar.getBoundingClientRect();
  return getProfileAvatarViewportCenter(team);
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
