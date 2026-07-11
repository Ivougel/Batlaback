/**
 * DialogueEngine — prep-диалоги classic (игрок vs AI).
 */
const DialogueEngine = (() => {
  const PREP_TARGET_EXCHANGES = 8;
  const MIN_GAP_BETWEEN_EMITS_MS = 7000;
  const PREP_WARMUP_MS = 5000;
  const DEFAULT_PREP_SEC = 50;
  const REPLY_DELAY_MS = 3200;

  type DialogueState = {
    runKey: string;
    round: number;
    phase: string;
    prepDurationSec: number;
    history: object[];
    spokenCounts: Record<string, number>;
    lastLineId: string | null;
    lastSpeakerId: string | null;
    lastEmitAt: number;
    enabled: boolean;
    _timerLineAt?: number;
  };

  let state: DialogueState = createState();
  let nextBeatAt = 0;

  function createState(): DialogueState {
    return {
      runKey: "",
      round: 1,
      phase: "prep",
      prepDurationSec: DEFAULT_PREP_SEC,
      history: [],
      spokenCounts: {},
      lastLineId: null,
      lastSpeakerId: null,
      lastEmitAt: 0,
      enabled: true,
    };
  }

  function resolvePrepDurationSec(ctx: { prepDurationSec?: number; timerTotal?: number } = {}): number {
    if ((ctx.prepDurationSec ?? 0) > 0) return ctx.prepDurationSec!;
    if ((ctx.timerTotal ?? 0) > 0) return ctx.timerTotal!;
    return DEFAULT_PREP_SEC;
  }

  function getPrepBeatIntervalMs(prepSec = state.prepDurationSec || DEFAULT_PREP_SEC) {
    const sec = Math.max(30, prepSec);
    const avgGapSec = sec / PREP_TARGET_EXCHANGES;
    const min = Math.round(avgGapSec * 0.82 * 1000);
    const max = Math.round(avgGapSec * 1.18 * 1000);
    return {
      min: Math.max(8500, min),
      max: Math.max(11000, max),
    };
  }

  function scheduleNextBeat(min?: number, max?: number): void {
    const gap = getPrepBeatIntervalMs();
    const lo = min ?? gap.min;
    const hi = max ?? gap.max;
    nextBeatAt = Date.now() + lo + Math.random() * Math.max(500, hi - lo);
  }

  function canEmitNow(): boolean {
    return Date.now() - (state.lastEmitAt || 0) >= MIN_GAP_BETWEEN_EMITS_MS;
  }

  function queueReplyDelay(emojiOnly = false): number {
    return emojiOnly ? REPLY_DELAY_MS * 0.9 : REPLY_DELAY_MS;
  }

  function reset(runKey = ""): void {
    state = createState();
    state.runKey = runKey;
    nextBeatAt = Date.now() + PREP_WARMUP_MS;
    if (typeof DialogueOverlay !== "undefined") DialogueOverlay.clearAll();
  }

  function shouldProcessTick(ctx: {
    timerActive?: boolean;
    timerRemaining?: number;
  } = {}): boolean {
    if (!state.enabled) return false;
    if (Date.now() >= nextBeatAt) return true;
    if (ctx.timerActive && ctx.timerRemaining != null && ctx.timerRemaining <= 12 && ctx.timerRemaining > 0) {
      if (!state._timerLineAt || Date.now() - state._timerLineAt > 14000) return true;
    }
    return false;
  }

  function tickSolo(ctx: { round?: number; prepDurationSec?: number } = {}): boolean {
    if (!state.enabled || typeof DialogueOverlay === "undefined") return false;
    if (!shouldProcessTick(ctx)) return false;
    state.prepDurationSec = resolvePrepDurationSec(ctx);
    if (Date.now() < nextBeatAt) return false;
    if (!canEmitNow()) {
      scheduleNextBeat();
      return false;
    }

    const playerClassId = typeof playerClass !== "undefined" ? playerClass : "warrior";
    const enemyClassId = typeof enemyClass !== "undefined" ? enemyClass : "rogue";
    const playerVoice = getHeroDialogueVoice(playerClassId);
    const enemyVoice = getHeroDialogueVoice(enemyClassId);
    const fromPlayer = Math.random() > 0.5;
    const from = fromPlayer
      ? { id: "player", classId: playerClassId, name: playerVoice.label, isHuman: true }
      : { id: "enemy", classId: enemyClassId, name: enemyVoice.label, isHuman: false };
    const to = fromPlayer
      ? { id: "enemy", classId: enemyClassId, name: enemyVoice.label }
      : { id: "player", classId: playerClassId, name: playerVoice.label };

    let text = "";
    let emojiOnly = false;
    if (Math.random() > 0.4 && typeof pickDialogueEmojiMessage === "function") {
      const line = pickDialogueEmojiMessage(from.classId);
      text = resolveDialogueLineText(line, from.classId);
      emojiOnly = isDialogueLineEmojiOnly(line, from.classId);
    } else {
      const trigger = Math.random() > 0.35 ? "prep_emoji" : "prep_idle";
      const lines = getDialogueLinesForTrigger(trigger, {
        round: ctx.round || 1,
        phase: getDialogueRunPhase(ctx.round || 1),
        classId: from.classId,
      });
      const line = pickWeightedDialogueLine(lines);
      if (!line) return false;
      text = resolveDialogueLineText(line, from.classId);
      emojiOnly = isDialogueLineEmojiOnly(line, from.classId);
    }

    DialogueOverlay.showExchange(from, to, text, { emojiOnly });
    state.lastEmitAt = Date.now();
    if (Math.random() > 0.35 && typeof pickDialogueEmojiReply === "function") {
      const replyText = pickDialogueEmojiReply(text, to.classId);
      setTimeout(() => {
        DialogueOverlay.showReply(to, from, replyText, {
          emojiOnly: isDialogueEmojiOnly(replyText),
        });
      }, queueReplyDelay(isDialogueEmojiOnly(replyText)));
    }
    scheduleNextBeat();
    return true;
  }

  return {
    reset,
    tickSolo,
    shouldProcessTick,
    getState: () => state,
    setEnabled(v: boolean) {
      state.enabled = !!v;
    },
  };
})();

window.DialogueEngine = DialogueEngine;
