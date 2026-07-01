/**
 * Combat Feed — плавающий журнал игровых событий (prep + battle).
 * API: CombatLog.addEvent({ type, text, mergeKey?, icon? })
 */

const COMBAT_FEED_STORAGE_KEY = "batlaback_combat_feed_enabled";

const COMBAT_FEED_CONFIG = {
  maxMessages: 50,
  widthMin: 340,
  widthMax: 420,
  heightMin: 180,
  heightMax: 220,
  collapsedHeight: 38,
  collapseMs: 225,
  enterMs: 280,
  scrollBottomThreshold: 48,
  titleExpanded: "📜 События",
  titleCollapsed: "📜 События",
  types: {
    neutral: { icon: "ℹ️", className: "combat-feed-msg--neutral" },
    synergy: { icon: "✨", className: "combat-feed-msg--synergy" },
    crit: { icon: "💥", className: "combat-feed-msg--crit" },
    damage: { icon: "🩸", className: "combat-feed-msg--damage" },
    heal: { icon: "❤", className: "combat-feed-msg--heal" },
    block: { icon: "🛡", className: "combat-feed-msg--block" },
    poison: { icon: "☠", className: "combat-feed-msg--poison" },
    burn: { icon: "🔥", className: "combat-feed-msg--burn" },
    freeze: { icon: "❄", className: "combat-feed-msg--freeze" },
    buff: { icon: "⚡", className: "combat-feed-msg--buff" },
    debuff: { icon: "⬇", className: "combat-feed-msg--debuff" },
    rare: { icon: "⭐", className: "combat-feed-msg--rare" },
    item: { icon: "🎒", className: "combat-feed-msg--item" },
    purchase: { icon: "🪙", className: "combat-feed-msg--purchase" },
    sell: { icon: "💰", className: "combat-feed-msg--sell" },
    craft: { icon: "⚗", className: "combat-feed-msg--craft" },
    backpack: { icon: "🎒", className: "combat-feed-msg--backpack" },
    gem: { icon: "💎", className: "combat-feed-msg--gem" },
    win: { icon: "🏆", className: "combat-feed-msg--win" },
    loss: { icon: "💀", className: "combat-feed-msg--loss" },
  },
};

const CombatLog = (() => {
  const messages = [];
  let enabled = true;
  let collapsed = true;
  let autoScroll = true;
  let lastMerge = null;
  let lastSynergyKeys = new Set();
  let synergySeeded = false;

  let rootEl;
  let panelEl;
  let scrollEl;
  let toggleBtn;
  let toolbarBtn;
  let dockEl;
  let feedTooltipActive = false;
  /** @type {Array<object>} */
  const deferredEvents = [];

  function isCombatFeedPhaseActive() {
    const ph = document.getElementById("app")?.dataset.phase;
    return ph === "prep";
  }

  function isCombatFeedVisible() {
    return enabled && isCombatFeedPhaseActive();
  }

  function bracketItemName(name) {
    const label = String(name || "").trim();
    return label ? `[${label}]` : "";
  }

  function itemDisplayBracket(def) {
    if (!def) return "";
    const icon = def.icon ? `${def.icon} ` : "";
    return `${icon}${bracketItemName(def.name || def.id)}`.trim();
  }

  function itemFeedHint(def) {
    if (!def) return "";
    const desc = typeof getItemTooltipDescription === "function"
      ? getItemTooltipDescription(def)
      : (def.description || "");
    const hints = typeof getItemBuildHints === "function"
      ? getItemBuildHints(def)
      : (def.buildHints || "");
    return [desc, hints].filter(Boolean).join("\n");
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showFeedHintAt(clientX, clientY, hint) {
    const el = document.getElementById("sidebar-tooltip");
    if (!el || !hint) return;
    feedTooltipActive = true;
    if (typeof markCombatFeedTooltipActive === "function") {
      markCombatFeedTooltipActive();
    }
    el.classList.remove("synergy-tooltip");
    el.classList.add("combat-feed-hint-tooltip");
    el.innerHTML = String(hint)
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const html = typeof formatTooltipMechanicText === "function"
          ? formatTooltipMechanicText(line)
          : escapeHtml(line);
        return `<div class="tt-line tt-sub">${html}</div>`;
      })
      .join("");
    el.style.borderColor = "#484f58";
    el.classList.remove("hidden");
    if (typeof positionSidebarTooltip === "function") {
      positionSidebarTooltip(clientX, clientY, "viewport", "auto");
    }
  }

  function hideFeedHint() {
    if (!feedTooltipActive) return;
    const el = document.getElementById("sidebar-tooltip");
    el?.classList.remove("combat-feed-hint-tooltip");
    if (typeof hideSidebarTooltip === "function") {
      hideSidebarTooltip();
      return;
    }
    feedTooltipActive = false;
    el?.classList.add("hidden");
    if (typeof clearCombatFeedTooltipActive === "function") clearCombatFeedTooltipActive();
    if (typeof syncPrepTooltipDockVisibility === "function") syncPrepTooltipDockVisibility();
  }

  function onExternalTooltipHide() {
    feedTooltipActive = false;
  }

  function bindFeedTooltipHandlers() {
    if (!scrollEl || scrollEl.dataset.feedTooltipsBound) return;
    scrollEl.dataset.feedTooltipsBound = "1";

    const findHintTextEl = (target) => target?.closest?.(".combat-feed-msg-text[data-hint]");

    scrollEl.addEventListener("mouseenter", (e) => {
      const textEl = findHintTextEl(e.target);
      if (!textEl) return;
      showFeedHintAt(e.clientX, e.clientY, textEl.dataset.hint);
    }, true);

    scrollEl.addEventListener("mousemove", (e) => {
      const textEl = findHintTextEl(e.target);
      if (textEl && !feedTooltipActive) {
        showFeedHintAt(e.clientX, e.clientY, textEl.dataset.hint);
      }
      if (!feedTooltipActive) return;
      if (typeof moveSidebarTooltip === "function") {
        moveSidebarTooltip(e, "viewport", "auto");
      } else if (typeof positionSidebarTooltip === "function") {
        positionSidebarTooltip(e.clientX, e.clientY, "viewport", "auto");
      }
    }, true);

    scrollEl.addEventListener("mouseleave", (e) => {
      if (!findHintTextEl(e.target)) return;
      if (findHintTextEl(e.relatedTarget)) return;
      hideFeedHint();
    }, true);

    scrollEl.addEventListener("click", (e) => {
      const textEl = findHintTextEl(e.target);
      if (!textEl) return;
      if (typeof isTouchUi === "function" && isTouchUi()) {
        e.preventDefault();
        e.stopPropagation();
        if (feedTooltipActive && scrollEl.querySelector(".combat-feed-msg-text[data-hint-active]") === textEl) {
          hideFeedHint();
          textEl.removeAttribute("data-hint-active");
          return;
        }
        scrollEl.querySelectorAll(".combat-feed-msg-text[data-hint-active]").forEach((node) => {
          node.removeAttribute("data-hint-active");
        });
        textEl.dataset.hintActive = "1";
        showFeedHintAt(e.clientX, e.clientY, textEl.dataset.hint);
      }
    });

    document.addEventListener("click", (e) => {
      if (!feedTooltipActive) return;
      if (findHintTextEl(e.target)) return;
      hideFeedHint();
      scrollEl.querySelectorAll(".combat-feed-msg-text[data-hint-active]").forEach((node) => {
        node.removeAttribute("data-hint-active");
      });
    }, true);

    scrollEl.addEventListener("scroll", () => {
      if (feedTooltipActive) hideFeedHint();
    }, { passive: true });
  }

  function applyMessageTextEl(textEl, entry) {
    textEl.textContent = entry.text;
    if (entry.hint) {
      textEl.dataset.hint = entry.hint;
      textEl.classList.add("combat-feed-msg-text--hinted");
      textEl.setAttribute("tabindex", "0");
      textEl.setAttribute("role", "button");
      textEl.setAttribute("aria-label", "Подсказка к событию");
    } else {
      delete textEl.dataset.hint;
      textEl.classList.remove("combat-feed-msg-text--hinted");
      textEl.removeAttribute("tabindex");
      textEl.removeAttribute("role");
      textEl.removeAttribute("aria-label");
    }
  }

  function syncToolbarButton() {
    if (!toolbarBtn) return;
    const chevron = toolbarBtn.querySelector(".btn-combat-feed-chevron");
    toolbarBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toolbarBtn.classList.toggle("btn-combat-feed--open", !collapsed);
    if (chevron) chevron.textContent = collapsed ? "▾" : "▴";
  }

  function syncPanelOpenState() {
    if (!panelEl) return;
    panelEl.classList.toggle("combat-feed-panel--collapsed", collapsed);
    panelEl.classList.toggle("combat-feed-panel--open", !collapsed);
  }

  function isEnabled() {
    return enabled;
  }

  function rerenderAll() {
    if (!scrollEl) return;
    scrollEl.innerHTML = "";
    messages.forEach((entry) => {
      scrollEl.appendChild(renderMessageBubble(entry, false));
    });
    scrollToBottomIfNeeded();
  }

  function setEnabled(next) {
    enabled = !!next;
    try {
      localStorage.setItem(COMBAT_FEED_STORAGE_KEY, enabled ? "1" : "0");
    } catch (_) { /* ignore */ }
    syncVisibility();
    if (enabled) rerenderAll();
  }

  function loadEnabled() {
    try {
      const raw = localStorage.getItem(COMBAT_FEED_STORAGE_KEY);
      if (raw === "0") enabled = false;
      else if (raw === "1") enabled = true;
    } catch (_) { /* ignore */ }
  }

  function syncVisibility() {
    if (!rootEl) return;
    const hidden = !isCombatFeedVisible();
    rootEl.classList.toggle("combat-feed--hidden", hidden);
    rootEl.setAttribute("aria-hidden", hidden ? "true" : "false");
    if (dockEl) dockEl.classList.toggle("combat-feed-dock--hidden", hidden);
    if (toolbarBtn) toolbarBtn.disabled = hidden;
  }

  function flushDeferredEvents() {
    if (!isCombatFeedPhaseActive() || !enabled || !deferredEvents.length) return;
    const batch = deferredEvents.splice(0);
    batch.forEach((payload) => addEventCore(payload));
  }

  function syncCombatFeedPhase() {
    if (!isCombatFeedPhaseActive()) hideFeedHint();
    syncVisibility();
    flushDeferredEvents();
  }

  function syncCollapsedUi() {
    syncPanelOpenState();
    syncToolbarButton();
    if (!toggleBtn) return;
    toggleBtn.textContent = collapsed ? "▾" : "▴";
    toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggleBtn.setAttribute("aria-label", collapsed ? "Развернуть журнал" : "Свернуть журнал");
  }

  function setCollapsed(next) {
    collapsed = !!next;
    syncCollapsedUi();
    if (!collapsed) scrollToBottomIfNeeded();
    if (typeof positionPrepTooltipDock === "function") {
      requestAnimationFrame(() => {
        const tip = document.getElementById("sidebar-tooltip");
        if (tip && !tip.classList.contains("hidden")) positionPrepTooltipDock();
      });
    }
  }

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  function trimHistory() {
    while (messages.length > COMBAT_FEED_CONFIG.maxMessages) {
      messages.shift();
      if (scrollEl?.firstElementChild) scrollEl.firstElementChild.remove();
    }
  }

  function normalizeMergeKey(type, text, mergeKey) {
    if (mergeKey) return String(mergeKey);
    return `${type}:${String(text).replace(/\d+(?:\.\d+)?/g, "#").trim()}`;
  }

  function formatMergedText(baseText, count) {
    if (count <= 1) return baseText;
    const goldMatch = baseText.match(/^(.+?)(\d+)(\s*💰?)$/);
    if (goldMatch) {
      const unit = parseInt(goldMatch[2], 10) || 1;
      return `${goldMatch[1]}${unit * count}${goldMatch[3] || ""}`;
    }
    const synergyMatch = baseText.match(/^(.+?)(?:\s×\d+)?$/);
    if (synergyMatch && (baseText.includes("Синергия") || baseText.includes("синерг"))) {
      return `${synergyMatch[1].trim()} ×${count}`;
    }
    if (baseText.includes("×")) return baseText.replace(/×\d+$/, `×${count}`);
    return `${baseText} ×${count}`;
  }

  function renderMessageBubble(entry, animate) {
    const meta = COMBAT_FEED_CONFIG.types[entry.type] || COMBAT_FEED_CONFIG.types.neutral;
    const el = document.createElement("div");
    el.className = `combat-feed-msg ${meta.className}${animate ? " combat-feed-msg--enter" : ""}`;
    el.dataset.feedId = entry.id;

    const icon = document.createElement("span");
    icon.className = "combat-feed-msg-icon";
    icon.textContent = entry.icon || meta.icon;
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "combat-feed-msg-text";
    applyMessageTextEl(text, entry);

    el.appendChild(icon);
    el.appendChild(text);

    if (animate) {
      window.setTimeout(() => el.classList.remove("combat-feed-msg--enter"), COMBAT_FEED_CONFIG.enterMs + 40);
    }
    return el;
  }

  function updateBubbleText(entry) {
    if (!scrollEl) return;
    const el = scrollEl.querySelector(`[data-feed-id="${entry.id}"] .combat-feed-msg-text`);
    if (el) applyMessageTextEl(el, entry);
  }

  function scrollToBottomIfNeeded() {
    if (!scrollEl || !autoScroll) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function onScroll() {
    if (!scrollEl) return;
    const dist = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    autoScroll = dist <= COMBAT_FEED_CONFIG.scrollBottomThreshold;
  }

  function addEventCore(payload = {}) {
    const type = payload.type || "neutral";
    const text = String(payload.text || "").trim();
    if (!text) return;

    const mergeKey = normalizeMergeKey(type, text, payload.mergeKey);
    const now = Date.now();

    if (
      lastMerge
      && lastMerge.key === mergeKey
      && now - lastMerge.at < 2500
      && messages.length
    ) {
      const entry = messages[messages.length - 1];
      entry.count = (entry.count || 1) + 1;
      entry.text = formatMergedText(lastMerge.baseText, entry.count);
      entry.at = now;
      lastMerge.at = now;
      updateBubbleText(entry);
      scrollToBottomIfNeeded();
      return;
    }

    const entry = {
      id: `feed-${now}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      text,
      hint: payload.hint ? String(payload.hint).trim() : "",
      icon: payload.icon || null,
      count: 1,
      at: now,
    };

    messages.push(entry);
    trimHistory();
    lastMerge = { key: mergeKey, baseText: text, at: now };

    if (scrollEl) {
      scrollEl.appendChild(renderMessageBubble(entry, true));
      trimHistory();
      scrollToBottomIfNeeded();
    }
  }

  function addEvent(payload = {}) {
    if (!isCombatFeedPhaseActive()) {
      const text = String(payload.text || "").trim();
      if (!text) return;
      deferredEvents.push(payload);
      while (deferredEvents.length > 24) deferredEvents.shift();
      return;
    }
    addEventCore(payload);
  }

  function mapBattleEntry(entry) {
    const msg = entry.message || "";
    if (!msg) return null;

    const withHint = (payload) => ({ ...payload, hint: payload.hint || msg });

    const lower = msg.toLowerCase();
    if (/победа|поражение|ничья/.test(lower)) {
      if (/победа/.test(lower)) return withHint({ type: "win", text: msg });
      if (/поражение/.test(lower)) return withHint({ type: "loss", text: msg });
      return withHint({ type: "neutral", text: msg });
    }

    const playerFocus = msg.includes("Игрок") || entry.actor === "player" || lower.includes("→ игрок");
    if (!playerFocus && entry.actor === "enemy" && entry.type === "attack") {
      if (!lower.includes("игрок")) return null;
    }

    if (/крит/i.test(msg)) return withHint({ type: "crit", text: msg, mergeKey: `crit:${entry.source || msg}` });
    if (entry.type === "heal" || /\+[\d.]+\s*hp/i.test(msg)) return withHint({ type: "heal", text: msg });
    if (/блок/i.test(msg) && /\+/.test(msg)) return withHint({ type: "block", text: msg });
    if (/яд/i.test(msg)) return withHint({ type: "poison", text: msg });
    if (/огон/i.test(msg) || /горен/i.test(msg)) return withHint({ type: "burn", text: msg });
    if (/замороз|холод|❄/i.test(msg)) return withHint({ type: "freeze", text: msg });
    if (entry.type === "debuff") return withHint({ type: "debuff", text: msg });
    if (entry.type === "buff") return withHint({ type: "buff", text: msg });
    if (entry.type === "attack" && /hp/i.test(msg)) return withHint({ type: "damage", text: msg });
    if (/синерг/i.test(msg)) return withHint({ type: "synergy", text: msg });

    if (playerFocus && entry.type !== "info") {
      return withHint({ type: "neutral", text: msg });
    }
    return null;
  }

  function ingestBattleLog(entry) {
    if (!isCombatFeedPhaseActive()) return;
    const mapped = mapBattleEntry(entry);
    if (mapped) addEventCore(mapped);
  }

  function trackSynergies(items) {
    if (!Array.isArray(items) || typeof collectActiveSynergies !== "function") return;
    const active = collectActiveSynergies(items);
    const nextKeys = new Set();
    active.forEach((syn) => {
      const key = syn.id || syn.desc || (syn.names || []).join("+");
      nextKeys.add(key);
      if (!synergySeeded) return;
      if (lastSynergyKeys.has(key)) return;
      const label = (syn.names || []).filter(Boolean).join(" + ") || syn.desc || "Синергия";
      addEvent({
        type: "synergy",
        text: `Синергия ${bracketItemName(label)}`,
        hint: syn.desc || label,
        mergeKey: `synergy:${key}`,
      });
    });
    lastSynergyKeys = nextKeys;
    synergySeeded = true;
  }

  function resetSynergyTracking() {
    lastSynergyKeys = new Set();
    synergySeeded = false;
  }

  function notifyPurchase(def) {
    if (!def) return;
    const rare = def.rarity === "legendary" || def.rarity === "godly";
    addEvent({
      type: rare ? "rare" : "purchase",
      text: `Куплено: ${itemDisplayBracket(def)}`.trim(),
      hint: itemFeedHint(def),
      mergeKey: rare ? `rare:${def.id}` : `buy:${def.id}`,
    });
  }

  function notifySell(def, refund) {
    if (!def) return;
    addEvent({
      type: "sell",
      text: `Продано: ${bracketItemName(def.name)}${refund ? ` (+${refund}💰)` : ""}`,
      hint: itemFeedHint(def),
      mergeKey: `sell:${def.id}`,
    });
  }

  function notifyItemPlaced(def) {
    if (!def) return;
    const rare = def.rarity === "legendary" || def.rarity === "godly";
    addEvent({
      type: rare ? "rare" : "item",
      text: `Размещено: ${itemDisplayBracket(def)}`.trim(),
      hint: itemFeedHint(def),
      mergeKey: `place:${def.id}`,
    });
  }

  function notifyCraft(def) {
    if (!def) return;
    addEvent({
      type: "craft",
      text: `Крафт: ${itemDisplayBracket(def)}`.trim(),
      hint: itemFeedHint(def),
      mergeKey: `craft:${def.id}`,
    });
  }

  function notifyBackpack(def) {
    if (!def) return;
    addEvent({
      type: "backpack",
      text: `Рюкзак расширен: ${bracketItemName(def.name)}`,
      hint: itemFeedHint(def),
      mergeKey: `backpack:${def.id}`,
    });
  }

  function notifyGemSocketed(gemId, hostItemId) {
    const gemDef = ITEM_CATALOG[gemId];
    const hostDef = ITEM_CATALOG[hostItemId];
    if (!gemDef || !hostDef) return;

    const effectLine = typeof describeGemSocketEffects === "function"
      ? describeGemSocketEffects(gemId, hostItemId)
      : "";
    const hint = typeof getGemSocketFeedHint === "function"
      ? getGemSocketFeedHint(gemId, hostItemId)
      : itemFeedHint(gemDef);

    addEvent({
      type: "gem",
      text: effectLine
        ? `${itemDisplayBracket(gemDef)} → ${bracketItemName(hostDef.name)}: ${effectLine}`
        : `${itemDisplayBracket(gemDef)} вставлен в ${bracketItemName(hostDef.name)}`,
      hint,
      mergeKey: `gem:${gemId}:${hostItemId}`,
    });
  }

  function syncSettingsCheckbox() {
    const cb = document.getElementById("settings-combat-feed-enabled");
    if (cb) cb.checked = enabled;
  }

  function initCombatFeed() {
    loadEnabled();

    rootEl = document.getElementById("combat-feed");
    panelEl = document.getElementById("combat-feed-panel");
    scrollEl = document.getElementById("combat-feed-scroll");
    toggleBtn = document.getElementById("combat-feed-toggle");
    toolbarBtn = document.getElementById("btn-combat-feed");
    dockEl = document.getElementById("combat-feed-dock");
    const headerEl = document.getElementById("combat-feed-header");

    if (!rootEl || !scrollEl) return;

    syncVisibility();
    syncCollapsedUi();
    syncSettingsCheckbox();

    toolbarBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!enabled) return;
      toggleCollapsed();
    });

    toggleBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCollapsed();
    });
    headerEl?.addEventListener("click", (e) => {
      if (e.target.closest("#combat-feed-toggle")) return;
      toggleCollapsed();
    });

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    bindFeedTooltipHandlers();

    const settingsCb = document.getElementById("settings-combat-feed-enabled");
    settingsCb?.addEventListener("change", (e) => {
      setEnabled(e.target.checked);
    });

    /* Архитектура для будущего drag: headerEl.dataset.draggable = "true" */
  }

  return {
    addEvent,
    ingestBattleLog,
    trackSynergies,
    resetSynergyTracking,
    notifyPurchase,
    notifySell,
    notifyItemPlaced,
    notifyCraft,
    notifyBackpack,
    notifyGemSocketed,
    hideTooltip: hideFeedHint,
    onExternalTooltipHide,
    isEnabled,
    setEnabled,
    syncCombatFeedPhase,
    init: initCombatFeed,
  };
})();

function initCombatFeedControls() {
  CombatLog.init();
}

function syncCombatFeedSettingsUi() {
  if (typeof CombatLog?.isEnabled === "function") {
    const cb = document.getElementById("settings-combat-feed-enabled");
    if (cb) cb.checked = CombatLog.isEnabled();
  }
}
