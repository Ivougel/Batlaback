/**
 * Книга рецептов — попап со всеми крафтами и описаниями предметов.
 */

function describeItemEffectLine(effect, def) {
  if (!effect) return "";
  switch (effect.type) {
    case "damage":
      return `⚔ ${formatDamageRangeText(effect, def)}${effect.damageType ? ` (${formatDamageType(effect.damageType)})` : ""}`;
    case "heal":
      return `❤ +${effect.value}`;
    case "block":
      return `🛡 ${effect.value} блок`;
    case "poison":
      return `☠ ${effect.value} яд`;
    case "slow":
      return `🐌 −${Math.round((effect.value || 0) * 100)}% скорости`;
    case "passiveDefense":
      return `🦺 +${effect.value} защита`;
    case "passiveMaxHp":
      return `❤ +${effect.value} HP`;
    case "passiveLuck":
      return `🍀 +${effect.value} удача`;
    case "statMult": {
      const pct = Math.round(Math.abs(effect.value) * 100);
      if (effect.stat === "cooldown") return `⚡ −${pct}% кулдаун`;
      if (effect.stat === "magicDamage") return `✨ +${pct}% маг. урон`;
      return `💪 +${pct}% урон`;
    }
    case "lifesteal":
      return `🩸 ${Math.round(effect.value * 100)}% вампиризм`;
    case "buffTimed":
      return `🔥 +${Math.round(effect.value * 100)}% на ${effect.duration}с`;
    case "crit":
      return `🎯 ${Math.round((effect.chance || 0) * 100)}% крит`;
    case "dodgePeriodic":
      return `💨 уклонение / ${effect.interval || 5}с`;
    case "groundFire":
      return `🔥 ${effect.value} огонь/с на поле`;
    case "repeatCast":
      return "🔮 повтор магии";
    case "shieldBreakBonus":
      return `🛡 +${Math.round((effect.value || 0) * 100)}% пробивание блока`;
    case "shieldBlockMult":
      return `🛡 +${Math.round((effect.value || 0) * 100)}% блок`;
    default:
      return effect.type;
  }
}

function renderRecipeBookItemStats(def) {
  if (!def) return "";
  const parts = [];
  (def.effects || []).forEach((effect) => {
    if (effect.trigger === "passive" && effect.type === "statMult") return;
    const line = describeItemEffectLine(effect, def);
    if (line) parts.push(line);
  });
  if (def.cooldown > 0 && itemHasActivatableEffects(def)) {
    parts.push(`⏱ ${def.cooldown}с`);
  }
  const stamina = typeof getItemStaminaCost === "function" ? getItemStaminaCost(def) : 0;
  if (stamina > 0) parts.push(`⚡ ${stamina}`);
  if (def.stats?.defense) parts.push(`🦺 ${def.stats.defense} защита`);
  return parts.join(" · ");
}

function renderRecipeBookItemCard(def, meta = "") {
  if (!def) return "";
  const rarityClass = `rarity-${def.rarity || "common"}`;
  const stats = renderRecipeBookItemStats(def);
  const tags = def.tags?.length ? formatTagsList(def.tags) : "";
  const source = def.craftOnly
    ? "Только крафт"
    : (def.cost > 0 ? `${def.cost}💰 в магазине` : "Стартовый");
  return `
    <article class="recipe-book-item ${rarityClass}" data-item-id="${def.id}">
      <div class="recipe-book-item-head">
        <span class="recipe-book-item-icon">${def.icon}</span>
        <div class="recipe-book-item-title">
          <h4 style="color:${getRarityNameColor(def.rarity)}">${def.name}</h4>
          <span class="recipe-book-item-meta">${source}${meta ? ` · ${meta}` : ""}</span>
        </div>
      </div>
      ${stats ? `<p class="recipe-book-item-stats">${stats}</p>` : ""}
      ${tags ? `<p class="recipe-book-item-tags">${tags}</p>` : ""}
      ${getUniqueItemSynergies(def).map((s) => {
        const desc = typeof formatSynergyHumanDesc === "function"
          ? formatSynergyHumanDesc(s)
          : (typeof localizeSynergyDesc === "function" ? localizeSynergyDesc(s.desc) : (s.desc || ""));
        const html = typeof formatTooltipMechanicText === "function"
          ? formatTooltipMechanicText(desc)
          : desc;
        return `<p class="recipe-book-item-synergy">${html}</p>`;
      }).join("")}
    </article>
  `;
}

function renderRecipeBookRecipesSection() {
  const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame() : {};
  const recipes = typeof getVisibleCraftRecipes === "function"
    ? getVisibleCraftRecipes(ctx)
    : getAllCraftRecipes();
  const rows = recipes.map((recipe) => {
    const out = ITEM_CATALOG[recipe.output];
    return `
      <div class="recipe-book-recipe">
        <div class="recipe-book-formula">
          <span class="recipe-book-inputs">${formatRecipeInputs(recipe)}</span>
          <span class="recipe-book-arrow" aria-hidden="true">→</span>
          <span class="recipe-book-output">${out ? `${out.icon} ${out.name}` : recipe.output}</span>
        </div>
        <p class="recipe-book-recipe-hint">Сложите все части вплотную — ребро к ребру. Слияние в начале следующего раунда подготовки${recipe.hint ? ` · ${recipe.hint}` : ""}</p>
      </div>
    `;
  }).join("");

  return `
    <section class="recipe-book-section">
      <h3 class="recipe-book-section-title">⚗️ Рецепты (${recipes.length})</h3>
      <div class="recipe-book-recipes">${rows}</div>
    </section>
  `;
}

function renderRecipeBookOutputsSection() {
  const ids = getCraftOutputItemIds();
  const cards = ids.map((id) => renderRecipeBookItemCard(ITEM_CATALOG[id])).join("");
  return `
    <section class="recipe-book-section">
      <h3 class="recipe-book-section-title">✨ Крафтовые предметы</h3>
      <p class="recipe-book-section-desc">Не продаются в магазине — только через рецепты.</p>
      <div class="recipe-book-items">${cards}</div>
    </section>
  `;
}

function renderRecipeBookIngredientsSection() {
  const outputIds = new Set(getCraftOutputItemIds());
  const ids = getCraftIngredientItemIds().filter((id) => {
    const def = ITEM_CATALOG[id];
    return def && !def.craftOnly && !outputIds.has(id);
  });
  const craftTagIds = Object.values(ITEM_CATALOG)
    .filter((def) => def.tags?.includes("craft") && !ids.includes(def.id))
    .map((def) => def.id);
  const allIds = [...new Set([...ids, ...craftTagIds])];

  const cards = allIds.map((id) => {
    const def = ITEM_CATALOG[id];
    const usedIn = getRecipesUsingIngredient(id).length;
    return renderRecipeBookItemCard(def, usedIn ? `${usedIn} рец.` : "");
  }).join("");

  return `
    <section class="recipe-book-section">
      <h3 class="recipe-book-section-title">🧪 Ингредиенты</h3>
      <p class="recipe-book-section-desc">Покупайте в магазине и комбинируйте на столе.</p>
      <div class="recipe-book-items">${cards}</div>
    </section>
  `;
}

function renderRecipeBookBody() {
  return [
    renderRecipeBookRecipesSection(),
    renderRecipeBookOutputsSection(),
    renderRecipeBookIngredientsSection(),
  ].join("");
}

function showRecipeBookPopup() {
  const overlay = document.getElementById("recipe-book-overlay");
  const body = document.getElementById("recipe-book-body");
  if (!overlay || !body) return;
  body.innerHTML = renderRecipeBookBody();
  body.querySelectorAll(".recipe-book-item[data-item-id]").forEach((card) => {
    bindItemTooltipEvents(card, card.dataset.itemId, null, "field");
  });
  overlay.classList.remove("hidden");
  document.body.classList.add("recipe-book-open");
  if (typeof playPrepCommerceSfx === "function") playPrepCommerceSfx("recipe", "open");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function hideRecipeBookPopup() {
  hideSidebarTooltip();
  const wasOpen = isRecipeBookOpen();
  document.getElementById("recipe-book-overlay")?.classList.add("hidden");
  document.body.classList.remove("recipe-book-open");
  if (wasOpen && typeof playPrepCommerceSfx === "function") playPrepCommerceSfx("recipe", "close");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function toggleRecipeBookPopup() {
  if (isRecipeBookOpen()) hideRecipeBookPopup();
  else showRecipeBookPopup();
}

function isRecipeBookOpen() {
  return isPopupOpen("recipe-book-overlay");
}

function initRecipeBookControls() {
  document.getElementById("btn-recipe-book")?.addEventListener("click", (e) => {
    e.stopPropagation();
    showRecipeBookPopup();
  });
  document.getElementById("btn-recipe-book-close")?.addEventListener("click", hideRecipeBookPopup);
  document.getElementById("recipe-book-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "recipe-book-overlay") hideRecipeBookPopup();
  });
}
