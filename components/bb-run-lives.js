/** Prep: индикатор жизней classic BB (4 ❤️). */
function syncBBRunLivesHud() {
  const el = document.getElementById("bb-run-lives");
  if (!el) return;
  const active = typeof shouldUseBBRunLives === "function" && shouldUseBBRunLives()
    && typeof phase !== "undefined"
    && phase === "prep"
    && !(typeof gameOver !== "undefined" && gameOver);
  el.classList.toggle("hidden", !active);
  el.toggleAttribute("hidden", !active);
  if (!active) {
    el.textContent = "";
    return;
  }
  const max = typeof getBBRunLivesMax === "function" ? getBBRunLivesMax() : 4;
  const lives = typeof runLives !== "undefined" ? runLives : max;
  el.textContent = Array.from({ length: max }, (_, i) => (i < lives ? "❤️" : "🖤")).join("");
}

if (typeof window !== "undefined") {
  window.syncBBRunLivesHud = syncBBRunLivesHud;
}
