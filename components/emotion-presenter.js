/**
 * EmotionPresenter — отображение «боевых эмоджи» (мысли героя из EmotionEngine).
 * EmotionEngine решает *что* показать; presenter решает *как* (layout + DOM).
 *
 * Расширение: EmotionPresenter.registerLayout(name, { present, clear, matches? })
 */

const EmotionPresenter = (() => {
  const LAYOUT = {
    ARENA: "arena",
    FLOAT: "float",
  };

  function usesBattleThoughtArena() {
    return document.documentElement.dataset.battleArenaLayout === "true";
  }

  /** @type {Record<string, { present(side: string, event: object): void, clear(side: string): void, matches?(): boolean }>} */
  const layouts = {
    [LAYOUT.ARENA]: {
      matches: usesBattleThoughtArena,
      present: presentArenaThought,
      clear: clearArenaThought,
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

  function presentArenaThought(side, event) {
    if (typeof ThoughtArena === "undefined") return;
    const key = `${event.emoji}|${event.animation || ""}`;
    if (lastKey[side] === key) return;
    lastKey[side] = key;
    ThoughtArena.upsert(side, event);
  }

  function clearArenaThought(side) {
    if (typeof ThoughtArena !== "undefined") {
      ThoughtArena.remove(side);
    }
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
    if (typeof ThoughtArena !== "undefined") {
      ThoughtArena.clearAll();
    }
    lastKey.player = null;
    lastKey.enemy = null;
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
    getThoughtSlotEl: () => document.getElementById("battle-thought-arena"),
  };
})();
