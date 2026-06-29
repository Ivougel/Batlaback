/**
 * EmotionPresenter — отображение «боевых эмоджи» (мысли героя из EmotionEngine).
 * EmotionEngine решает *что* показать; presenter решает *как* (layout + DOM).
 *
 * Расширение: EmotionPresenter.registerLayout(name, { present, clear, matches? })
 */

const EmotionPresenter = (() => {
  const LAYOUT = {
    PARKED: "parked",
    FLOAT: "float",
  };

  /** @type {Record<string, { present(side: string, event: object): void, clear(side: string): void, matches?(): boolean }>} */
  const layouts = {
    [LAYOUT.PARKED]: {
      matches() {
        const root = document.documentElement;
        return root.dataset.prepLayout === "mobile" && root.dataset.orientation !== "landscape";
      },
      present: presentParkedThought,
      clear: clearParkedThought,
    },
    [LAYOUT.FLOAT]: {
      matches() {
        return true;
      },
      present: presentFloatThought,
      clear: clearFloatThought,
    },
  };

  const lastKey = { player: null, enemy: null };
  const parkedBubble = { player: null, enemy: null };

  function resolveLayoutName() {
    for (const [name, strategy] of Object.entries(layouts)) {
      if (name === LAYOUT.FLOAT) continue;
      if (strategy.matches?.()) return name;
    }
    return LAYOUT.FLOAT;
  }

  function getLayoutStrategy(name = resolveLayoutName()) {
    return layouts[name] || layouts[LAYOUT.FLOAT];
  }

  function thoughtEventKey(event) {
    if (!event) return "";
    return `${event.side}|${event.startedAt}|${event.emoji}|${event.animation || ""}`;
  }

  function getThoughtSlotEl(side) {
    const id = side === "player" ? "player-thought-slot" : "enemy-thought-slot";
    return document.getElementById(id);
  }

  function applyThoughtAnimation(el, animation) {
    const anim = animation || "shake";
    el.dataset.animation = anim;
    el.className = `battle-thought-bubble battle-thought--${anim}`;
    el.classList.remove("battle-thought--active");
    void el.offsetWidth;
    el.classList.add("battle-thought--active");
  }

  function presentParkedThought(side, event) {
    const slot = getThoughtSlotEl(side);
    if (!slot) return;
    const emoji = String(event.emoji || "");
    const key = thoughtEventKey(event);
    if (lastKey[side] === key && parkedBubble[side]?.isConnected) return;

    let bubble = parkedBubble[side];
    if (!bubble || bubble.parentElement !== slot) {
      slot.innerHTML = "";
      bubble = document.createElement("div");
      bubble.className = "battle-thought-bubble";
      bubble.setAttribute("role", "img");
      slot.appendChild(bubble);
      parkedBubble[side] = bubble;
    }

    bubble.textContent = emoji;
    if (event.replyTo) bubble.dataset.replyTo = event.replyTo;
    else bubble.removeAttribute("data-reply-to");
    applyThoughtAnimation(bubble, event.animation);
    lastKey[side] = key;
  }

  function clearParkedThought(side) {
    const slot = getThoughtSlotEl(side);
    if (slot) slot.innerHTML = "";
    parkedBubble[side] = null;
    lastKey[side] = null;
  }

  function presentFloatThought(side, event) {
    const emoji = String(event.emoji || "");
    if (lastKey[side] === emoji) return;
    lastKey[side] = emoji;

    const slotId = side === "player" ? "player-avatar-slot" : "enemy-avatar-slot";
    const anchor = document.querySelector(`#${slotId} .profile-avatar`);
    if (typeof floatLayer !== "undefined" && floatLayer.spawnEmotion) {
      floatLayer.spawnEmotion(emoji, anchor);
    }
  }

  function clearFloatThought(side) {
    lastKey[side] = null;
  }

  function presentThought(side, event) {
    if (!event?.emoji) {
      clearThought(side);
      return;
    }
    getLayoutStrategy().present(side, event);
  }

  function clearThought(side) {
    getLayoutStrategy().clear(side);
  }

  function clearAllThoughts() {
    clearParkedThought("player");
    clearParkedThought("enemy");
    clearFloatThought("player");
    clearFloatThought("enemy");
    document.getElementById("battle-emotion-layer")?.remove();
  }

  function registerLayout(name, strategy) {
    if (!name || !strategy?.present || !strategy?.clear) return;
    layouts[name] = strategy;
  }

  return {
    LAYOUT,
    resolveLayoutName,
    getLayoutStrategy,
    presentThought,
    clearThought,
    clearAllThoughts,
    registerLayout,
    getThoughtSlotEl,
  };
})();
