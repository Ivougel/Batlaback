/**
 * DialogueOverlay — текстовые пузыри-«сообщения» между героями поверх всего UI.
 * Анимация полёта — WAAPI (без rAF-цикла); fade — CSS transition.
 */

const DialogueOverlay = (() => {
  const MAX_VISIBLE = 3;
  const DEFAULT_TTL_MS = 6000;
  const TRAVEL_MS = 680;
  const EXIT_MS = 280;

  /** @type {Array<object>} */
  let bubbles = [];
  let layerEl = null;

  function isLiteFx() {
    return typeof BattleFxTier !== "undefined" && BattleFxTier.prepFxReduced?.();
  }

  function ensureLayer() {
    if (layerEl?.isConnected) return layerEl;
    layerEl = document.getElementById("hero-dialogue-layer");
    if (!layerEl) {
      layerEl = document.createElement("div");
      layerEl.id = "hero-dialogue-layer";
      layerEl.className = "hero-dialogue-layer";
      layerEl.setAttribute("aria-live", "polite");
      layerEl.setAttribute("aria-label", "Диалоги героев");
      document.body.appendChild(layerEl);
    }
    return layerEl;
  }

  function getFighterAnchorRect(fighterId) {
    if (fighterId === "player" || fighterId === 0) {
      const el = document.getElementById("prep-character-player");
      if (el && !el.hasAttribute("hidden")) return el.getBoundingClientRect();
    }
    if (fighterId === "enemy" || fighterId === 1) {
      const el = document.getElementById("prep-character-enemy");
      if (el && !el.hasAttribute("hidden")) return el.getBoundingClientRect();
    }
    return null;
  }

  function fallbackAnchor(side = "left") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const y = Math.max(72, vh * 0.12);
    const x = side === "right" ? vw * 0.72 : vw * 0.28;
    return { left: x, top: y, width: 40, height: 40, right: x + 40, bottom: y + 40 };
  }

  function centerOf(rect) {
    if (!rect) return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.16 };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function transformAt(x, y) {
    return `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
  }

  function buildBubbleEl(payload) {
    const el = document.createElement("div");
    const emojiOnly = !!payload.emojiOnly
      || (typeof isDialogueEmojiOnly === "function" && isDialogueEmojiOnly(payload.text));
    el.className = "hero-dialogue-bubble";
    el.dataset.classId = payload.classId || "";
    if (payload.reply) el.classList.add("hero-dialogue-bubble--reply");
    if (payload.human) el.classList.add("hero-dialogue-bubble--human");
    if (emojiOnly) el.classList.add("hero-dialogue-bubble--emoji-only");

    const head = document.createElement("div");
    head.className = "hero-dialogue-bubble__head";
    if (!emojiOnly) {
      head.innerHTML = `<span class="hero-dialogue-bubble__name">${escapeHtml(payload.speakerName || "Герой")}</span>`;
      el.appendChild(head);
    }

    const body = document.createElement("div");
    body.className = "hero-dialogue-bubble__text";
    body.textContent = payload.text || "";

    el.appendChild(body);
    return el;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function disposeBubble(bubble) {
    if (!bubble) return;
    if (bubble.removeTimer != null) window.clearTimeout(bubble.removeTimer);
    if (bubble.exitTimer != null) window.clearTimeout(bubble.exitTimer);
    bubble.travelAnim?.cancel?.();
    bubble.el?.remove();
  }

  function trimOverflow() {
    while (bubbles.length > MAX_VISIBLE) {
      disposeBubble(bubbles.shift());
    }
  }

  function resolveTravelMs(payload) {
    if (isLiteFx()) return 0;
    return payload.travelMs ?? TRAVEL_MS;
  }

  function scheduleRemoval(bubble) {
    bubble.removeTimer = window.setTimeout(() => {
      bubble.el?.classList.add("hero-dialogue-bubble--out");
      bubble.exitTimer = window.setTimeout(() => {
        disposeBubble(bubble);
        bubbles = bubbles.filter((b) => b !== bubble);
      }, EXIT_MS);
    }, bubble.ttlMs);
  }

  function runTravelAnim(el, from, settle, travelMs) {
    el.style.transform = transformAt(from.x, from.y);
    const midX = from.x + (settle.x - from.x) * 0.5;
    const midY = from.y + (settle.y - from.y) * 0.5 - 22;
    const anim = el.animate([
      { transform: transformAt(from.x, from.y), offset: 0 },
      { transform: transformAt(midX, midY), offset: 0.5 },
      { transform: transformAt(settle.x, settle.y), offset: 1 },
    ], {
      duration: travelMs,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    });
    anim.onfinish = () => {
      el.style.transform = transformAt(settle.x, settle.y);
    };
    return anim;
  }

  function spawnBubble(payload) {
    ensureLayer();
    const fromRect = getFighterAnchorRect(payload.fromId) || fallbackAnchor("left");
    const toRect = payload.toId != null
      ? (getFighterAnchorRect(payload.toId) || fallbackAnchor("right"))
      : fromRect;

    const from = centerOf(fromRect);
    const to = centerOf(toRect);
    const settle = payload.toId != null
      ? { x: from.x + (to.x - from.x) * 0.62, y: Math.min(from.y, to.y) - 18 }
      : { x: from.x, y: from.y - 28 };

    const el = buildBubbleEl(payload);
    layerEl.appendChild(el);

    const travelMs = resolveTravelMs(payload);
    const bubble = {
      el,
      ttlMs: payload.ttlMs ?? DEFAULT_TTL_MS,
      travelAnim: null,
      removeTimer: null,
      exitTimer: null,
    };
    bubbles.push(bubble);
    trimOverflow();

    if (travelMs <= 0) {
      el.style.transform = transformAt(settle.x, settle.y);
    } else {
      bubble.travelAnim = runTravelAnim(el, from, settle, travelMs);
    }

    requestAnimationFrame(() => el.classList.add("hero-dialogue-bubble--visible"));
    scheduleRemoval(bubble);
    return bubble;
  }

  function showMessage(payload) {
    return spawnBubble(payload);
  }

  function showExchange(from, to, lineText, opts = {}) {
    const emojiOnly = opts.emojiOnly
      ?? (typeof isDialogueEmojiOnly === "function" && isDialogueEmojiOnly(lineText));
    return spawnBubble({
      fromId: from.id,
      toId: to?.id ?? null,
      classId: from.classId,
      speakerName: from.name,
      text: lineText,
      human: !!from.isHuman,
      emojiOnly,
      ttlMs: opts.ttlMs ?? (emojiOnly ? 4200 : DEFAULT_TTL_MS),
    });
  }

  function showReply(from, to, lineText, opts = {}) {
    const emojiOnly = opts.emojiOnly
      ?? (typeof isDialogueEmojiOnly === "function" && isDialogueEmojiOnly(lineText));
    return spawnBubble({
      fromId: from.id,
      toId: to?.id ?? null,
      classId: from.classId,
      speakerName: from.name,
      text: lineText,
      human: !!from.isHuman,
      reply: true,
      emojiOnly,
      travelMs: opts.travelMs ?? TRAVEL_MS * 0.85,
      ttlMs: opts.ttlMs ?? (emojiOnly ? 4000 : DEFAULT_TTL_MS),
    });
  }

  function clearAll() {
    bubbles.forEach(disposeBubble);
    bubbles = [];
  }

  function setVisible(show) {
    ensureLayer().classList.toggle("hero-dialogue-layer--hidden", !show);
  }

  return {
    showMessage,
    showExchange,
    showReply,
    clearAll,
    setVisible,
    getFighterAnchorRect,
  };
})();

window.DialogueOverlay = DialogueOverlay;
