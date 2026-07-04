/**
 * DialogueOverlay — текстовые пузыри-«сообщения» между героями поверх всего UI.
 */

const DialogueOverlay = (() => {
  const MAX_VISIBLE = 3;
  const DEFAULT_TTL_MS = 6000;
  const TRAVEL_MS = 680;
  const TICK_MIN_MS = 48;

  /** @type {Array<object>} */
  let bubbles = [];
  let layerEl = null;
  let rafId = null;
  let lastTs = 0;

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
    const chip = document.querySelector(`[data-lobby-fighter-avatar="${fighterId}"]`)
      || document.querySelector(`[data-lobby-fighter="${fighterId}"] .lobby-prep-field-chip-avatar`)
      || document.querySelector(`[data-lobby-fighter-card="${fighterId}"] .lobby-fighter-card-avatar`);
    if (chip) return chip.getBoundingClientRect();

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

  function trimOverflow() {
    while (bubbles.length > MAX_VISIBLE) {
      const old = bubbles.shift();
      old?.el?.remove();
    }
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

    const bubble = {
      el,
      bornAt: performance.now(),
      travelMs: payload.travelMs ?? TRAVEL_MS,
      ttlMs: payload.ttlMs ?? DEFAULT_TTL_MS,
      from,
      to: settle,
      phase: "travel",
    };
    bubbles.push(bubble);
    trimOverflow();
    startLoop();
    positionBubble(bubble, 0);
    requestAnimationFrame(() => el.classList.add("hero-dialogue-bubble--visible"));
    window.setTimeout(() => startLoop(), bubble.ttlMs);
    return bubble;
  }

  function positionBubble(bubble, t) {
    const el = bubble.el;
    if (!el) return;
    let x = bubble.from.x;
    let y = bubble.from.y;
    if (bubble.phase === "travel") {
      const p = Math.min(1, t / bubble.travelMs);
      const ease = 1 - (1 - p) ** 3;
      x = bubble.from.x + (bubble.to.x - bubble.from.x) * ease;
      y = bubble.from.y + (bubble.to.y - bubble.from.y) * ease - Math.sin(p * Math.PI) * 22;
    } else {
      x = bubble.to.x;
      y = bubble.to.y;
    }
    const key = `${Math.round(x)}|${Math.round(y)}`;
    if (bubble._posKey === key) return;
    bubble._posKey = key;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
  }

  function tick(ts) {
    const now = ts || performance.now();
    if (lastTs && now - lastTs < TICK_MIN_MS) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastTs = now;

    bubbles = bubbles.filter((bubble) => {
      const age = now - bubble.bornAt;
      if (age > bubble.travelMs && bubble.phase === "travel") {
        bubble.phase = "hold";
        bubble._posKey = "";
      }
      if (age > bubble.ttlMs) {
        bubble.el?.classList.add("hero-dialogue-bubble--out");
        if (age > bubble.ttlMs + 320) {
          bubble.el?.remove();
          return false;
        }
      }
      if (bubble.phase === "travel" || age < bubble.ttlMs) {
        positionBubble(bubble, age);
      }
      return true;
    });

    if (bubbles.length) {
      const animating = bubbles.some((b) => {
        const age = now - b.bornAt;
        return b.phase === "travel" || age > b.ttlMs;
      });
      if (animating) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
        lastTs = 0;
      }
    } else {
      rafId = null;
      lastTs = 0;
    }
  }

  function startLoop() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(tick);
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
    bubbles.forEach((b) => b.el?.remove());
    bubbles = [];
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = 0;
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
