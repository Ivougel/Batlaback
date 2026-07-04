/**
 * DialogueEngine — сквозные диалоги забега: характеры, интересы, цепочки реплик.
 */

const DialogueEngine = (() => {
  const TICK_MIN_MS = 4200;
  const TICK_MAX_MS = 7800;
  const REPLY_DELAY_MS = 1400;

  let state = createState();
  let nextBeatAt = 0;
  let pendingReply = null;

  function createState() {
    return {
      runKey: "",
      round: 1,
      phase: "prep",
      history: [],
      spokenCounts: {},
      lastLineId: null,
      lastSpeakerId: null,
      openedRun: false,
      shopPingAt: 0,
      enabled: true,
    };
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

  function scheduleNextBeat(min = TICK_MIN_MS, max = TICK_MAX_MS) {
    nextBeatAt = Date.now() + min + Math.random() * (max - min);
  }

  function reset(runKey = "") {
    state = createState();
    state.runKey = runKey;
    nextBeatAt = 0;
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
    const text = typeof resolveDialogueLineText === "function"
      ? resolveDialogueLineText(line, from.classId)
      : (line.text || "");
    if (!text) return;

    const fromWrap = wrapFighter(from);
    const toWrap = to ? wrapFighter(to) : null;

    if (typeof DialogueOverlay !== "undefined") {
      if (opts.reply) DialogueOverlay.showReply(fromWrap, toWrap, text, opts);
      else DialogueOverlay.showExchange(fromWrap, toWrap, text, opts);
    }

    if (typeof setLobbyFighterEmotion === "function") {
      const voice = typeof getHeroDialogueVoice === "function"
        ? getHeroDialogueVoice(from.classId)
        : null;
      setLobbyFighterEmotion(from.id, {
        emoji: voice?.emoji || "💭",
        animation: opts.reply ? "nod" : "bounce",
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

    if (typeof syncLobbyFighterAvatars === "function" && opts.lobby) {
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
          at: Date.now() + REPLY_DELAY_MS,
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
      emitLine(job.from, job.to, { id: `custom_${Date.now()}`, text: job.customText, trigger: "reply" }, {
        lobby: job.lobby,
        matches: job.matches,
        reply: true,
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

  function onRunStart(lobby, round = 1) {
    if (!state.enabled || !lobby) return;
    state.round = round;
    state.phase = "prep";
    state.openedRun = true;
    scheduleNextBeat(800, 1800);

    const openers = (lobby.fighters || []).filter((f) => f.alive !== false).slice(0, 3);
    openers.forEach((fighter, i) => {
      setTimeout(() => {
        tryEmitFromCatalog("run_open", {
          round,
          classId: fighter.classId,
          speaker: fighter,
        }, lobby, []);
      }, 500 + i * 1100);
    });
  }

  function onRoundPrep(lobby, round, matches = []) {
    state.round = round;
    state.phase = "prep";
    if (lobby?.currentOpponentId != null) {
      const [human, opponent] = pickOpponentPair(lobby);
      if (human && opponent) {
        setTimeout(() => {
          tryEmitFromCatalog("prep_opponent", {
            round,
            classId: human.classId,
            speaker: human,
            target: opponent,
          }, lobby, matches);
        }, 900);
      }
    }
    scheduleNextBeat();
  }

  function onShopActivity(lobby, fighterId, matches = []) {
    const fighter = lobby?.fighters?.[fighterId];
    if (!fighter) return;
    const now = Date.now();
    if (now - state.shopPingAt < 2500) return;
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
    fighters.forEach((fighter) => {
      const won = fighter.id === winnerId;
      tryEmitFromCatalog(won ? "post_battle_win" : "post_battle_loss", {
        round: state.round,
        classId: fighter.classId,
        speaker: fighter,
      }, lobby, matches);
    });
    scheduleNextBeat(3000, 5000);
  }

  function tick(ctx = {}) {
    if (!state.enabled) return false;
    processPendingReply();

    const lobby = ctx.lobby;
    if (!lobby) return false;

    state.round = ctx.round ?? state.round;
    state.phase = ctx.phase ?? state.phase;

    if (ctx.timerActive && ctx.timerRemaining != null && ctx.timerRemaining <= 12 && ctx.timerRemaining > 0) {
      if (!state._timerLineAt || Date.now() - state._timerLineAt > 9000) {
        state._timerLineAt = Date.now();
        const [speaker] = pickRandomFighters(lobby, 1);
        if (speaker) {
          tryEmitFromCatalog("prep_timer", {
            round: state.round,
            timerRemaining: ctx.timerRemaining,
            classId: speaker.classId,
            speaker,
          }, lobby, ctx.matches || []);
          scheduleNextBeat(5000, 8000);
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
      if (hpPct < 0.35 && Math.random() > 0.45) {
        tryEmitFromCatalog("low_hp", {
          round: state.round,
          hpPct,
          classId: fighter.classId,
          speaker: fighter,
        }, lobby, ctx.matches || []);
        scheduleNextBeat();
        return true;
      }
    }

    if (Math.random() > 0.35) {
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
              at: Date.now() + REPLY_DELAY_MS,
              from: to,
              to: from,
              customText: replyText,
              lobby,
              matches: ctx.matches || [],
            };
          }
          scheduleNextBeat();
          return true;
        }
      }
    }

    const trigger = Math.random() > 0.25 ? "prep_idle" : "prep_banter";
    const ok = tryEmitFromCatalog(trigger, { round: state.round }, lobby, ctx.matches || []);
    scheduleNextBeat();
    return ok;
  }

  function tickSolo(ctx = {}) {
    if (!state.enabled || typeof DialogueOverlay === "undefined") return false;
    if (Date.now() < nextBeatAt) return false;

    const playerClassId = typeof playerClass !== "undefined" ? playerClass : "warrior";
    const enemyClassId = typeof enemyClass !== "undefined" ? enemyClass : "rogue";
    const playerVoice = getHeroDialogueVoice(playerClassId);
    const enemyVoice = getHeroDialogueVoice(enemyClassId);

    const lines = getDialogueLinesForTrigger("prep_idle", {
      round: ctx.round || 1,
      phase: getDialogueRunPhase(ctx.round || 1),
    });
    const line = pickWeightedDialogueLine(lines);
    if (!line) return false;

    const fromPlayer = Math.random() > 0.5;
    const from = fromPlayer
      ? { id: "player", classId: playerClassId, name: playerVoice.label, isHuman: true }
      : { id: "enemy", classId: enemyClassId, name: enemyVoice.label, isHuman: false };
    const to = fromPlayer
      ? { id: "enemy", classId: enemyClassId, name: enemyVoice.label }
      : { id: "player", classId: playerClassId, name: playerVoice.label };

    DialogueOverlay.showExchange(from, to, resolveDialogueLineText(line, from.classId));
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
