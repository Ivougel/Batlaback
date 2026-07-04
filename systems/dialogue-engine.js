/**
 * DialogueEngine — сквозные диалоги забега: характеры, интересы, цепочки реплик.
 */

const DialogueEngine = (() => {
  /** ~8 обменов на фазу prep ≈ 50–60 с (реплика + ответ не считаются отдельным «битом»). */
  const PREP_TARGET_EXCHANGES = 8;
  const MIN_GAP_BETWEEN_EMITS_MS = 7000;
  const REPLY_DELAY_MS = 3200;
  const PREP_WARMUP_MS = 5000;
  const DEFAULT_PREP_SEC = 50;

  let state = createState();
  let nextBeatAt = 0;
  let pendingReply = null;

  function createState() {
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
      openedRun: false,
      shopPingAt: 0,
      roundPrepStartedAt: 0,
      enabled: true,
    };
  }

  function resolvePrepDurationSec(ctx = {}) {
    if (ctx.prepDurationSec > 0) return ctx.prepDurationSec;
    if (ctx.timerTotal > 0) return ctx.timerTotal;
    if (typeof LOBBY_PREP_SECONDS !== "undefined") return LOBBY_PREP_SECONDS;
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

  function scheduleNextBeat(min, max) {
    const gap = getPrepBeatIntervalMs();
    const lo = min ?? gap.min;
    const hi = max ?? gap.max;
    nextBeatAt = Date.now() + lo + Math.random() * Math.max(500, hi - lo);
  }

  function canEmitNow() {
    return Date.now() - (state.lastEmitAt || 0) >= MIN_GAP_BETWEEN_EMITS_MS;
  }

  function afterEmit() {
    state.lastEmitAt = Date.now();
    scheduleNextBeat();
  }

  function queueReplyDelay(emojiOnly = false) {
    return emojiOnly ? REPLY_DELAY_MS * 0.9 : REPLY_DELAY_MS;
  }

  function fighterKey(fighter) {
    return fighter?.id ?? fighter?.side ?? "unknown";
  }

  function getFighterName(fighter) {
    if (!fighter) return "Герой";
    const voice = typeof getHeroDialogueVoice === "function"
      ? getHeroDialogueVoice(fighter.classId)
      : null;
    return fighter.name || voice?.label || "Герой";
  }

  function wrapFighter(fighter) {
    return {
      id: fighter.id,
      classId: fighter.classId,
      name: getFighterName(fighter),
      isHuman: !!fighter.isHuman,
      alive: fighter.alive !== false,
      hp: fighter.hp,
    };
  }

  function markSpoken(lineId) {
    if (!lineId) return;
    state.spokenCounts[lineId] = (state.spokenCounts[lineId] || 0) + 1;
    state.lastLineId = lineId;
  }

  function wasSpokenRecently(lineId, maxCount = 2) {
    return (state.spokenCounts[lineId] || 0) >= maxCount;
  }

  function pushHistory(entry) {
    state.history.push({ ...entry, at: Date.now(), round: state.round });
    if (state.history.length > 80) state.history.shift();
    state.lastSpeakerId = entry.fromId;
  }

  function reset(runKey = "") {
    state = createState();
    state.runKey = runKey;
    nextBeatAt = Date.now() + PREP_WARMUP_MS;
    pendingReply = null;
    if (typeof DialogueOverlay !== "undefined") DialogueOverlay.clearAll();
  }

  function getAliveFighters(lobby) {
    return (lobby?.fighters || []).filter((f) => f && f.alive !== false);
  }

  function pickRandomFighters(lobby, count = 2) {
    const alive = getAliveFighters(lobby);
    if (alive.length < count) return alive;
    const copy = [...alive];
    const picked = [];
    while (picked.length < count && copy.length) {
      const i = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(i, 1)[0]);
    }
    return picked;
  }

  function pickOpponentPair(lobby) {
    const human = lobby.fighters?.find((f) => f.isHuman && f.alive !== false);
    const opponent = lobby.fighters?.[lobby.currentOpponentId];
    if (human && opponent && opponent.alive !== false) return [human, opponent];
    return pickRandomFighters(lobby, 2);
  }

  function emitLine(from, to, line, opts = {}) {
    if (!line || !from) return;
    if (!opts.force && !canEmitNow() && !opts.reply) return;
    const text = typeof resolveDialogueLineText === "function"
      ? resolveDialogueLineText(line, from.classId)
      : (line.text || "");
    if (!text) return;

    const emojiOnly = opts.emojiOnly
      ?? (typeof isDialogueLineEmojiOnly === "function"
        ? isDialogueLineEmojiOnly(line, from.classId)
        : false);

    const fromWrap = wrapFighter(from);
    const toWrap = to ? wrapFighter(to) : null;

    if (typeof DialogueOverlay !== "undefined") {
      if (opts.reply) DialogueOverlay.showReply(fromWrap, toWrap, text, { ...opts, emojiOnly });
      else DialogueOverlay.showExchange(fromWrap, toWrap, text, { ...opts, emojiOnly });
    }

    if (typeof setLobbyFighterEmotion === "function") {
      const voice = typeof getHeroDialogueVoice === "function"
        ? getHeroDialogueVoice(from.classId)
        : null;
      setLobbyFighterEmotion(from.id, {
        emoji: voice?.emoji || "💭",
        animation: "nod",
        priority: opts.reply ? 2 : 1,
      });
    }

    pushHistory({
      fromId: from.id,
      toId: to?.id ?? null,
      lineId: line.id,
      text,
      trigger: line.trigger,
    });
    markSpoken(line.id);
    if (!opts.reply) afterEmit();

    if (typeof syncLobbyFighterAvatars === "function" && opts.lobby && !opts.reply) {
      syncLobbyFighterAvatars(opts.lobby, {
        phase: state.phase,
        round: state.round,
        matches: opts.matches || [],
      });
    }
  }

  function queueReply(from, to, replyLineId, lobby, matches, delay = REPLY_DELAY_MS) {
    if (!from || !replyLineId) return;
    pendingReply = {
      at: Date.now() + delay,
      from,
      to,
      lineId: replyLineId,
      lobby,
      matches,
    };
  }

  function tryEmitFromCatalog(trigger, ctx, lobby, matches) {
    if (!canEmitNow()) return false;
    const lines = typeof getDialogueLinesForTrigger === "function"
      ? getDialogueLinesForTrigger(trigger, ctx)
      : [];
    const available = lines.filter((line) => !wasSpokenRecently(line.id, trigger === "prep_idle" ? 1 : 2));
    const line = typeof pickWeightedDialogueLine === "function"
      ? pickWeightedDialogueLine(available)
      : available[0];
    if (!line) return false;

    let speaker = ctx.speaker;
    if (!speaker && line.classId) {
      speaker = lobby.fighters?.find((f) => f.classId === line.classId && f.alive !== false);
    }
    if (!speaker) {
      const [a] = pickRandomFighters(lobby, 1);
      speaker = a;
    }
    if (!speaker) return false;

    let target = ctx.target;
    if (!target) {
      const others = getAliveFighters(lobby).filter((f) => f.id !== speaker.id);
      target = others[Math.floor(Math.random() * others.length)] || null;
    }

    emitLine(speaker, target, line, { lobby, matches, reply: !!ctx.reply });

    const replyLine = typeof findDialogueLineById === "function"
      ? null
      : null;

    const replyCandidates = typeof getDialogueLinesForTrigger === "function"
      ? getDialogueLinesForTrigger("reply", { replyToLineId: line.id, round: ctx.round })
      : [];
    const replyPick = typeof pickWeightedDialogueLine === "function"
      ? pickWeightedDialogueLine(replyCandidates)
      : replyCandidates[0];

    if (replyPick && target) {
      queueReply(target, speaker, replyPick.id, lobby, matches);
      pendingReply._replyLine = replyPick;
      return true;
    }

    if (line.reply && target) {
      const replyText = line.reply[target.classId];
      if (replyText) {
        pendingReply = {
          at: Date.now() + queueReplyDelay(),
          from: target,
          to: speaker,
          customText: replyText,
          lobby,
          matches,
        };
      }
    }
    return true;
  }

  function processPendingReply() {
    if (!pendingReply || Date.now() < pendingReply.at) return;
    const job = pendingReply;
    pendingReply = null;

    if (job.customText) {
      const emojiOnly = job.emojiOnly ?? (typeof isDialogueEmojiOnly === "function"
        ? isDialogueEmojiOnly(job.customText)
        : false);
      emitLine(job.from, job.to, { id: `custom_${Date.now()}`, text: job.customText, trigger: "reply" }, {
        lobby: job.lobby,
        matches: job.matches,
        reply: true,
        emojiOnly,
      });
      return;
    }

    if (job._replyLine) {
      emitLine(job.from, job.to, job._replyLine, {
        lobby: job.lobby,
        matches: job.matches,
        reply: true,
      });
      return;
    }

    if (job.lineId) {
      const line = typeof findDialogueLineById === "function" ? findDialogueLineById(job.lineId) : null;
      if (line) {
        emitLine(job.from, job.to, line, { lobby: job.lobby, matches: job.matches, reply: true });
      }
    }
  }

  function tryEmitEmojiExchange(lobby, matches = []) {
    if (!canEmitNow()) return false;
    const fighters = pickRandomFighters(lobby, 2);
    if (fighters.length < 1) return false;
    const from = fighters[0];
    const to = fighters[1] || null;

    let line = null;
    if (Math.random() > 0.38 && typeof pickDialogueEmojiMessage === "function") {
      line = pickDialogueEmojiMessage(from.classId);
    } else {
      const lines = typeof getDialogueLinesForTrigger === "function"
        ? getDialogueLinesForTrigger("prep_emoji", { round: state.round, classId: from.classId })
        : [];
      const available = lines.filter((entry) => !wasSpokenRecently(entry.id, 1));
      line = typeof pickWeightedDialogueLine === "function"
        ? pickWeightedDialogueLine(available.length ? available : lines)
        : lines[0];
    }
    if (!line) return false;

    const text = typeof resolveDialogueLineText === "function"
      ? resolveDialogueLineText(line, from.classId)
      : line.text;
    const emojiOnly = typeof isDialogueLineEmojiOnly === "function"
      ? isDialogueLineEmojiOnly(line, from.classId)
      : false;

    emitLine(from, to, line, { lobby, matches, emojiOnly });

    if (to && Math.random() > 0.35) {
      const replyText = typeof pickDialogueEmojiReply === "function"
        ? pickDialogueEmojiReply(text, to.classId)
        : (typeof pickDialogueEmoji === "function" ? pickDialogueEmoji({ classId: to.classId }) : "😏");
      pendingReply = {
        at: Date.now() + queueReplyDelay(emojiOnly),
        from: to,
        to: from,
        customText: replyText,
        lobby,
        matches,
        emojiOnly: typeof isDialogueEmojiOnly === "function" ? isDialogueEmojiOnly(replyText) : emojiOnly,
      };
    }
    return true;
  }

  function onRunStart(lobby, round = 1, opts = {}) {
    if (!state.enabled || !lobby) return;
    state.round = round;
    state.phase = "prep";
    state.prepDurationSec = resolvePrepDurationSec(opts);
    state.openedRun = true;
    state.roundPrepStartedAt = Date.now();
    nextBeatAt = Date.now() + PREP_WARMUP_MS + getPrepBeatIntervalMs().min;

    const opener = lobby.fighters?.find((f) => f.isHuman && f.alive !== false)
      || pickRandomFighters(lobby, 1)[0];
    if (!opener) return;

    const openDelay = 3500 + Math.random() * 2500;
    setTimeout(() => {
      if (!canEmitNow() && state.lastEmitAt > 0) return;
      if (Math.random() > 0.5) {
        tryEmitEmojiExchange(lobby, []);
        return;
      }
      tryEmitFromCatalog("run_open", {
        round,
        classId: opener.classId,
        speaker: opener,
      }, lobby, []);
    }, openDelay);
  }

  function onRoundPrep(lobby, round, matches = [], opts = {}) {
    state.round = round;
    state.phase = "prep";
    state.prepDurationSec = resolvePrepDurationSec(opts);
    state.roundPrepStartedAt = Date.now();
    pendingReply = null;
    nextBeatAt = Date.now() + PREP_WARMUP_MS + getPrepBeatIntervalMs().min * 0.6;

    if (lobby?.currentOpponentId != null) {
      const [human, opponent] = pickOpponentPair(lobby);
      if (human && opponent) {
        const delay = 6000 + Math.random() * 4000;
        setTimeout(() => {
          tryEmitFromCatalog("prep_opponent", {
            round,
            classId: human.classId,
            speaker: human,
            target: opponent,
          }, lobby, matches);
        }, delay);
      }
    }
  }

  function onShopActivity(lobby, fighterId, matches = []) {
    const fighter = lobby?.fighters?.[fighterId];
    if (!fighter || !canEmitNow()) return;
    const now = Date.now();
    if (now - state.shopPingAt < 12000) return;
    state.shopPingAt = now;
    tryEmitFromCatalog("prep_shop", {
      round: state.round,
      classId: fighter.classId,
      speaker: fighter,
    }, lobby, matches);
  }

  function onPostBattle(lobby, winnerId, matches = []) {
    if (!lobby) return;
    const fighters = getAliveFighters(lobby);
    const sample = pickRandomFighters(lobby, Math.min(2, fighters.length));
    sample.forEach((fighter, i) => {
      const won = fighter.id === winnerId;
      setTimeout(() => {
        if (!canEmitNow() && i > 0) return;
        tryEmitFromCatalog(won ? "post_battle_win" : "post_battle_loss", {
          round: state.round,
          classId: fighter.classId,
          speaker: fighter,
        }, lobby, matches);
      }, 2500 + i * 5000);
    });
    nextBeatAt = Date.now() + PREP_WARMUP_MS + getPrepBeatIntervalMs().min;
  }

  function tick(ctx = {}) {
    if (!state.enabled) return false;
    state.prepDurationSec = resolvePrepDurationSec(ctx);
    processPendingReply();

    const lobby = ctx.lobby;
    if (!lobby) return false;

    state.round = ctx.round ?? state.round;
    state.phase = ctx.phase ?? state.phase;

    if (ctx.timerActive && ctx.timerRemaining != null && ctx.timerRemaining <= 12 && ctx.timerRemaining > 0) {
      if (!state._timerLineAt || Date.now() - state._timerLineAt > 14000) {
        state._timerLineAt = Date.now();
        const [speaker] = pickRandomFighters(lobby, 1);
        if (speaker && canEmitNow()) {
          tryEmitFromCatalog("prep_timer", {
            round: state.round,
            timerRemaining: ctx.timerRemaining,
            classId: speaker.classId,
            speaker,
          }, lobby, ctx.matches || []);
          return true;
        }
      }
    }

    if (Date.now() < nextBeatAt) return false;

    const alive = getAliveFighters(lobby);
    for (const fighter of alive) {
      const hp = typeof getLobbyFighterLiveHp === "function"
        ? getLobbyFighterLiveHp(fighter.id, lobby, ctx.matches || [])
        : { current: fighter.hp ?? 100, max: 100 };
      const hpPct = hp.max > 0 ? hp.current / hp.max : 1;
      if (hpPct < 0.35 && Math.random() > 0.55 && canEmitNow()) {
        tryEmitFromCatalog("low_hp", {
          round: state.round,
          hpPct,
          classId: fighter.classId,
          speaker: fighter,
        }, lobby, ctx.matches || []);
        return true;
      }
    }

    if (Math.random() > 0.5) {
      const a = alive[Math.floor(Math.random() * alive.length)];
      const b = alive.filter((f) => f.id !== a.id)[Math.floor(Math.random() * Math.max(1, alive.length - 1))];
      if (a && b && typeof findBanterLine === "function") {
        const banter = findBanterLine(a.classId, b.classId) || findBanterLine(b.classId, a.classId);
        if (banter && !wasSpokenRecently(banter.id, 1)) {
          const from = banter.fromClass === a.classId ? a : b;
          const to = from.id === a.id ? b : a;
          emitLine(from, to, banter, { lobby, matches: ctx.matches || [] });
          const replyText = banter.reply?.[to.classId];
          if (replyText) {
            pendingReply = {
              at: Date.now() + queueReplyDelay(),
              from: to,
              to: from,
              customText: replyText,
              lobby,
              matches: ctx.matches || [],
            };
          }
          return true;
        }
      }
    }

    const roll = Math.random();
    if (roll < 0.42) {
      return tryEmitEmojiExchange(lobby, ctx.matches || []);
    }

    const trigger = roll < 0.72 ? "prep_idle" : "prep_banter";
    return tryEmitFromCatalog(trigger, { round: state.round }, lobby, ctx.matches || []);
  }

  function tickSolo(ctx = {}) {
    if (!state.enabled || typeof DialogueOverlay === "undefined") return false;
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
    onRunStart,
    onRoundPrep,
    onShopActivity,
    onPostBattle,
    tick,
    tickSolo,
    getState: () => state,
    setEnabled(v) { state.enabled = !!v; },
  };
})();

window.DialogueEngine = DialogueEngine;
