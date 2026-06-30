/**
 * Полоса прогресса повтора боя — viewport-relative, в bottom-chrome.
 */

function seekReplayFraction(fraction) {
  if (typeof phase === "undefined" || phase !== "replay") return;
  if (!replayPlayback?.frames?.length || !battleState) return;
  const max = replayPlayback.frames.length - 1;
  const idx = Math.max(0, Math.min(max, Math.round(fraction * max)));
  if (idx === replayPlayback.index) return;
  replayPlayback.index = idx;
  replayPlayback.accum = 0;
  if (typeof applyBattleFrame === "function") {
    applyBattleFrame(battleState, replayPlayback.frames[idx]);
  }
  if (typeof renderBattleStats === "function") renderBattleStats();
  syncReplayTimeline();
}

function syncReplayTimeline() {
  const root = document.getElementById("replay-timeline");
  const track = document.getElementById("replay-timeline-track");
  const fill = document.getElementById("replay-timeline-fill");
  const thumb = document.getElementById("replay-timeline-thumb");
  const label = document.getElementById("replay-timeline-time");
  if (!root) return;

  const isReplay = typeof phase !== "undefined" && phase === "replay"
    && replayPlayback?.frames?.length > 1;
  root.classList.toggle("hidden", !isReplay);
  root.setAttribute("aria-hidden", isReplay ? "false" : "true");

  if (!isReplay) return;

  const max = replayPlayback.frames.length - 1;
  const pct = max > 0 ? (replayPlayback.index / max) * 100 : 0;
  if (fill) fill.style.width = `${pct}%`;
  if (thumb) thumb.style.left = `${pct}%`;
  if (track) {
    track.setAttribute("aria-valuenow", String(Math.round(pct)));
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-label", `Прогресс повтора, ${Math.round(pct)}%`);
  }
  if (label) {
    label.textContent = `${replayPlayback.index + 1}/${replayPlayback.frames.length}`;
  }
}

function initReplayTimeline() {
  const track = document.getElementById("replay-timeline-track");
  if (!track) return;

  const seekFromClientX = (clientX) => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = (clientX - rect.left) / rect.width;
    seekReplayFraction(Math.max(0, Math.min(1, fraction)));
  };

  track.addEventListener("pointerdown", (e) => {
    if (typeof phase === "undefined" || phase !== "replay") return;
    track.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  });

  track.addEventListener("pointermove", (e) => {
    if (!track.hasPointerCapture(e.pointerId)) return;
    seekFromClientX(e.clientX);
  });

  track.addEventListener("pointerup", (e) => {
    if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
  });

  track.addEventListener("keydown", (e) => {
    if (typeof phase === "undefined" || phase !== "replay" || !replayPlayback?.frames?.length) return;
    const max = replayPlayback.frames.length - 1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      seekReplayFraction((replayPlayback.index + 1) / max);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      seekReplayFraction((replayPlayback.index - 1) / max);
    }
  });
}

window.initReplayTimeline = initReplayTimeline;
window.syncReplayTimeline = syncReplayTimeline;
window.seekReplayFraction = seekReplayFraction;
