/**
 * Театр результата боя: летающие эмодзи-герои и смешные реплики.
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

let battleTheaterTimer = null;
let battleTheaterBubbleTimer = null;

function pickTheaterLine(classId, won) {
  const pack = BATTLE_THEATER_HERO[classId] || null;
  const pool = won
    ? (pack?.win || BATTLE_THEATER_GENERIC.win)
    : (pack?.lose || BATTLE_THEATER_GENERIC.lose);
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

function stopBattleResultTheater() {
  if (battleTheaterTimer) {
    clearInterval(battleTheaterTimer);
    battleTheaterTimer = null;
  }
  if (battleTheaterBubbleTimer) {
    clearTimeout(battleTheaterBubbleTimer);
    battleTheaterBubbleTimer = null;
  }
  const theater = document.getElementById("battle-result-theater");
  if (!theater) return;
  theater.classList.add("hidden");
  theater.setAttribute("aria-hidden", "true");
  theater.querySelectorAll(".br-theater-fighter").forEach((el) => {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
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

  if (playerBubble) {
    playerBubble.textContent = playerLine;
    playerBubble.classList.remove("br-theater-bubble--pop");
    void playerBubble.offsetWidth;
    playerBubble.classList.add("br-theater-bubble--pop");
  }
  if (enemyBubble) {
    enemyBubble.textContent = enemyLine;
    enemyBubble.classList.remove("br-theater-bubble--pop");
    void enemyBubble.offsetWidth;
    enemyBubble.classList.add("br-theater-bubble--pop");
  }
}

function startBattleResultTheater(summary) {
  stopBattleResultTheater();
  const theater = document.getElementById("battle-result-theater");
  const overlay = document.getElementById("battle-result-overlay");
  if (!theater || !overlay || overlay.classList.contains("hidden")) return;

  const playerEl = document.getElementById("br-theater-player");
  const enemyEl = document.getElementById("br-theater-enemy");
  if (!playerEl || !enemyEl) return;

  const playerId = resolveTheaterClassId("player", summary);
  const enemyId = resolveTheaterClassId("enemy", summary);
  const winner = summary?.winner || "draw";

  const playerEmoji = playerEl.querySelector(".br-theater-emoji");
  const enemyEmoji = enemyEl.querySelector(".br-theater-emoji");
  if (playerEmoji) playerEmoji.textContent = getTheaterEmoji(playerId);
  if (enemyEmoji) enemyEmoji.textContent = getTheaterEmoji(enemyId);

  theater.classList.remove("hidden");
  theater.setAttribute("aria-hidden", "false");
  theater.dataset.outcome = winner;

  [playerEl, enemyEl].forEach((el) => {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    el.classList.toggle("br-theater-fighter--winner", winner === "player" && el === playerEl || winner === "enemy" && el === enemyEl);
    el.classList.toggle("br-theater-fighter--loser", winner === "player" && el === enemyEl || winner === "enemy" && el === playerEl);
    el.classList.toggle("br-theater-fighter--draw", winner === "draw");
  });

  cycleTheaterBubbles(summary);

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    battleTheaterTimer = window.setInterval(() => cycleTheaterBubbles(summary), 2800);
  }
}
