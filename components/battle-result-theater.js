/**
 * Театр результата боя: полноразмерные портреты героев, реплики и вариативные idle-анимации.
 * Победитель / проигравший получают разные наборы движений; каждый раз — случайный вариант.
 */

const BATTLE_THEATER_HERO = {
  warrior: {
    emoji: "🍉",
    win: ["Попка победила!", "Всё ещё милый арбузик на тропинке", "Мартовичок не промах"],
    lose: ["Попка подвела…", "Ну ладно, всё равно милый", "Арбузик обиделся"],
  },
  rogue: {
    emoji: "🥷",
    win: ["Мина сработала 💩", "Звезда Telegram в восторге", "Роксивичок из тени"],
    lose: ["Ниндзя споткнулся", "Рисовое поле не простило", "Чат скучает без звезды"],
  },
  mage: {
    emoji: "🪄",
    win: ["Блестящая победа!", "Ванна наполнена ✨", "Маркошка колдует"],
    lose: ["Какашки не долетели", "Трансгрессия дала сбой", "Магия ушла в закат"],
  },
  priest: {
    emoji: "🎤",
    win: ["Ария победы!", "DOG напечатает об этом", "Святая ПОПка сияет"],
    lose: ["Фальшивая нота…", "Опера на паузе", "Писатель вздохнул"],
  },
};

const BATTLE_THEATER_GENERIC = {
  win: ["Ура!", "Победа!", "Красота!"],
  lose: ["Ой…", "Бывает", "Эх…"],
  draw: ["Ничья!", "Обнялись", "Силы равны"],
};

/** 6 победных + 6 пораженческих + 3 ничейных — каждый раз случайный */
const BATTLE_THEATER_WIN_MOODS = ["triumph", "swagger", "salute", "sparkle", "flex", "hop"];
const BATTLE_THEATER_LOSE_MOODS = ["slump", "wilt", "stagger", "sulk", "deflate", "shake"];
const BATTLE_THEATER_DRAW_MOODS = ["breathe", "shrug", "sway"];

let battleTheaterTimer = null;
let battleTheaterBubbleTimer = null;
let battleTheaterMoodTimer = null;

function pickTheaterLine(classId, won) {
  const pack = BATTLE_THEATER_HERO[classId] || null;
  const pool = won
    ? (pack?.win || BATTLE_THEATER_GENERIC.win)
    : (pack?.lose || BATTLE_THEATER_GENERIC.lose);
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickTheaterMood(outcome) {
  const pool = outcome === "win"
    ? BATTLE_THEATER_WIN_MOODS
    : outcome === "lose"
      ? BATTLE_THEATER_LOSE_MOODS
      : BATTLE_THEATER_DRAW_MOODS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function resolveTheaterClassId(side, summary) {
  if (side === "player") {
    return summary?.playerClassId
      || (typeof playerClass !== "undefined" ? playerClass : null)
      || "warrior";
  }
  return summary?.enemyClassId
    || (typeof enemyClass !== "undefined" ? enemyClass : null)
    || "mage";
}

function getTheaterEmoji(classId) {
  return BATTLE_THEATER_HERO[classId]?.emoji
    || (typeof getClassById === "function" ? getClassById(classId)?.icon : null)
    || "🐾";
}

function getTheaterPortraitSrc(classId) {
  if (typeof getClassHeroPortraitSrc === "function") {
    return getClassHeroPortraitSrc(classId);
  }
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  return cls?.heroPortraitSrc || cls?.iconSrc || null;
}

function getTheaterHeroLabel(classId) {
  if (typeof getHeroLabel === "function") return getHeroLabel(classId);
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  return cls?.heroLabel || cls?.name || "";
}

function randomizeTheaterMotion(el) {
  if (!el) return;
  const delay = -(Math.random() * 4).toFixed(2);
  const rate = (0.88 + Math.random() * 0.26).toFixed(3);
  const sway = (Math.random() * 14 - 7).toFixed(1);
  el.style.setProperty("--br-anim-delay", `${delay}s`);
  el.style.setProperty("--br-anim-rate", rate);
  el.style.setProperty("--br-sway-offset", `${sway}px`);
}

function applyTheaterFighterState(el, {
  classId,
  role,
  winner,
  entering = false,
}) {
  if (!el) return;

  const isWinner = winner === role;
  const isLoser = winner !== "draw" && !isWinner;
  const outcome = winner === "draw" ? "draw" : isWinner ? "win" : "lose";
  const mood = pickTheaterMood(outcome);

  el.dataset.class = classId;
  el.dataset.mood = mood;
  el.dataset.outcome = outcome;
  el.classList.toggle("br-theater-fighter--winner", isWinner);
  el.classList.toggle("br-theater-fighter--loser", isLoser);
  el.classList.toggle("br-theater-fighter--draw", winner === "draw");
  el.classList.toggle("br-theater-fighter--entering", entering);

  randomizeTheaterMotion(el);

  const portrait = el.querySelector(".br-theater-portrait");
  const badge = el.querySelector(".br-theater-emoji-badge");
  const src = getTheaterPortraitSrc(classId);
  const label = getTheaterHeroLabel(classId);

  if (portrait) {
    if (src) {
      portrait.src = src;
      portrait.alt = label;
      portrait.classList.remove("br-theater-portrait--fallback");
    } else {
      portrait.removeAttribute("src");
      portrait.alt = label;
      portrait.classList.add("br-theater-portrait--fallback");
    }
  }
  if (badge) badge.textContent = getTheaterEmoji(classId);
}

function rerollTheaterMoods(summary) {
  const winner = summary?.winner || "draw";
  const playerEl = document.getElementById("br-theater-player");
  const enemyEl = document.getElementById("br-theater-enemy");
  if (!playerEl || !enemyEl) return;

  applyTheaterFighterState(playerEl, {
    classId: resolveTheaterClassId("player", summary),
    role: "player",
    winner,
  });
  applyTheaterFighterState(enemyEl, {
    classId: resolveTheaterClassId("enemy", summary),
    role: "enemy",
    winner,
  });
}

function stopBattleResultTheater() {
  if (battleTheaterTimer) {
    clearInterval(battleTheaterTimer);
    battleTheaterTimer = null;
  }
  if (battleTheaterBubbleTimer) {
    clearTimeout(battleTheaterBubbleTimer);
    battleTheaterBubbleTimer = null;
  }
  if (battleTheaterMoodTimer) {
    clearInterval(battleTheaterMoodTimer);
    battleTheaterMoodTimer = null;
  }
  const theater = document.getElementById("battle-result-theater");
  if (!theater) return;
  theater.classList.add("hidden");
  theater.setAttribute("aria-hidden", "true");
  theater.removeAttribute("data-outcome");
  theater.querySelectorAll(".br-theater-fighter").forEach((el) => {
    el.classList.add("hidden");
    el.classList.remove("br-theater-fighter--entering");
    el.setAttribute("aria-hidden", "true");
    delete el.dataset.mood;
    delete el.dataset.outcome;
    delete el.dataset.class;
  });
}

function cycleTheaterBubbles(summary) {
  const winner = summary?.winner || "draw";
  const playerWon = winner === "player";
  const enemyWon = winner === "enemy";
  const playerId = resolveTheaterClassId("player", summary);
  const enemyId = resolveTheaterClassId("enemy", summary);

  const playerBubble = document.querySelector("#br-theater-player .br-theater-bubble");
  const enemyBubble = document.querySelector("#br-theater-enemy .br-theater-bubble");

  const playerLine = winner === "draw"
    ? BATTLE_THEATER_GENERIC.draw[Math.floor(Math.random() * BATTLE_THEATER_GENERIC.draw.length)]
    : pickTheaterLine(playerId, playerWon);
  const enemyLine = winner === "draw"
    ? BATTLE_THEATER_GENERIC.draw[Math.floor(Math.random() * BATTLE_THEATER_GENERIC.draw.length)]
    : pickTheaterLine(enemyId, enemyWon);

  [playerBubble, enemyBubble].forEach((bubble) => {
    if (!bubble) return;
    bubble.classList.remove("br-theater-bubble--pop");
    void bubble.offsetWidth;
    bubble.classList.add("br-theater-bubble--pop");
  });

  if (playerBubble) playerBubble.textContent = playerLine;
  if (enemyBubble) enemyBubble.textContent = enemyLine;
}

function startBattleResultTheater(summary) {
  stopBattleResultTheater();
  const theater = document.getElementById("battle-result-theater");
  const overlay = document.getElementById("battle-result-overlay");
  if (!theater || !overlay || overlay.classList.contains("hidden")) return;

  const playerEl = document.getElementById("br-theater-player");
  const enemyEl = document.getElementById("br-theater-enemy");
  if (!playerEl || !enemyEl) return;

  const winner = summary?.winner || "draw";

  theater.classList.remove("hidden");
  theater.setAttribute("aria-hidden", "false");
  theater.dataset.outcome = winner;

  applyTheaterFighterState(playerEl, {
    classId: resolveTheaterClassId("player", summary),
    role: "player",
    winner,
    entering: true,
  });
  applyTheaterFighterState(enemyEl, {
    classId: resolveTheaterClassId("enemy", summary),
    role: "enemy",
    winner,
    entering: true,
  });

  [playerEl, enemyEl].forEach((el) => {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  });

  cycleTheaterBubbles(summary);

  window.setTimeout(() => {
    playerEl.classList.remove("br-theater-fighter--entering");
    enemyEl.classList.remove("br-theater-fighter--entering");
  }, 720);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) {
    battleTheaterTimer = window.setInterval(() => cycleTheaterBubbles(summary), 3200);
    battleTheaterMoodTimer = window.setInterval(() => rerollTheaterMoods(summary), 6800);
  }
}
