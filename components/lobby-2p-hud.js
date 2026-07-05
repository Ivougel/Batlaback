/**
 * Лобби 2P — отдельный split-screen prep HUD (концепт: два столa, два магазина).
 */
const Lobby2pHud = (() => {
  let bound = false;
  let canvasHome = null;
  let callbacks = {};

  function register(deps) {
    callbacks = deps || {};
  }

  function isActive() {
    return typeof callbacks.isActive === "function" && callbacks.isActive();
  }

  function estimateLoadoutPower(items) {
    if (!items?.length) return 0;
    return items.reduce((sum, it) => {
      const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[it?.itemId] : null;
      return sum + (def?.cost || 1);
    }, 0);
  }

  function isBattleActive() {
    return typeof callbacks.isBattleActive === "function" && callbacks.isBattleActive();
  }

  function renderBattleChip(humanId) {
    const fighter = callbacks.getFighter?.(humanId);
    const classId = callbacks.getClassId?.(humanId);
    const chip = document.getElementById(`lobby2p-battle-chip-${humanId}`);
    const nameEl = document.getElementById(`lobby2p-battle-name-${humanId}`);
    const vsEl = document.getElementById(`lobby2p-battle-vs-${humanId}`);
    const hpEl = document.getElementById(`lobby2p-battle-hp-${humanId}`);
    const avatarEl = document.getElementById(`lobby2p-battle-avatar-${humanId}`);
    if (!chip) return;

    const alive = fighter?.alive !== false;
    const matchIdx = callbacks.getHumanMatchIndex?.(humanId) ?? -1;
    const spectating = callbacks.getSpectatedHuman?.() === humanId;
    const inBattle = !!callbacks.isHumanMatchLive?.(humanId);
    const finished = !!callbacks.isHumanMatchDone?.(humanId);
    const oppName = callbacks.getHumanOpponentName?.(humanId) || "—";

    if (nameEl) nameEl.textContent = fighter?.name || `Игрок ${humanId + 1}`;
    if (hpEl) hpEl.textContent = alive ? `♥ ${fighter?.hp ?? 0}` : "выбыл";
    if (vsEl) {
      let status = "—";
      if (!alive) status = "выбыл";
      else if (matchIdx < 0) status = "нет боя";
      else if (inBattle) status = `vs ${oppName} · LIVE`;
      else if (finished) status = `vs ${oppName} · ✓`;
      else status = `vs ${oppName}`;
      vsEl.textContent = status;
    }
    if (avatarEl && typeof getClassHeroPortraitSrc === "function") {
      const src = getClassHeroPortraitSrc(classId);
      if (src) {
        avatarEl.src = src;
        avatarEl.alt = fighter?.name || "";
      }
    }

    chip.disabled = !alive || matchIdx < 0;
    chip.classList.toggle("lobby2p-battle-chip--active", spectating);
    chip.classList.toggle("lobby2p-battle-chip--live", inBattle);
    chip.classList.toggle("lobby2p-battle-chip--done", finished && !inBattle);
    chip.classList.toggle("lobby2p-battle-chip--out", !alive);
    chip.setAttribute("aria-pressed", spectating ? "true" : "false");
  }

  function syncBattle() {
    const hud = document.getElementById("lobby2p-battle-hud");
    const active = isBattleActive();
    document.documentElement.toggleAttribute("data-lobby2p-battle", active);
    hud?.classList.toggle("hidden", !active);
    if (!active) return;

    const roundEl = document.getElementById("lobby2p-battle-round");
    if (roundEl && typeof callbacks.getRound === "function") {
      roundEl.textContent = String(callbacks.getRound());
    }
    const aliveEl = document.getElementById("lobby2p-battle-alive-count");
    if (aliveEl && typeof callbacks.getAliveCount === "function") {
      aliveEl.textContent = String(callbacks.getAliveCount());
    }

    renderBattleChip(0);
    renderBattleChip(1);
  }

  function renderEnhancements(enhancements) {
    if (!enhancements) return '<span class="lobby2p-equip-slot empty">—</span>'.repeat(3);
    const slots = ["head", "chest", "boots"];
    return slots.map((slot) => {
      const id = enhancements[slot];
      if (!id) return '<span class="lobby2p-equip-slot empty">—</span>';
      const def = typeof getEnhancementDef === "function" ? getEnhancementDef(id) : null;
      const icon = def?.icon || "✨";
      return `<span class="lobby2p-equip-slot" title="${def?.name || id}">${icon}</span>`;
    }).join("");
  }

  function mountCanvas() {
    const host = document.getElementById("lobby2p-canvas-host");
    const layerWorld = document.getElementById("layer-world");
    const layerFx = document.getElementById("layer-fx");
    if (!host || !layerWorld) return;
    if (!canvasHome) {
      canvasHome = {
        worldParent: layerWorld.parentElement,
        fxParent: layerFx?.parentElement || null,
        worldNext: layerWorld.nextSibling,
        fxNext: layerFx?.nextSibling || null,
      };
    }
    host.appendChild(layerWorld);
    if (layerFx) host.appendChild(layerFx);
    if (typeof callbacks.scheduleLayout === "function") callbacks.scheduleLayout();
  }

  function unmountCanvas() {
    if (!canvasHome) return;
    const layerWorld = document.getElementById("layer-world");
    const layerFx = document.getElementById("layer-fx");
    if (layerWorld && canvasHome.worldParent) {
      canvasHome.worldParent.insertBefore(layerWorld, canvasHome.worldNext);
    }
    if (layerFx && canvasHome.fxParent) {
      canvasHome.fxParent.insertBefore(layerFx, canvasHome.fxNext);
    }
    if (typeof callbacks.scheduleLayout === "function") callbacks.scheduleLayout();
  }

  function renderColumn(humanId, fighter, classId, enhancements) {
    const nameEl = document.getElementById(`lobby2p-name-${humanId}`);
    const goldEl = document.getElementById(`lobby2p-gold-${humanId}`);
    const hpEl = document.getElementById(`lobby2p-hp-${humanId}`);
    const avatarEl = document.getElementById(`lobby2p-avatar-${humanId}`);
    const equipEl = document.getElementById(`lobby2p-equip-${humanId}`);
    const benchCountEl = document.getElementById(`lobby2p-bench-count-${humanId}`);
    const head = document.querySelector(`.lobby2p-col-head[data-human="${humanId}"]`);
    const actions = document.querySelector(`.lobby2p-col-actions[data-human="${humanId}"]`);
    const commerce = document.querySelector(`.lobby2p-col-commerce[data-human="${humanId}"]`);

    if (nameEl) nameEl.textContent = fighter?.name || `Игрок ${humanId + 1}`;
    if (goldEl) goldEl.textContent = String(fighter?.gold ?? 0);
    if (hpEl) hpEl.textContent = String(fighter?.hp ?? 0);
    if (avatarEl && typeof getClassHeroPortraitSrc === "function") {
      const src = getClassHeroPortraitSrc(classId);
      if (src) {
        avatarEl.src = src;
        avatarEl.alt = fighter?.name || "";
      }
    }
    if (equipEl) equipEl.innerHTML = renderEnhancements(enhancements);

    const activeHuman = typeof callbacks.getActiveHuman === "function" ? callbacks.getActiveHuman() : 0;
    const ready = !!callbacks.getReady?.(humanId);
    const fighting = !!callbacks.hasSideBattle?.(humanId);
    const alive = fighter?.alive !== false;

    head?.classList.toggle("lobby2p-col-head--active", humanId === activeHuman);
    head?.classList.toggle("lobby2p-col-head--ready", ready);
    head?.classList.toggle("lobby2p-col-head--fighting", fighting);
    head?.classList.toggle("lobby2p-col-head--out", !alive);
    commerce?.classList.toggle("lobby2p-col-commerce--active", humanId === activeHuman);
    actions?.classList.toggle("lobby2p-col-actions--ready", ready);
    actions?.classList.toggle("lobby2p-col-actions--fighting", fighting);

    const readyBtn = actions?.querySelector(".lobby2p-ready");
    const farmBtn = actions?.querySelector(".lobby2p-farm");
    const duelBtn = actions?.querySelector(".lobby2p-duel");
    const blocked = !!callbacks.hasActiveDuel?.() || !alive;
    if (readyBtn) {
      readyBtn.classList.toggle("lobby2p-ready--active", ready);
      readyBtn.disabled = blocked || fighting;
      readyBtn.textContent = ready ? "✓ Готов" : "Готов";
    }
    if (farmBtn) farmBtn.disabled = blocked || !!callbacks.hasAnySideBattle?.();
    if (duelBtn) duelBtn.disabled = blocked || !!callbacks.hasAnySideBattle?.();

    const badgesEl = document.getElementById(`lobby2p-badges-${humanId}`);
    if (badgesEl) {
      const tags = [];
      if (!alive) tags.push("выбыл");
      else if (fighting) tags.push("в бою");
      else if (ready) tags.push("готов");
      else if (humanId === activeHuman) tags.push("редакт.");
      badgesEl.textContent = tags.length ? tags.join(" · ") : "";
    }

    if (benchCountEl && typeof callbacks.getBenchCount === "function") {
      benchCountEl.textContent = String(callbacks.getBenchCount(humanId));
    }
  }

  function renderPowerBar() {
    const p0 = estimateLoadoutPower(callbacks.getItems?.(0));
    const p1 = estimateLoadoutPower(callbacks.getItems?.(1));
    const total = Math.max(1, p0 + p1);
    const el0 = document.getElementById("lobby2p-power-p0");
    const el1 = document.getElementById("lobby2p-power-p1");
    if (el0) el0.style.flex = String(p0 / total);
    if (el1) el1.style.flex = String(p1 / total);
  }

  function renderRosterDrawer() {
    const body = document.getElementById("lobby2p-roster-drawer-body");
    if (!body || typeof callbacks.renderRosterHtml !== "function") return;
    body.innerHTML = callbacks.renderRosterHtml();
  }

  function renderCommerce() {
    if (typeof callbacks.renderCommerce === "function") callbacks.renderCommerce();
  }

  function sync() {
    const layout = document.getElementById("lobby2p-prep-layout");
    const active = isActive();
    document.documentElement.toggleAttribute("data-lobby2p-hud", active);
    layout?.classList.toggle("hidden", !active);

    if (!active) {
      unmountCanvas();
      document.getElementById("lobby2p-roster-drawer")?.classList.add("hidden");
      if (typeof window.closePrepShopPopover === "function") window.closePrepShopPopover();
      if (typeof window.closePrepBenchPopover === "function") window.closePrepBenchPopover();
      if (typeof window.syncShopMount === "function") window.syncShopMount();
      return;
    }

    mountCanvas();
    if (typeof window.syncShopMount === "function") window.syncShopMount();
    const roundEl = document.getElementById("lobby2p-top-round");
    if (roundEl && typeof callbacks.getRound === "function") {
      roundEl.textContent = String(callbacks.getRound());
    }
    const aliveEl = document.getElementById("lobby2p-top-alive-count");
    if (aliveEl && typeof callbacks.getAliveCount === "function") {
      aliveEl.textContent = String(callbacks.getAliveCount());
    }

    if (typeof callbacks.getFighter === "function") {
      renderColumn(0, callbacks.getFighter(0), callbacks.getClassId?.(0), callbacks.getEnhancements?.(0));
      renderColumn(1, callbacks.getFighter(1), callbacks.getClassId?.(1), callbacks.getEnhancements?.(1));
    }
    renderPowerBar();
    renderCommerce();
    renderRosterDrawer();
    syncBattle();
  }

  function bindBattle() {
    const hud = document.getElementById("lobby2p-battle-hud");
    hud?.addEventListener("click", (e) => {
      const chip = e.target.closest(".lobby2p-battle-chip");
      if (chip && !chip.disabled) {
        callbacks.spectateHuman?.(Number(chip.dataset.human));
        return;
      }
      if (e.target.closest("#lobby2p-battle-roster-btn")) {
        const dropdown = document.getElementById("standings-dropdown");
        const strip = document.getElementById("lobby-roster-strip-battle");
        if (dropdown && strip) dropdown.innerHTML = strip.innerHTML;
        document.getElementById("btn-standings-toggle")?.click();
      }
    });
  }

  function bind() {
    if (bound) return;
    bound = true;
    bindBattle();
    const split = document.getElementById("lobby2p-split");
    split?.addEventListener("click", (e) => {
      const shopFab = e.target.closest(".lobby2p-shop-fab");
      if (shopFab) {
        e.stopPropagation();
        callbacks.toggleShop?.(Number(shopFab.dataset.human));
        return;
      }
      const benchFab = e.target.closest(".lobby2p-bench-fab");
      if (benchFab) {
        e.stopPropagation();
        callbacks.toggleBench?.(Number(benchFab.dataset.human));
        return;
      }
      const head = e.target.closest(".lobby2p-col-head");
      if (head && !e.target.closest("button")) {
        callbacks.setActiveHuman?.(Number(head.dataset.human));
        return;
      }
      const actions = e.target.closest(".lobby2p-col-actions");
      if (!actions) return;
      const humanId = Number(actions.dataset.human);
      if (e.target.closest(".lobby2p-ready")) callbacks.toggleReady?.(humanId);
      else if (e.target.closest(".lobby2p-farm")) callbacks.startFarm?.(humanId);
      else if (e.target.closest(".lobby2p-duel")) callbacks.startDuel?.(humanId);
    });

    document.getElementById("lobby2p-roster-toggle")?.addEventListener("click", () => {
      document.getElementById("lobby2p-roster-drawer")?.classList.toggle("hidden");
      renderRosterDrawer();
    });
  }

  return { register, sync, syncBattle, bind, mountCanvas, unmountCanvas, isActive, isBattleActive };
})();

window.Lobby2pHud = Lobby2pHud;
