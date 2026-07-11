/**
 * BB Item Wiki — справочник предметов для режима classic.
 * Вкладки: предметы, рецепты, механики (⭐/◆).
 */

const BBItemWiki = (() => {
  const WIKI_TAGS = [
    "weapon", "armor", "shield", "magic", "food", "potion", "pet", "poison", "holy", "fire",
  ];
  const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, godly: 5 };

  let activeTab = "items";
  let searchQuery = "";
  let rarityFilter = "all";
  let tagFilter = "all";
  let bound = false;

  function shouldShowBBItemWiki() {
    if (typeof isClassicGameMode === "function" && typeof selectedGameMode !== "undefined") {
      if (isClassicGameMode(selectedGameMode)) return true;
    }
    if (typeof gameMode !== "undefined" && typeof isClassicGameMode === "function" && isClassicGameMode(gameMode)) {
      return true;
    }
    return typeof isBBFidelityClassic === "function" && isBBFidelityClassic();
  }

  function getWikiHeroClass() {
    if (typeof pendingPlayerClass !== "undefined" && pendingPlayerClass) return pendingPlayerClass;
    if (typeof playerClass !== "undefined" && playerClass) return playerClass;
    return null;
  }

  function getWikiItemIds() {
    return Object.values(ITEM_CATALOG || {})
      .filter((def) => def && !def.isContainer && def.id !== "starter_bag")
      .sort((a, b) => {
        const dr = (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0);
        if (dr !== 0) return dr;
        return (a.name || a.id).localeCompare(b.name || b.id, "ru");
      })
      .map((def) => def.id);
  }

  function itemMatchesFilters(def) {
    if (!def) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const hay = [
        def.name,
        def.id,
        def.description,
        ...(def.tags || []),
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (rarityFilter !== "all" && def.rarity !== rarityFilter) return false;
    if (tagFilter !== "all" && !(def.tags || []).includes(tagFilter)) return false;
    return true;
  }

  function renderWikiItemCard(def) {
    if (!def) return "";
    const heroClass = getWikiHeroClass();
    const presentation = typeof getItemPresentationState === "function"
      ? getItemPresentationState(def.id, heroClass)
      : null;
    const lockedClass = presentation?.locked ? " bb-item-wiki-item--locked" : "";
    const rarityClass = `rarity-${def.rarity || "common"}`;
    const stats = presentation?.showStats === false
      ? ""
      : (typeof renderRecipeBookItemStats === "function" ? renderRecipeBookItemStats(def) : "");
    const tags = def.tags?.length && typeof formatTagsList === "function"
      ? formatTagsList(def.tags)
      : "";
    const slotLines = typeof getItemWikiSynergyLines === "function"
      ? getItemWikiSynergyLines(def)
      : [];
    const source = def.craftOnly
      ? "Только крафт"
      : (def.cost > 0 ? `${def.cost}💰` : "Стартовый");
    const meta = presentation?.locked
      ? presentation.hint
      : `${source} · ${def.rarity || "common"}`;

    return `
      <article class="bb-item-wiki-item recipe-book-item ${rarityClass}${lockedClass}" data-item-id="${def.id}">
        <div class="bb-item-wiki-item-head recipe-book-item-head">
          <span class="bb-item-wiki-item-icon recipe-book-item-icon">${presentation?.locked ? "🔒" : def.icon}</span>
          <div class="bb-item-wiki-item-title recipe-book-item-title">
            <h4 style="color:${presentation?.locked ? "#8b949e" : getRarityNameColor(def.rarity)}">${def.name}</h4>
            <span class="bb-item-wiki-item-meta recipe-book-item-meta">${meta}</span>
          </div>
        </div>
        ${def.description ? `<p class="bb-item-wiki-item-desc">${def.description}</p>` : ""}
        ${stats ? `<p class="bb-item-wiki-item-stats recipe-book-item-stats">${stats}</p>` : ""}
        ${tags ? `<p class="bb-item-wiki-item-tags recipe-book-item-tags">${tags}</p>` : ""}
        ${slotLines.map((line) => `<p class="bb-item-wiki-item-slot recipe-book-item-synergy">${line}</p>`).join("")}
      </article>
    `;
  }

  function renderItemsPanel() {
    const ids = getWikiItemIds().filter((id) => itemMatchesFilters(ITEM_CATALOG[id]));
    if (!ids.length) {
      return '<p class="bb-item-wiki-empty">Ничего не найдено — измените фильтр или запрос.</p>';
    }
    const cards = ids.map((id) => renderWikiItemCard(ITEM_CATALOG[id])).join("");
    return `<div class="bb-item-wiki-items-grid">${cards}</div>`;
  }

  function renderRecipesPanel() {
    if (typeof renderRecipeBookBody === "function") {
      return renderRecipeBookBody();
    }
    return '<p class="bb-item-wiki-empty">Рецепты недоступны.</p>';
  }

  function renderMechanicsPanel() {
    return `
      <div class="bb-item-wiki-mechanics">
        <section>
          <h3>⭐ Звёздные слоты</h3>
          <p>Многие предметы имеют ⭐ на соседних клетках. Положите подходящий предмет в клетку звезды — бонус активируется.</p>
          <ul>
            <li>Каждая ⭐ привязана к <strong>конкретной клетке</strong> — поворачивайте предметы для совмещения.</li>
            <li>Один предмет-гость занимает <strong>только одну</strong> ⭐.</li>
            <li>Если несколько ⭐ накрывают одну клетку — срабатывает только одна.</li>
          </ul>
        </section>
        <section>
          <h3>◆ Ромбовые слоты</h3>
          <p>◆ работают как ⭐, но у предмета два разных эффекта размещения — каждый тип слота отмечен своим символом.</p>
        </section>
        <section>
          <h3>⚗️ Крафт</h3>
          <p>Сложите ингредиенты <strong>вплотную</strong> на столе. Слияние происходит в начале следующего раунда подготовки. Смотрите вкладку «Рецепты».</p>
        </section>
        <section>
          <h3>🔓 Прогресс предметов</h3>
          <p>В классике предметы открываются по мере забегов. Закрытые позиции в справочнике помечены 🔒 — эффекты видны после разблокировки.</p>
        </section>
      </div>
    `;
  }

  function renderToolbar() {
    const ids = getWikiItemIds();
    const visible = ids.filter((id) => itemMatchesFilters(ITEM_CATALOG[id])).length;
    const tagButtons = [
      `<button type="button" class="bb-item-wiki-tag${tagFilter === "all" ? " is-active" : ""}" data-wiki-tag="all">Все теги</button>`,
      ...WIKI_TAGS.map((tag) => {
        const label = typeof formatTagLabel === "function" ? formatTagLabel(tag) : tag;
        return `<button type="button" class="bb-item-wiki-tag${tagFilter === tag ? " is-active" : ""}" data-wiki-tag="${tag}">${label}</button>`;
      }),
    ].join("");

    return `
      <div class="bb-item-wiki-toolbar" data-wiki-panel="items">
        <input type="search" class="bb-item-wiki-search" id="bb-item-wiki-search" placeholder="Поиск по названию, тегу…" value="${searchQuery.replace(/"/g, "&quot;")}" autocomplete="off">
        <select class="bb-item-wiki-filter" id="bb-item-wiki-rarity" aria-label="Редкость">
          <option value="all"${rarityFilter === "all" ? " selected" : ""}>Все редкости</option>
          <option value="common"${rarityFilter === "common" ? " selected" : ""}>Common</option>
          <option value="uncommon"${rarityFilter === "uncommon" ? " selected" : ""}>Uncommon</option>
          <option value="rare"${rarityFilter === "rare" ? " selected" : ""}>Rare</option>
          <option value="epic"${rarityFilter === "epic" ? " selected" : ""}>Epic</option>
          <option value="legendary"${rarityFilter === "legendary" ? " selected" : ""}>Legendary</option>
          <option value="godly"${rarityFilter === "godly" ? " selected" : ""}>Godly</option>
        </select>
        <span class="bb-item-wiki-count">${visible} / ${ids.length}</span>
      </div>
      <div class="bb-item-wiki-tagbar" data-wiki-panel="items">${tagButtons}</div>
    `;
  }

  function renderBody() {
    const toolbar = activeTab === "items" ? renderToolbar() : "";
    return `
      ${toolbar}
      <div class="bb-item-wiki-panel" data-wiki-panel="items"${activeTab !== "items" ? " hidden" : ""}>${renderItemsPanel()}</div>
      <div class="bb-item-wiki-panel" data-wiki-panel="recipes"${activeTab !== "recipes" ? " hidden" : ""}>${renderRecipesPanel()}</div>
      <div class="bb-item-wiki-panel" data-wiki-panel="mechanics"${activeTab !== "mechanics" ? " hidden" : ""}>${renderMechanicsPanel()}</div>
    `;
  }

  function bindItemTooltips(root) {
    root.querySelectorAll("[data-item-id]").forEach((card) => {
      if (typeof bindItemTooltipEvents === "function") {
        bindItemTooltipEvents(card, card.dataset.itemId, null, "field");
      }
    });
  }

  function refreshBody() {
    const body = document.getElementById("bb-item-wiki-body");
    const filters = document.getElementById("bb-item-wiki-filters");
    if (!body) return;

    if (activeTab === "items" && filters) {
      filters.innerHTML = renderToolbar();
      bindFilterControls(filters);
      body.innerHTML = `<div class="bb-item-wiki-panel" data-wiki-panel="items">${renderItemsPanel()}</div>`;
    } else {
      if (filters) filters.innerHTML = "";
      body.innerHTML = renderBody().replace(/^[\s\S]*?<div class="bb-item-wiki-panel"/, "<div class=\"bb-item-wiki-panel\"");
      if (activeTab !== "items") {
        body.innerHTML = activeTab === "recipes"
          ? renderRecipesPanel()
          : renderMechanicsPanel();
      }
    }
    bindItemTooltips(body);
    syncTabButtons();
  }

  function fullRender() {
    const filters = document.getElementById("bb-item-wiki-filters");
    const body = document.getElementById("bb-item-wiki-body");
    if (!body) return;
    if (filters) {
      filters.innerHTML = activeTab === "items" ? renderToolbar() : "";
      if (activeTab === "items") bindFilterControls(filters);
    }
    body.innerHTML = activeTab === "items"
      ? renderItemsPanel()
      : (activeTab === "recipes" ? renderRecipesPanel() : renderMechanicsPanel());
    bindItemTooltips(body);
    syncTabButtons();
  }

  function bindFilterControls(root) {
    root.querySelector(".bb-item-wiki-search")?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      refreshItemsOnly();
    });
    root.querySelector("#bb-item-wiki-rarity")?.addEventListener("change", (e) => {
      rarityFilter = e.target.value;
      refreshItemsOnly();
    });
    root.querySelectorAll("[data-wiki-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tagFilter = btn.dataset.wikiTag || "all";
        fullRender();
      });
    });
  }

  function refreshItemsOnly() {
    const body = document.getElementById("bb-item-wiki-body");
    const filters = document.getElementById("bb-item-wiki-filters");
    if (!body || activeTab !== "items") return;
    if (filters) {
      const countEl = filters.querySelector(".bb-item-wiki-count");
      if (countEl) {
        const ids = getWikiItemIds().filter((id) => itemMatchesFilters(ITEM_CATALOG[id]));
        countEl.textContent = `${ids.length} / ${getWikiItemIds().length}`;
      }
    }
    body.innerHTML = renderItemsPanel();
    bindItemTooltips(body);
    filters?.querySelectorAll("[data-wiki-tag]").forEach((btn) => {
      btn.classList.toggle("is-active", (btn.dataset.wikiTag || "all") === tagFilter);
    });
  }

  function syncTabButtons() {
    document.querySelectorAll(".bb-item-wiki-tab").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.wikiTab === activeTab);
    });
    const toolbar = document.getElementById("bb-item-wiki-filters");
    if (toolbar) {
      toolbar.style.display = activeTab === "items" ? "" : "none";
    }
  }

  function setTab(tab) {
    activeTab = tab;
    fullRender();
  }

  function showBBItemWiki(options = {}) {
    if (!shouldShowBBItemWiki()) return;
    const overlay = document.getElementById("bb-item-wiki-overlay");
    if (!overlay) return;
    if (options.tab) activeTab = options.tab;
    fullRender();
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("bb-item-wiki-open");
    if (typeof playGameSfx === "function") playGameSfx("ui_open");
    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
    requestAnimationFrame(() => {
      document.getElementById("bb-item-wiki-search")?.focus({ preventScroll: true });
    });
  }

  function hideBBItemWiki(options = {}) {
    const overlay = document.getElementById("bb-item-wiki-overlay");
    if (!overlay || overlay.classList.contains("hidden")) return;
    if (typeof hideSidebarTooltip === "function") hideSidebarTooltip();
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("bb-item-wiki-open");
    if (options.sfx !== false && typeof playGameSfx === "function") playGameSfx("ui_close");
    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  }

  function toggleBBItemWiki(options = {}) {
    if (isBBItemWikiOpen()) hideBBItemWiki();
    else showBBItemWiki(options);
  }

  function isBBItemWikiOpen() {
    return typeof isPopupOpen === "function" && isPopupOpen("bb-item-wiki-overlay");
  }

  function syncIntroHeaderWikiButton() {
    const btn = document.getElementById("btn-bb-intro-header-wiki");
    if (!btn) return;
    const overlay = document.getElementById("class-overlay");
    const modeStep = document.getElementById("class-step-mode");
    const overlayOpen = overlay && !overlay.classList.contains("hidden");
    const onMode = modeStep && !modeStep.classList.contains("hidden");
    const show = shouldShowBBItemWiki() && overlayOpen && onMode;
    btn.classList.toggle("hidden", !show);
    btn.toggleAttribute("hidden", !show);
  }

  function syncClassicWikiEntry() {
    const entry = document.getElementById("bb-classic-wiki-entry");
    if (!entry) return;
    const modeStep = document.getElementById("class-step-mode");
    const onMode = modeStep && !modeStep.classList.contains("hidden");
    const classicSelected = typeof selectedGameMode !== "undefined"
      && typeof isClassicGameMode === "function"
      && isClassicGameMode(selectedGameMode);
    const show = onMode && classicSelected;
    entry.classList.toggle("hidden", !show);
    entry.toggleAttribute("hidden", !show);
    syncIntroHeaderWikiButton();
  }

  function syncPrepWikiButton() {
    const btn = document.getElementById("btn-bb-item-wiki");
    if (!btn) return;
    const show = shouldShowBBItemWiki()
      && typeof phase !== "undefined"
      && phase === "prep";
    btn.classList.toggle("hidden", !show);
    btn.toggleAttribute("hidden", !show);
  }

  function bindControls() {
    if (bound) return;
    bound = true;

    document.getElementById("btn-bb-item-wiki-close")?.addEventListener("click", () => hideBBItemWiki());
    document.getElementById("bb-item-wiki-overlay")?.addEventListener("click", (e) => {
      if (e.target.id === "bb-item-wiki-overlay") hideBBItemWiki();
    });
    document.querySelectorAll(".bb-item-wiki-tab").forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.dataset.wikiTab || "items"));
    });
    document.getElementById("btn-bb-classic-wiki-intro")?.addEventListener("click", (e) => {
      e.stopPropagation();
      showBBItemWiki({ tab: "items" });
    });
    document.getElementById("btn-bb-intro-header-wiki")?.addEventListener("click", (e) => {
      e.stopPropagation();
      showBBItemWiki({ tab: "items" });
    });
    document.getElementById("btn-bb-item-wiki")?.addEventListener("click", (e) => {
      e.stopPropagation();
      showBBItemWiki({ tab: "items" });
    });
    document.getElementById("btn-escape-wiki")?.addEventListener("click", () => {
      hideEscapeMenu({ sfx: false });
      showBBItemWiki({ tab: "items" });
    });
  }

  function initBBItemWikiControls() {
    bindControls();
    syncClassicWikiEntry();
    syncIntroHeaderWikiButton();
    syncPrepWikiButton();
  }

  return {
    initBBItemWikiControls,
    showBBItemWiki,
    hideBBItemWiki,
    toggleBBItemWiki,
    isBBItemWikiOpen,
    shouldShowBBItemWiki,
    syncClassicWikiEntry,
    syncIntroHeaderWikiButton,
    syncPrepWikiButton,
  };
})();

function initBBItemWikiControls() {
  BBItemWiki.initBBItemWikiControls();
}

function showBBItemWiki(options) {
  BBItemWiki.showBBItemWiki(options);
}

function hideBBItemWiki(options) {
  BBItemWiki.hideBBItemWiki(options);
}

function toggleBBItemWiki(options) {
  BBItemWiki.toggleBBItemWiki(options);
}

function isBBItemWikiOpen() {
  return BBItemWiki.isBBItemWikiOpen();
}

function syncClassicWikiEntry() {
  BBItemWiki.syncClassicWikiEntry();
}

function syncIntroHeaderWikiButton() {
  BBItemWiki.syncIntroHeaderWikiButton();
}

function syncPrepWikiButton() {
  BBItemWiki.syncPrepWikiButton();
}

function shouldShowBBItemWiki() {
  return BBItemWiki.shouldShowBBItemWiki();
}

if (typeof window !== "undefined") {
  window.BBItemWiki = BBItemWiki;
  window.shouldShowBBItemWiki = shouldShowBBItemWiki;
  window.initBBItemWikiControls = initBBItemWikiControls;
  window.showBBItemWiki = showBBItemWiki;
  window.hideBBItemWiki = hideBBItemWiki;
  window.toggleBBItemWiki = toggleBBItemWiki;
  window.isBBItemWikiOpen = isBBItemWikiOpen;
  window.syncClassicWikiEntry = syncClassicWikiEntry;
  window.syncIntroHeaderWikiButton = syncIntroHeaderWikiButton;
  window.syncPrepWikiButton = syncPrepWikiButton;
}
